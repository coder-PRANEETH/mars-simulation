import { FIRM_SURFACE } from '../simulation/surface.js'
import { stepVehicleMotion } from './vehicleMotion.js'

// A small, deterministic heightfield character simulation. Distances are metres,
// time is seconds, and position.y is the player's feet (not the camera).
export const PLAYER_CONFIG = Object.freeze({
  surfaceResponse: true,
  sinkScale: 0,
  eyeHeight: 1.7,
  radius: 0.28,
  walkSpeed: 4.3,
  sprintSpeed: 7.0,
  jumpSpeed: 3.4,
  groundAcceleration: 25,
  airAcceleration: 1.9,
  stopAcceleration: 20,
  maxWalkSlope: 52,
  stepDown: 0.3,
  contactMargin: 0.015,
  coyoteTime: 0.08,
  jumpBuffer: 0.12,
  fixedStep: 1 / 120,
})

export const CAR_CONFIG = Object.freeze({
  ...PLAYER_CONFIG,
  radius: 1.8,
  surfaceResponse: true,
  sinkScale: 1,
  walkSpeed: 15,
  sprintSpeed: 15,
  reverseSpeed: 5,
  groundAcceleration: 8,
  stopAcceleration: 3.5,
  brakeAcceleration: 17,
  airAcceleration: 0,
  maxWalkSlope: 30,
  vehicleMotion: true,
  wheelbase: 2.59,
  maxSteeringAngle: 0.52,
  steeringRate: 1.5,
  steeringReturnRate: 2.1,
  coastDeceleration: 0.7,
})

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function approachVector(x, z, targetX, targetZ, amount) {
  const dx = targetX - x
  const dz = targetZ - z
  const length = Math.hypot(dx, dz)
  if (length <= amount || length < 1e-8) return [targetX, targetZ]
  return [x + dx / length * amount, z + dz / length * amount]
}

export class PlayerPhysics {
  constructor(terrain, environment, options = {}) {
    this.terrain = terrain
    this.environment = environment
    this.config = { ...PLAYER_CONFIG, ...options }
    this.position = { x: 0, y: 0, z: 0 }
    this.velocity = { x: 0, y: 0, z: 0 }
    this.grounded = true
    this.airborneTime = 0
    this.lastAirborneTime = 0
    this.landingSpeed = 0
    this.landingCount = 0
    this.sinkDepth = 0
    this.wheelSlip = 0
    this.groundGrip = 1
    this.elapsed = 0
    this.lastGroundedAt = 0
    this.jumpBufferedUntil = -1
    this.jumpWasHeld = false
    this.reset()
  }

  height(x, z) {
    return this.terrain.sampleHeight(x, z)
  }

  normal(x, z) {
    const normal = this.terrain.sampleNormal(x, z)
    return { x: normal.x, y: Math.max(normal.y, 0.02), z: normal.z }
  }

  reset(spawn) {
    this.resetVersion = (this.resetVersion ?? 0) + 1
    const location = spawn || this.terrain.metadata?.spawn || this.terrain.spawn || { x: 0, z: 0 }
    this.position.x = location.x || 0
    this.position.z = location.z || 0
    this.position.y = this.height(this.position.x, this.position.z) + this.config.contactMargin
    this.velocity.x = this.velocity.y = this.velocity.z = 0
    this.grounded = true
    this.airborneTime = 0
    this.lastAirborneTime = 0
    this.elapsed = 0
    this.lastGroundedAt = 0
    this.jumpBufferedUntil = -1
    this.jumpWasHeld = false
    this.landingSpeed = 0
    this.landingCount = 0
    this.sinkDepth = 0
    this.wheelSlip = 0
    this.groundGrip = 1
    this.yaw = location.yaw ?? this.terrain.metadata?.spawn?.yaw ?? 0
    this.steeringAngle = 0
    this.yawRate = 0
    this.forwardSpeed = 0
    this.sideSpeed = 0
    this.slideAngle = 0
    this.longitudinalAcceleration = 0
    this.lateralAcceleration = 0
  }

