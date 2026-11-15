import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer, Box3, Group, LoopOnce, Mesh, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Matrix4 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

const URL = `${import.meta.env.BASE_URL}models/perseverance.glb`
const DECODER = `${import.meta.env.BASE_URL}models/draco/`
useGLTF.setDecoderPath(DECODER)

/** Separate the six disconnected wheels in NASA's combined mesh without changing its shape. */
export function articulateRover(scene, animations = []) {
  const root = clone(scene)
  // NASA's file starts with the mast folded. Bake its supplied deployment pose.
  const deploy = new AnimationMixer(root)
  for (const clip of animations.filter((clip) => ['CylinderAction', 'bottomAction', 'topAction', 'Cylinder.002Action', 'ArmatureAction'].includes(clip.name))) {
    const action = deploy.clipAction(clip)
    action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play()
  }
  deploy.setTime(4)
  const deployedPose = []
  root.traverse((node) => deployedPose.push([node, node.position.clone(), node.quaternion.clone(), node.scale.clone()]))
  deploy.stopAllAction(); deploy.uncacheRoot(root)
  deployedPose.forEach(([node, position, quaternion, scale]) => { node.position.copy(position); node.quaternion.copy(quaternion); node.scale.copy(scale) })
  root.rotation.y = Math.PI // NASA source drives toward +Z; controller uses −Z.
  const wheelSource = root.getObjectByName('Wheels_objs')
  const originals = []
  wheelSource.traverse((node) => { if (node.isMesh) originals.push(node) })
  const pieces = Array.from({ length: 6 }, () => [])
  const boxes = Array.from({ length: 6 }, () => new Box3())
  const point = new Vector3()
  for (const mesh of originals) {
    const geometry = mesh.geometry
    const positions = geometry.attributes.position
    const triangles = Array.from({ length: 6 }, () => [])
    for (let i = 0; i < geometry.index.count; i += 3) {
      const indices = [geometry.index.getX(i), geometry.index.getX(i + 1), geometry.index.getX(i + 2)]
      const x = indices.reduce((sum, index) => sum + positions.getX(index), 0) / 3
      const z = indices.reduce((sum, index) => sum + positions.getZ(index), 0) / 3
      const wheel = (x > 0 ? 3 : 0) + (z < -.55 ? 0 : z > .55 ? 2 : 1)
      triangles[wheel].push(...indices)
      for (const index of indices) boxes[wheel].expandByPoint(point.fromBufferAttribute(positions, index))
    }
    triangles.forEach((indices, wheel) => {
      if (!indices.length) return
      const piece = geometry.clone().setIndex(indices)
      pieces[wheel].push(new Mesh(piece, mesh.material))
    })
    mesh.removeFromParent()
  }
  const wheels = [], steering = []
  boxes.forEach((box, index) => {
    const center = box.getCenter(new Vector3())
    const pivot = new Group(), spin = new Group()
    pivot.position.copy(center)
    pivot.name = index % 3 === 2 ? `rover-steering-${index < 3 ? 'right' : 'left'}` : `rover-steering-${index}`
    spin.name = `perseverance-wheel-${index}`
    spin.userData.radius = .263
    spin.userData.spinSign = -1
    for (const piece of pieces[index]) { piece.geometry.translate(-center.x, -center.y, -center.z); spin.add(piece) }
    pivot.add(spin); wheelSource.add(pivot); wheels.push(spin)
    if (index % 3 !== 1) { pivot.userData.steerSign = index % 3 === 0 ? -1 : 1; steering.push(pivot) }
  })
  const materials = new Map()
  root.traverse((node) => {
    if (!node.isMesh) return
    node.castShadow = true; node.receiveShadow = true
    const prepare = (material) => {
      if (!materials.has(material)) {
        const copy = material.clone()
        // Preserve the source textures; avoid expensive screen-space glass passes.
        if ('transmission' in copy) copy.transmission = 0
        copy.roughness = Math.max(.35, copy.roughness ?? .5)
        copy.metalness = Math.min(.7, copy.metalness ?? 0)
        materials.set(material, copy)
      }
      return materials.get(material)
    }
    node.material = Array.isArray(node.material) ? node.material.map(prepare) : prepare(node.material)
  })
  // Bake static parts by material, retaining the six wheel joints and skinned cables.
  // This reduces hundreds of tiny imported draw calls without reducing source detail.
  root.updateMatrixWorld(true)
  const inverseRoot = root.matrixWorld.clone().invert()
  const groups = new Map(), owned = pieces.flat().map((mesh) => mesh.geometry)
  const staticMeshes = root.getObjectsByProperty('isMesh', true).filter((mesh) => {
    if (mesh.isSkinnedMesh) return false
    for (let parent = mesh.parent; parent; parent = parent.parent) if (parent === wheelSource) return false
    return !Array.isArray(mesh.material)
  })
  for (const mesh of staticMeshes) {
    const matrix = new Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld)
    if (matrix.determinant() < 0) continue
    const signature = Object.entries(mesh.geometry.attributes).map(([name, a]) => `${name}:${a.itemSize}:${a.normalized}`).sort().join(',')
    const key = `${mesh.material.uuid}:${signature}:${!!mesh.geometry.index}`
    if (!groups.has(key)) groups.set(key, { material: mesh.material, geometries: [], sources: [] })
    const group = groups.get(key)
    group.geometries.push(mesh.geometry.clone().applyMatrix4(matrix))
    group.sources.push(mesh)
  }
  for (const { material, geometries, sources } of groups.values()) {
    const merged = mergeGeometries(geometries)
    geometries.forEach((geometry) => geometry.dispose())
    if (!merged) continue
    const mesh = new Mesh(merged, material)
    mesh.castShadow = true; mesh.receiveShadow = true
    mesh.name = 'perseverance-static-detail'
    root.add(mesh); owned.push(merged)
    sources.forEach((source) => source.removeFromParent())
  }
  return { root, wheels, steering, materials: [...materials.values()], geometries: owned }
}

export default function Car({ bodyRef, wheelRefs, steeringRefs }) {
  const { scene, animations } = useGLTF(URL, DECODER)
  const model = useMemo(() => articulateRover(scene, animations), [scene, animations])
  useEffect(() => {
    wheelRefs.current = model.wheels
    steeringRefs.current = model.steering
    return () => { wheelRefs.current = []; steeringRefs.current = [] }
  }, [model, wheelRefs, steeringRefs])
  useEffect(() => () => {
    model.geometries.forEach((geometry) => geometry.dispose())
    model.materials.forEach((material) => material.dispose())
    new Set(model.root.getObjectsByProperty('isSkinnedMesh', true).map((mesh) => mesh.skeleton)).forEach((skeleton) => skeleton.dispose())
  }, [model])
  return <group ref={bodyRef} name="mars-expedition-car" userData={{ source: 'NASA/JPL-Caltech Perseverance', wheelCount: 6 }} dispose={null}>
    <primitive object={model.root} />
  </group>
}
useGLTF.preload(URL, DECODER)
