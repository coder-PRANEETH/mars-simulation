import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Raycaster, Vector2 } from 'three'
import { PlayerPhysics, PLAYER_CONFIG } from '../physics/PlayerPhysics.js'

const LOOK_SENSITIVITY = 0.002
const MAX_PITCH = Math.PI / 2 - 0.035
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export default function Player({ terrain, environment, onTelemetry, onLockChange, onInspect, resetRef }) {
  const { camera, gl, scene } = useThree()
  const physics = useMemo(() => new PlayerPhysics(terrain, environment), [terrain, environment])
  const callbacks = useRef({ onTelemetry, onLockChange, onInspect })
  callbacks.current = { onTelemetry, onLockChange, onInspect }
  const keys = useRef(new Set())
  const locked = useRef(false)
  const skipMouseEvent = useRef(false)
  const look = useRef({
    yaw: terrain.metadata?.spawn?.yaw || 0,
    pitch: -0.035,
    targetYaw: terrain.metadata?.spawn?.yaw || 0,
    targetPitch: -0.035,
  })
  const state = useRef({ accumulator: 0, telemetryTime: 0, bob: 0, landing: 0, landingVelocity: 0, fps: 60 })
  const raycaster = useMemo(() => new Raycaster(), [])
  const center = useMemo(() => new Vector2(0, 0), [])
  const defaultFov = useRef(camera.fov || 70)

  useEffect(() => {
    const canvas = gl.domElement
    const enter = () => {
      if (document.pointerLockElement === canvas) return
      const requested = canvas.requestPointerLock()
      // Browsers expose either a Promise or void for this API.
      requested?.catch?.(() => callbacks.current.onLockChange?.(false))
    }
    const changeLock = () => {
      locked.current = document.pointerLockElement === canvas
      // Capturing the cursor can synthesize a recentering movement, especially
      // after clicking an HTML overlay. Keep the existing view on entry.
      look.current.targetYaw = look.current.yaw
      look.current.targetPitch = look.current.pitch
      skipMouseEvent.current = locked.current
      if (!locked.current) keys.current.clear()
      callbacks.current.onLockChange?.(locked.current)
    }
    const moveMouse = (event) => {
      if (!locked.current) return
      if (skipMouseEvent.current) {
        skipMouseEvent.current = false
        return
      }
      if (Math.abs(event.movementX) > 200 || Math.abs(event.movementY) > 200) return
      look.current.targetYaw -= event.movementX * LOOK_SENSITIVITY
      look.current.targetPitch = clamp(
        look.current.targetPitch - event.movementY * LOOK_SENSITIVITY,
        -MAX_PITCH, MAX_PITCH,
      )
    }
    const inspect = () => {
      const mesh = scene.getObjectByName('mars-terrain')
      if (!mesh) return
      raycaster.setFromCamera(center, camera)
      raycaster.far = 3000
      const hit = raycaster.intersectObject(mesh, true)[0]
      if (!hit) return
      const point = hit.point
      const coordinates = terrain.coordinates?.(point.x, point.z)
        || terrain.getCoordinates?.(point.x, point.z)
        || {}
      callbacks.current.onInspect?.({
        point: { x: point.x, y: point.y, z: point.z },
        ...coordinates,
        elevation: terrain.getElevation?.(point.x, point.z) ?? point.y,
        slope: terrain.sampleSlope(point.x, point.z),
        distance: hit.distance,
        surface: terrain.metadata?.surfaceInformation
          || 'Orbital elevation raster; local material properties are simulation parameters.',
      })
    }
    const down = (event) => {
      if (!locked.current) return
      if (event.code === 'Escape') {
        document.exitPointerLock()
        return
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE'].includes(event.code)) {
        event.preventDefault()
        keys.current.add(event.code)
      }
      if (event.code === 'KeyE' && !event.repeat) inspect()
    }
    const up = (event) => keys.current.delete(event.code)
    const blur = () => keys.current.clear()
    const reset = () => {
      physics.reset()
      keys.current.clear()
      state.current.accumulator = 0
      state.current.landing = 0
      state.current.landingVelocity = 0
      look.current.yaw = look.current.targetYaw = terrain.metadata?.spawn?.yaw || 0
      look.current.pitch = look.current.targetPitch = -0.035
      callbacks.current.onTelemetry?.({
        ...physics.telemetry(),
        fps: state.current.fps,
        heading: ((-look.current.yaw * 180 / Math.PI) % 360 + 360) % 360,
      })
    }
    if (resetRef) resetRef.current = { enter, reset, exit: () => document.exitPointerLock() }
    canvas.addEventListener('click', enter)
    document.addEventListener('pointerlockchange', changeLock)
    document.addEventListener('mousemove', moveMouse)
    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      canvas.removeEventListener('click', enter)
      document.removeEventListener('pointerlockchange', changeLock)
      document.removeEventListener('mousemove', moveMouse)
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      if (resetRef) resetRef.current = null
    }
  }, [camera, center, gl, physics, raycaster, resetRef, scene, terrain])

  useFrame((_, realDelta) => {
    const frame = state.current
    const dt = Math.min(realDelta, 0.1)
    frame.fps += ((realDelta > 0 ? 1 / realDelta : 60) - frame.fps) * (1 - Math.exp(-dt * 3))
    const view = look.current
    const lookBlend = 1 - Math.exp(-dt * 42)
    view.yaw += (view.targetYaw - view.yaw) * lookBlend
    view.pitch += (view.targetPitch - view.pitch) * lookBlend
    const pressed = keys.current
    const input = {
      forward: (pressed.has('KeyW') ? 1 : 0) - (pressed.has('KeyS') ? 1 : 0),
      right: (pressed.has('KeyD') ? 1 : 0) - (pressed.has('KeyA') ? 1 : 0),
      jump: pressed.has('Space'),
      sprint: pressed.has('ShiftLeft') || pressed.has('ShiftRight'),
      yaw: view.yaw,
      active: locked.current,
    }
    frame.accumulator += dt
    while (frame.accumulator >= PLAYER_CONFIG.fixedStep) {
      physics.step(PLAYER_CONFIG.fixedStep, input)
      frame.accumulator -= PLAYER_CONFIG.fixedStep
      if (physics.landingSpeed > 0) {
        frame.landingVelocity -= Math.min(2.1, physics.landingSpeed * 0.21)
      }
    }
    const speed = Math.hypot(physics.velocity.x, physics.velocity.z)
    const bobStrength = physics.grounded ? Math.min(1, speed / PLAYER_CONFIG.walkSpeed) : 0
    if (physics.grounded) frame.bob += speed * dt * 2.6
    // These tiny eye offsets provide gait/landing feedback only. Jump height
    // comes entirely from integrated body velocity and terrain contact above.
    frame.landingVelocity += (-120 * frame.landing - 19 * frame.landingVelocity) * dt
    frame.landing += frame.landingVelocity * dt
    frame.landing = clamp(frame.landing, -0.16, 0.025)
    const bobY = Math.sin(frame.bob) * 0.023 * bobStrength
    camera.position.set(
      physics.position.x,
      physics.position.y + PLAYER_CONFIG.eyeHeight + bobY + frame.landing,
      physics.position.z,
    )
    camera.rotation.order = 'YXZ'
    camera.rotation.set(view.pitch, view.yaw, Math.sin(frame.bob * 0.5) * 0.002 * bobStrength)
    if (camera.isPerspectiveCamera) {
      const targetFov = defaultFov.current + (input.sprint && speed > 2 && locked.current ? 7 : 0)
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-dt * 10))
      camera.updateProjectionMatrix()
    }
    frame.telemetryTime += dt
    if (frame.telemetryTime >= 0.1) {
      frame.telemetryTime = 0
      callbacks.current.onTelemetry?.({
        ...physics.telemetry(),
        fps: Math.round(frame.fps),
        heading: ((-view.yaw * 180 / Math.PI) % 360 + 360) % 360,
      })
    }
  })

  return null
}