  step(dt, input = {}) {
    dt = Math.min(dt, 1 / 30)
    if (dt <= 0) return
    const config = this.config
    const position = this.position
    const velocity = this.velocity
    const gravity = this.environment.getGravity()
    const softness = clamp(this.environment.getRegolithSoftness(), 0, 1)
    // The shared environment already applies regolith's traction reduction.
    const friction = clamp(this.environment.getSurfaceFriction(position), 0.05, 1.5)
    const surface = config.surfaceResponse ? this.environment.getSurfaceCondition?.(position) ?? FIRM_SURFACE : FIRM_SURFACE
    this.currentSurface = surface
    const grip = friction * surface.gripFactor
    this.groundGrip = surface.gripFactor
    const sinkLimit = (surface.sinkDepth ?? 0) * config.sinkScale
    const throttle = input.active === false ? 0 : Math.abs(input.forward || 0)
    const targetSink = this.grounded ? sinkLimit * (0.55 + Math.min(1, throttle) * 0.45) : 0
    // Visual wheel settling never modifies the measured heightfield or contact plane.
    this.sinkDepth += (targetSink - this.sinkDepth) * (1 - Math.exp(-dt * (targetSink > this.sinkDepth ? 1.7 : 4)))
    const sinkFraction = sinkLimit > 0 ? this.sinkDepth / sinkLimit : 0
    const targetSlip = config.sinkScale && this.grounded && !input.brake
      ? Math.min(0.65, throttle * ((1 - surface.gripFactor) * 0.95 + sinkFraction * 0.18)) : 0
    this.wheelSlip += (targetSlip - this.wheelSlip) * (1 - Math.exp(-dt * 5))
    const normal = this.normal(position.x, position.z)
    const groundHeight = this.height(position.x, position.z)
    const slope = Math.acos(clamp(normal.y, 0, 1))
    this.elapsed += dt
    this.landingSpeed = 0

    if (input.jump && !this.jumpWasHeld && input.active !== false) {
      this.jumpBufferedUntil = this.elapsed + config.jumpBuffer
    }
    this.jumpWasHeld = Boolean(input.jump)

    if (this.grounded) this.lastGroundedAt = this.elapsed
    if (this.jumpBufferedUntil >= this.elapsed &&
        (this.grounded || this.elapsed - this.lastGroundedAt <= config.coyoteTime)) {
      this.grounded = false
      velocity.y = config.jumpSpeed
      this.airborneTime = 0
      this.jumpBufferedUntil = -1
      // Once consumed, this grounded interval cannot grant a second coyote jump.
      this.lastGroundedAt = -Infinity
    }

    let forward = input.active === false ? 0 : (input.forward || 0)
    let right = input.active === false ? 0 : (input.right || 0)
    const inputLength = Math.hypot(forward, right)
    if (inputLength > 1) {
      forward /= inputLength
      right /= inputLength
    }
    const yaw = config.vehicleMotion ? this.yaw : input.yaw || 0
    const desiredX = -Math.sin(yaw) * forward + Math.cos(yaw) * right
    const desiredZ = -Math.cos(yaw) * forward - Math.sin(yaw) * right
    const sprinting = input.sprint && input.active !== false
    const speedLimit = forward < 0 && config.reverseSpeed != null
      ? config.reverseSpeed : sprinting ? config.sprintSpeed : config.walkSpeed
    const speed = speedLimit * (1 - softness * 0.48) * surface.speedFactor * (1 - 0.2 * sinkFraction)
    const braking = input.brake ? config.brakeAcceleration ?? config.stopAcceleration : config.stopAcceleration

    if (this.grounded) {
      const tanSlope = Math.tan(slope)
      const isSliding = tanSlope > grip
      const traction = clamp(grip / 0.75, 0.12, 1.8)
      if (config.vehicleMotion) {
        stepVehicleMotion(this, dt, input, { speed, grip, softness, gravity, normal, surface })
      } else if (inputLength > 0) {
        const uphill = Math.max(0, -(desiredX * normal.x + desiredZ * normal.z))
        const slopeSpeed = speed / (1 + uphill * 1.35)
        ;[velocity.x, velocity.z] = approachVector(
          velocity.x, velocity.z, desiredX * slopeSpeed, desiredZ * slopeSpeed,
          config.groundAcceleration * traction * (1 - softness * 0.3) * dt,
        )
      } else if (!isSliding) {
        ;[velocity.x, velocity.z] = approachVector(
          velocity.x, velocity.z, 0, 0, braking * grip * dt,
        )
      } else {
        // Friction is already included in the net downslope force below. Brake
        // motion across the slope separately, so loose soil can actually slide.
        const horizontalNormal = Math.hypot(normal.x, normal.z)
        const downX = normal.x / horizontalNormal
        const downZ = normal.z / horizontalNormal
        const along = velocity.x * downX + velocity.z * downZ
        const acrossX = velocity.x - downX * along
        const acrossZ = velocity.z - downZ * along
        const [brakedX, brakedZ] = approachVector(
          acrossX, acrossZ, 0, 0, braking * grip * dt,
        )
        velocity.x = downX * along + brakedX
        velocity.z = downZ * along + brakedZ
      }

      if (isSliding) {
        // Project gravitational acceleration onto the surface, then subtract
        // Coulomb friction. Static grip prevents drift on ordinary firm slopes.
        const slipFraction = 1 - grip / Math.max(tanSlope, 1e-5)
        velocity.x += gravity * normal.y * normal.x * slipFraction * dt
        velocity.z += gravity * normal.y * normal.z * slipFraction * dt
      }

      // Heightfield side contact: surfaces beyond the walkable angle block
      // uphill driving while leaving movement across/down the slope possible.
      if (slope * 180 / Math.PI > config.maxWalkSlope) {
        const intoSlope = velocity.x * normal.x + velocity.z * normal.z
        if (intoSlope < 0) {
          const denominator = normal.x * normal.x + normal.z * normal.z
          velocity.x -= normal.x * intoSlope / denominator
          velocity.z -= normal.z * intoSlope / denominator
        }
      }
      velocity.y = -(normal.x * velocity.x + normal.z * velocity.z) / normal.y
    } else {
      if (inputLength > 0) {
        ;[velocity.x, velocity.z] = approachVector(
          velocity.x, velocity.z, desiredX * speed, desiredZ * speed,
          config.airAcceleration * dt,
        )
      }
      velocity.y -= gravity * dt
      this.airborneTime += dt
    }

    const oldX = position.x
    const oldZ = position.z
    let nextX = oldX + velocity.x * dt
    let nextZ = oldZ + velocity.z * dt
    const halfWidth = (this.terrain.metadata?.widthMeters || 2000) / 2 - config.radius
    const halfDepth = (this.terrain.metadata?.depthMeters || 2000) / 2 - config.radius
    const boundedX = clamp(nextX, -halfWidth, halfWidth)
    const boundedZ = clamp(nextZ, -halfDepth, halfDepth)
    if (nextX !== boundedX) velocity.x = 0
    if (nextZ !== boundedZ) velocity.z = 0
    nextX = boundedX
    nextZ = boundedZ
    let nextGround = this.height(nextX, nextZ) + config.contactMargin
    let nextY = position.y + velocity.y * dt

    // Airborne uphill collisions use the same heightfield as the rendered mesh.
    // Cancel penetrating horizontal motion instead of teleporting up a wall.
    if (!this.grounded && nextGround > nextY + config.radius &&
        nextGround > groundHeight + config.contactMargin) {
      const nextNormal = this.normal(nextX, nextZ)
      const intoSlope = velocity.x * nextNormal.x + velocity.z * nextNormal.z
      if (intoSlope < 0) {
        const denominator = nextNormal.x ** 2 + nextNormal.z ** 2
        if (denominator > 1e-6) {
          velocity.x -= nextNormal.x * intoSlope / denominator
          velocity.z -= nextNormal.z * intoSlope / denominator
          nextX = clamp(oldX + velocity.x * dt, -halfWidth, halfWidth)
          nextZ = clamp(oldZ + velocity.z * dt, -halfDepth, halfDepth)
          nextGround = this.height(nextX, nextZ) + config.contactMargin
        }
      }
    }

    if (this.grounded) {
      if (nextGround >= nextY - config.stepDown) {
        // Follow a continuous walkable surface without bouncing on downhill
        // sample boundaries. A genuine ledge releases the grounded constraint.
        nextY = nextGround
        const nextNormal = this.normal(nextX, nextZ)
        velocity.y = -(nextNormal.x * velocity.x + nextNormal.z * velocity.z) / nextNormal.y
      } else {
        this.grounded = false
        this.airborneTime = dt
      }
    } else if (nextY <= nextGround && velocity.y <= 0) {
      this.landingSpeed = Math.max(0, -velocity.y)
      this.landingCount++
      this.lastAirborneTime = this.airborneTime
      this.airborneTime = 0
      this.grounded = true
      this.lastGroundedAt = this.elapsed
      nextY = nextGround
      velocity.y = 0
    }

    // An ascending character meeting rising terrain gets a side contact.
    // This final guard keeps its feet out of the heightfield at all times.
    if (nextY < nextGround) {
      nextY = nextGround
      if (velocity.y < 0) velocity.y = 0
    }
    position.x = nextX
    position.y = nextY
    position.z = nextZ
    if (config.vehicleMotion) {
      this.forwardSpeed = -Math.sin(this.yaw) * velocity.x - Math.cos(this.yaw) * velocity.z
      this.sideSpeed = Math.abs(Math.cos(this.yaw) * velocity.x - Math.sin(this.yaw) * velocity.z)
      this.slideAngle = Math.atan2(this.sideSpeed, Math.max(0.2, Math.abs(this.forwardSpeed))) * 180 / Math.PI
    }
  }

