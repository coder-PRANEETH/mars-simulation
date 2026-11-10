import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Quaternion, Raycaster, Vector2, Vector3 } from 'three'
import { CAR_CONFIG, PlayerPhysics, PLAYER_CONFIG } from '../physics/PlayerPhysics.js'

import Car from './Car.jsx'

const UP = new Vector3(0, 1, 0)
const LOOK_SENSITIVITY = 0.002
const MAX_PITCH = Math.PI / 2 - 0.035
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export default function Player({ driving, carActive, onPauseCar, terrain, environment, onTelemetry, onLockChange, onInspect, resetRef }) {
  const { camera, gl, scene } = useThree()
  const physics = useMemo(() => new PlayerPhysics(terrain, environment), [terrain, environment])
  const callbacks = useRef({ carActive, onPauseCar, onTelemetry, onLockChange, onInspect })
  callbacks.current = { carActive, onPauseCar, onTelemetry, onLockChange, onInspect }
  const keys = useRef(new Set())
  const vehicle = useRef(null)
  const wheels = useRef([])
  const driverYaw = useRef(terrain.metadata?.spawn?.yaw ?? 0)
  const surfaceTilt = useMemo(() => new Quaternion(), [])
  const facing = useMemo(() => new Quaternion(), [])
  const groundNormal = useMemo(() => new Vector3(), [])
  const locked = useRef(false)
  const skipMouseEvent = useRef(false)
  const orbitPointer = useRef(null)
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
    if (driving) driverYaw.current = look.current.yaw
    const yaw = driverYaw.current
    if (!driving && physics.config === PLAYER_CONFIG) return
    physics.config = driving ? CAR_CONFIG : PLAYER_CONFIG
    physics.velocity.x = physics.velocity.z = 0
    physics.jumpBufferedUntil = -1
    keys.current.clear()
    look.current.yaw = look.current.targetYaw = driving ? 0 : yaw
    look.current.pitch = look.current.targetPitch = driving ? 0.08 : -0.035
  }, [driving, physics])

  useEffect(() => {
    if (!carActive) {
      keys.current.clear()
      orbitPointer.current = null
    }
  }, [carActive])

  useEffect(() => {
    const canvas = gl.domElement
    const enter = () => {
      if (driving || document.pointerLockElement === canvas) return
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
    const orbit = (event) => {
      if (Math.abs(event.movementX) > 200 || Math.abs(event.movementY) > 200) return
      look.current.targetYaw -= event.movementX * LOOK_SENSITIVITY
      look.current.targetPitch = clamp(look.current.targetPitch - event.movementY * LOOK_SENSITIVITY, -MAX_PITCH, MAX_PITCH)
    }
    const startOrbit = (event) => {
      if (!driving || !callbacks.current.carActive || event.button !== 0) return
      orbitPointer.current = event.pointerId
      canvas.setPointerCapture(event.pointerId)
    }
    const dragOrbit = (event) => {
      if (event.pointerId === orbitPointer.current && callbacks.current.carActive) orbit(event)
    }
    const endOrbit = () => { orbitPointer.current = null }
    const moveMouse = (event) => {
      if (!locked.current) return
      if (skipMouseEvent.current) {
        skipMouseEvent.current = false
        return
      }
      orbit(event)
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
      if (!(driving ? callbacks.current.carActive : locked.current)) return
      if (event.code === 'Escape') {
        if (driving) callbacks.current.onPauseCar()
        else document.exitPointerLock()
        return
      }
      if (driving && event.target instanceof Element) {
        if (event.target.closest('input, select, textarea, [contenteditable="true"]')) return
        if (event.code === 'Space' && event.target.closest('button:focus-visible, a:focus-visible, summary:focus-visible')) return
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE'].includes(event.code)) {
        event.preventDefault()
        keys.current.add(event.code)
      }
      if (event.code === 'KeyE' && !event.repeat) inspect()
    }
    const up = (event) => keys.current.delete(event.code)
    const blur = () => { keys.current.clear(); endOrbit() }
    const focus = (event) => {
      if (driving && event.target.matches('input, select, textarea, [contenteditable="true"]')) keys.current.clear()
    }
    const reset = (spawn) => {
      physics.reset(spawn)
      keys.current.clear()
      state.current.accumulator = 0
      state.current.landing = 0
      state.current.landingVelocity = 0
      driverYaw.current = spawn?.yaw ?? terrain.metadata?.spawn?.yaw ?? 0
      look.current.yaw = look.current.targetYaw = driving ? 0 : driverYaw.current
      look.current.pitch = look.current.targetPitch = driving ? 0.08 : -0.035
      callbacks.current.onTelemetry?.({
        ...physics.telemetry(),
        fps: state.current.fps,
        heading: ((-(driving ? driverYaw.current : look.current.yaw) * 180 / Math.PI) % 360 + 360) % 360,
      })
    }
    if (resetRef) resetRef.current = { enter, reset, exit: () => document.exitPointerLock() }
    canvas.addEventListener('click', enter)
    canvas.addEventListener('pointerdown', startOrbit)
    canvas.addEventListener('pointermove', dragOrbit)
    canvas.addEventListener('lostpointercapture', endOrbit)
    document.addEventListener('focusin', focus)
    document.addEventListener('pointerlockchange', changeLock)
    document.addEventListener('mousemove', moveMouse)
    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      canvas.removeEventListener('click', enter)
      canvas.removeEventListener('pointerdown', startOrbit)
      canvas.removeEventListener('pointermove', dragOrbit)
      canvas.removeEventListener('lostpointercapture', endOrbit)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('pointerlockchange', changeLock)
      document.removeEventListener('mousemove', moveMouse)
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      if (resetRef) resetRef.current = null
    }
  }, [camera, center, driving, gl, physics, raycaster, resetRef, scene, terrain])

  useFrame((_, realDelta) => {
    const frame = state.current
    const dt = Math.min(realDelta, 0.1)
    frame.fps += ((realDelta > 0 ? 1 / realDelta : 60) - frame.fps) * (1 - Math.exp(-dt * 3))
    const view = look.current
    const lookBlend = 1 - Math.exp(-dt * 42)
    view.yaw += (view.targetYaw - view.yaw) * lookBlend
    view.pitch += (view.targetPitch - view.pitch) * lookBlend
    const pressed = keys.current
    const throttle = (pressed.has('KeyW') ? 1 : 0) - (pressed.has('KeyS') ? 1 : 0)
    const steer = (pressed.has('KeyD') ? 1 : 0) - (pressed.has('KeyA') ? 1 : 0)
    const brake = driving && pressed.has('Space')
    const input = {
      forward: brake ? 0 : throttle,
      right: driving ? 0 : steer,
      jump: !driving && pressed.has('Space'),
      brake,
      sprint: !driving && (pressed.has('ShiftLeft') || pressed.has('ShiftRight')),
      yaw: view.yaw,
      active: driving ? carActive : locked.current,
    }
    frame.accumulator += dt
    while (frame.accumulator >= PLAYER_CONFIG.fixedStep) {
      if (driving) {
        const yaw = driverYaw.current
        const along = -Math.sin(yaw) * physics.velocity.x - Math.cos(yaw) * physics.velocity.z
        if (input.active && physics.grounded) {
          const direction = Math.abs(along) > 0.2 ? Math.sign(along) : throttle
          const turning = Math.min(Math.abs(along) / 2 + Math.abs(throttle) * 0.25, 1) * 0.86
          driverYaw.current -= steer * direction * turning * PLAYER_CONFIG.fixedStep
        }
        input.yaw = driverYaw.current
      }
      physics.step(PLAYER_CONFIG.fixedStep, input)
      frame.accumulator -= PLAYER_CONFIG.fixedStep
      if (physics.landingSpeed > 0) {
        frame.landingVelocity -= Math.min(2.1, physics.landingSpeed * 0.21)
      }
    }
    const speed = Math.hypot(physics.velocity.x, physics.velocity.z)
    const bobStrength = !driving && physics.grounded ? Math.min(1, speed / PLAYER_CONFIG.walkSpeed) : 0
    if (physics.grounded) frame.bob += speed * dt * 2.6
    // These tiny eye offsets provide gait/landing feedback only. Jump height
    // comes entirely from integrated body velocity and terrain contact above.
    frame.landingVelocity += (-120 * frame.landing - 19 * frame.landingVelocity) * dt
    frame.landing += frame.landingVelocity * dt
    frame.landing = clamp(frame.landing, -0.16, 0.025)
    const bobY = Math.sin(frame.bob) * 0.023 * bobStrength
    const { x, y, z } = physics.position
    if (driving) {
      const yaw = driverYaw.current
      const orbit = yaw + view.yaw
      const back = 6.9 * Math.cos(view.pitch)
      const cameraX = x + Math.sin(orbit) * back
      const cameraZ = z + Math.cos(orbit) * back
      const cameraY = Math.max(y + 3.2 + Math.sin(view.pitch) * 4, terrain.sampleHeight(cameraX, cameraZ) + 0.8)
      camera.position.set(cameraX, cameraY, cameraZ)
      camera.lookAt(x - Math.sin(yaw) * 4.6, y + 0.95, z - Math.cos(yaw) * 4.6)
      if (vehicle.current) {
        vehicle.current.position.set(x, y, z)
        terrain.sampleNormal(x, z, groundNormal)
        surfaceTilt.setFromUnitVectors(UP, groundNormal)
        facing.setFromAxisAngle(UP, yaw)
        vehicle.current.quaternion.slerp(surfaceTilt.multiply(facing), 1 - Math.exp(-dt * 14))
        const forwardSpeed = -Math.sin(yaw) * physics.velocity.x - Math.cos(yaw) * physics.velocity.z
        for (const wheel of wheels.current) if (wheel) wheel.rotation.x -= forwardSpeed / 0.45 * dt
      }
    } else {
      camera.position.set(x, y + PLAYER_CONFIG.eyeHeight + bobY + frame.landing, z)
      camera.rotation.order = 'YXZ'
      camera.rotation.set(view.pitch, view.yaw, Math.sin(frame.bob * 0.5) * 0.002 * bobStrength)
    }
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
        heading: ((-(driving ? driverYaw.current : view.yaw) * 180 / Math.PI) % 360 + 360) % 360,
      })
    }
  })

  return driving ? <Car bodyRef={vehicle} wheelRefs={wheels} /> : null
}
