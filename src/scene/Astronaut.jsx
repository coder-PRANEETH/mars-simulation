import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer, Box3, MathUtils, Quaternion, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

const URL = `${import.meta.env.BASE_URL}models/astronaut.glb`

/** Imported, rigged Quaternius astronaut. Physics owns position; clips stay in place. */
export default function Astronaut({ bodyRef, physics, visible, active }) {
  const { scene, animations } = useGLTF(URL, false)
  const model = useMemo(() => {
    const root = clone(scene)
    const neutral = animations.find((clip) => clip.name.endsWith('|Idle_Neutral'))
    const preview = new AnimationMixer(root)
    preview.clipAction(neutral).play()
    preview.update(0)
    const pose = []
    root.traverse((node) => pose.push([node, node.position.clone(), node.quaternion.clone(), node.scale.clone()]))
    preview.stopAllAction(); preview.uncacheRoot(root)
    pose.forEach(([node, position, quaternion, scale]) => { node.position.copy(position); node.quaternion.copy(quaternion); node.scale.copy(scale) })
    root.updateMatrixWorld(true)
    const box = new Box3().setFromObject(root, true)
    const size = box.getSize(new Vector3())
    const scale = 1.85 / size.y
    root.scale.multiplyScalar(scale)
    root.position.set(-(box.min.x + box.max.x) * .5 * scale, -box.min.y * scale, -(box.min.z + box.max.z) * .5 * scale)
    root.userData.baseY = root.position.y
    root.traverse((node) => {
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false }
    })
    return root
  }, [scene, animations])
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const clips = useMemo(() => Object.fromEntries(['Idle', 'Walk', 'Run'].map((name) => {
    const source = animations.find((clip) => clip.name.endsWith(`|${name === 'Idle' ? 'Idle_Neutral' : name}`))
    const clip = source.clone()
    // Imported clips are in-place; keep the controller as the only root-motion source.
    clip.tracks = clip.tracks.filter((track) => !/^(Root|RootNode|CharacterArmature)\.position$/.test(track.name))
    return [name, mixer.clipAction(clip)]
  })), [animations, mixer])
  const previous = useRef(null)
  const blend = useRef(0)
  const legs = useMemo(() => ['UpperLeg.L', 'UpperLeg.R'].map((name) => ({ bone: model.getObjectByName(name.replace('.', '')) ?? model.getObjectByName(name), base: new Quaternion() })), [model])

  const feet = useMemo(() => {
    const meshes = []
    model.getObjectByName('SpaceSuit_Feet')?.traverse((node) => { if (node.isSkinnedMesh) meshes.push(node) })
    return meshes
  }, [model])
  const footBounds = useMemo(() => new Box3(), [])
  const meshBounds = useMemo(() => new Box3(), [])
  useEffect(() => () => {
    mixer.stopAllAction(); mixer.uncacheRoot(model)
    const skeletons = new Set(model.getObjectsByProperty('isSkinnedMesh', true).map((mesh) => mesh.skeleton))
    skeletons.forEach((skeleton) => skeleton.dispose())
  }, [mixer, model])
  useFrame((_, delta) => {
    const dt = Math.min(delta, .1)
    const speed = Math.hypot(physics.velocity.x, physics.velocity.z)
    const state = !active || !physics.grounded || speed < .08 ? 'Idle' : speed > 4.8 ? 'Run' : 'Walk'
    if (previous.current !== state) {
      clips[state].reset().fadeIn(.18).play()
      if (previous.current) clips[previous.current].fadeOut(.18)
      previous.current = state
    }
    clips.Walk.timeScale = MathUtils.clamp(speed / 1.7, .25, 2.5)
    clips.Run.timeScale = MathUtils.clamp(speed / 5.5, .6, 1.6)
    // Restore last frame's additive airborne pose before evaluating fresh clip transforms.
    if (blend.current) for (const joint of legs) if (joint.bone) joint.bone.quaternion.copy(joint.base)
    mixer.update(active ? dt : 0)
    blend.current = MathUtils.damp(blend.current, active && !physics.grounded ? 1 : 0, 12, dt)
    for (const { bone, base } of legs) if (bone) {
      base.copy(bone.quaternion)
      bone.rotateX(-.4 * blend.current)
    }
    // Anchor the lowest animated boot to the controller's feet, including during jumps.
    // This fixes the source file's bind-pose offset without moving the collision body.
    model.position.y = model.userData.baseY
    model.updateWorldMatrix(true, true)
    footBounds.makeEmpty()
    for (const mesh of feet) {
      mesh.skeleton.update()
      mesh.computeBoundingBox()
      footBounds.union(meshBounds.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld))
    }
    if (!footBounds.isEmpty()) model.position.y += physics.position.y - footBounds.min.y
    if (bodyRef.current) {
      bodyRef.current.userData.animation = !physics.grounded ? 'Jump' : state
      bodyRef.current.userData.animationTime = mixer.time
      bodyRef.current.userData.source = 'Quaternius'
      bodyRef.current.userData.bootClearance = footBounds.isEmpty() ? null : footBounds.min.y + model.position.y - model.userData.baseY - physics.position.y
      bodyRef.current.userData.legQuaternion = legs[0].bone?.quaternion.toArray()
    }
  })
  return <group ref={bodyRef} name="mars-astronaut" visible={visible} dispose={null}><group rotation={[0, Math.PI, 0]}><primitive object={model} /></group></group>
}
useGLTF.preload(URL, false)