  telemetry() {
    const position = this.position
    const localHeight = this.height(position.x, position.z)
    let elevation = localHeight
    if (typeof this.terrain.getElevation === 'function') {
      elevation = this.terrain.getElevation(position.x, position.z)
    } else if (Number.isFinite(this.terrain.metadata?.baseElevation)) {
      elevation += this.terrain.metadata.baseElevation
    }
    return {
      ...(this.terrain.coordinates?.(position.x, position.z) || {}),
      position: { ...position },
      elapsedSeconds: this.elapsed,
      velocity: { ...this.velocity },
      speed: Math.hypot(this.velocity.x, this.velocity.z),
      sinkDepth: this.sinkDepth,
      wheelSlip: this.wheelSlip,
      sideSpeed: this.sideSpeed,
      slideAngle: this.slideAngle,
      steeringAngle: this.steeringAngle,
      yawRate: this.yawRate,
      yaw: this.yaw,
      surface: this.config.surfaceResponse ? this.environment.getSurfaceCondition?.(position) ?? FIRM_SURFACE : null,
      verticalVelocity: this.velocity.y,
      grounded: this.grounded,
      slope: this.terrain.sampleSlope(position.x, position.z),
      terrainElevation: elevation,
      altitude: Math.max(0, position.y - localHeight - this.config.contactMargin),
      airborneTime: this.airborneTime,
      lastAirborneTime: this.lastAirborneTime,
    }
  }
}
