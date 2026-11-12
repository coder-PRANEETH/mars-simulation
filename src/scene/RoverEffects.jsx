import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, CanvasTexture, ShaderMaterial } from 'three'

const PARTICLES = 96, TRACKS = 320, TRACK_LIFE = 24
const wheelX = [-1.05, 1.05]
const vertex = 'attribute float alpha; varying float fade; varying vec2 uvLocal; void main(){ fade=alpha; uvLocal=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }'

/** Bounded visual cues for simulated loose soil. Never modifies the source DEM. */
export default function RoverEffects({ physics, terrain, active }) {
  const dustRef = useRef(), tracksRef = useRef()
  const state = useRef({ cursor: 0, trackCursor: 0, emission: 0, resetVersion: -1, previous: [null, null], seed: 1827 })
  const resources = useMemo(() => {
    const dustGeometry = new BufferGeometry()
    dustGeometry.setAttribute('position', new BufferAttribute(new Float32Array(PARTICLES * 3), 3))
    dustGeometry.setAttribute('size', new BufferAttribute(new Float32Array(PARTICLES), 1))
    dustGeometry.setAttribute('alpha', new BufferAttribute(new Float32Array(PARTICLES), 1))
    dustGeometry.setDrawRange(0, 0)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 32
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.4, 'rgba(255,255,255,.5)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 32, 32)
    const texture = new CanvasTexture(canvas)
    const dustMaterial = new ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { sprite: { value: texture }, scale: { value: 500 } },
      vertexShader: 'attribute float size; attribute float alpha; uniform float scale; varying float fade; void main(){ fade=alpha; vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; gl_PointSize=min(100.0,size*scale/max(0.5,-p.z)); }',
      fragmentShader: 'uniform sampler2D sprite; varying float fade; void main(){ float a=texture2D(sprite,gl_PointCoord).a*fade; if(a<0.01)discard; gl_FragColor=vec4(0.64,0.44,0.27,a); #include <tonemapping_fragment>\n#include <colorspace_fragment> }'.replace('; #include', ';\n#include'),
    })
    const trackGeometry = new BufferGeometry()
    trackGeometry.setAttribute('position', new BufferAttribute(new Float32Array(TRACKS * 12), 3))
    trackGeometry.setAttribute('alpha', new BufferAttribute(new Float32Array(TRACKS * 4), 1))
    const uv = new Float32Array(TRACKS * 8), indices = new Uint16Array(TRACKS * 6)
    for (let i = 0; i < TRACKS; i++) {
      uv.set([0, 0, 1, 0, 0, 1, 1, 1], i * 8)
      const a = i * 4
      indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6)
    }
    trackGeometry.setAttribute('uv', new BufferAttribute(uv, 2))
    trackGeometry.setIndex(new BufferAttribute(indices, 1))
    const trackMaterial = new ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      vertexShader: vertex,
      fragmentShader: 'varying float fade; varying vec2 uvLocal; void main(){ float edge=smoothstep(0.0,0.18,uvLocal.x)*(1.0-smoothstep(0.82,1.0,uvLocal.x)); float tread=0.6+0.4*step(0.45,fract(uvLocal.y*3.0+uvLocal.x*0.3)); float a=fade*edge*tread; if(a<0.01)discard; gl_FragColor=vec4(0.075,0.045,0.025,a); #include <tonemapping_fragment>\n#include <colorspace_fragment> }'.replace('; #include', ';\n#include'),
    })
    return { dustGeometry, dustMaterial, trackGeometry, trackMaterial, texture,
      particles: new Float32Array(PARTICLES * 8), lives: new Float32Array(PARTICLES),
      trackLives: new Float32Array(TRACKS), trackStrength: new Float32Array(TRACKS) }
  }, [])
  useEffect(() => () => {
    resources.dustGeometry.dispose(); resources.dustMaterial.dispose(); resources.texture.dispose()
    resources.trackGeometry.dispose(); resources.trackMaterial.dispose()
  }, [resources])

  useFrame(({ camera, size, gl }, delta) => {
    const dt = Math.min(delta, 0.1), s = state.current, r = resources
    if (s.resetVersion !== physics.resetVersion) {
      s.resetVersion = physics.resetVersion
      r.lives.fill(0); r.trackLives.fill(0)
      s.previous = [null, null]; s.emission = 0
    }
    const random = () => { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296 }
    const surface = physics.currentSurface
    const loose = (surface?.sinkDepth ?? 0) > 0.015
    const speed = Math.hypot(physics.velocity.x, physics.velocity.z)
    const strength = Math.min(1, physics.wheelSlip * 1.4 + physics.sideSpeed * 0.25 + Math.min(0.16, speed * 0.03))
    const emit = active && physics.grounded && loose && speed > 0.15
    const yaw = physics.yaw, sin = Math.sin(yaw), cos = Math.cos(yaw)
    s.emission += emit ? dt : 0
    const wheels = wheelX.map((offset) => ({ x: physics.position.x + cos * offset + sin * 1.27, z: physics.position.z - sin * offset + cos * 1.27 }))
    if (emit && s.emission >= 0.035) {
      s.emission = 0
      for (const wheel of wheels) {
        const i = s.cursor++ % PARTICLES, p = i * 8
        r.lives[i] = 0.65 + random() * 0.35
        r.particles.set([wheel.x, terrain.sampleHeight(wheel.x, wheel.z) + 0.08, wheel.z,
          sin * (0.7 + strength) + (random() - 0.5), 0.35 + random() * 0.6,
          cos * (0.7 + strength) + (random() - 0.5), 0.18 + random() * 0.25, strength], p)
      }
    }
    if (emit) wheels.forEach((wheel, side) => {
      const previous = s.previous[side]
      const length = previous ? Math.hypot(wheel.x - previous.x, wheel.z - previous.z) : 0
      if (!previous || length > 3) { s.previous[side] = wheel; return }
      if (length < 0.24) return
      const track = s.trackCursor++ % TRACKS
      const width = 0.16 + physics.sinkDepth * 0.35
      const nx = -(wheel.z - previous.z) / length * width, nz = (wheel.x - previous.x) / length * width
      const corners = [[previous.x - nx, previous.z - nz], [previous.x + nx, previous.z + nz], [wheel.x - nx, wheel.z - nz], [wheel.x + nx, wheel.z + nz]]
      corners.forEach(([x, z], c) => r.trackGeometry.attributes.position.array.set([x, terrain.sampleHeight(x, z) + 0.026, z], track * 12 + c * 3))
      r.trackLives[track] = TRACK_LIFE
      r.trackStrength[track] = 0.4 + Math.min(0.25, physics.sinkDepth * 2)
      s.previous[side] = wheel
    }); else s.previous = [null, null]
    let alive = 0, trackCount = 0
    for (let i = 0; i < PARTICLES; i++) {
      r.lives[i] -= dt
      if (r.lives[i] <= 0) continue
      const p = i * 8
      r.particles[p] += r.particles[p + 3] * dt
      r.particles[p + 1] += r.particles[p + 4] * dt
      r.particles[p + 2] += r.particles[p + 5] * dt
      r.particles[p + 4] -= 1.1 * dt
      r.dustGeometry.attributes.position.array.set(r.particles.subarray(p, p + 3), alive * 3)
      r.dustGeometry.attributes.size.array[alive] = r.particles[p + 6] * (1.8 - r.lives[i])
      r.dustGeometry.attributes.alpha.array[alive] = Math.min(1, r.lives[i] * 2) * r.particles[p + 7] * 0.42
      alive++
    }
    for (let i = 0; i < TRACKS; i++) {
      r.trackLives[i] = Math.max(0, r.trackLives[i] - dt)
      if (r.trackLives[i] > 0) trackCount++
      const fade = Math.min(1, r.trackLives[i] / 5) * r.trackStrength[i]
      r.trackGeometry.attributes.alpha.array.fill(fade, i * 4, i * 4 + 4)
    }
    for (const attribute of Object.values(r.dustGeometry.attributes)) attribute.needsUpdate = true
    r.dustGeometry.setDrawRange(0, alive)
    r.dustMaterial.uniforms.scale.value = size.height * gl.getPixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360))
    r.trackGeometry.attributes.alpha.needsUpdate = true
    r.trackGeometry.attributes.position.needsUpdate = true
    dustRef.current.userData.activeParticles = alive
    tracksRef.current.userData.activeSegments = trackCount
  })
  return <>
    <points name="rover-wheel-dust" ref={dustRef} geometry={resources.dustGeometry} material={resources.dustMaterial} frustumCulled={false} />
    <mesh name="rover-wheel-tracks" ref={tracksRef} geometry={resources.trackGeometry} material={resources.trackMaterial} frustumCulled={false} renderOrder={1} />
  </>
}
