const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const approach = (v, target, step) => v + clamp(target - v, -step, step)

/** A bicycle steering model with a shared, gravity-dependent tire-force budget.
 *  This is a game handling model, not a calibrated rover dynamics solver.
 */
export function stepVehicleMotion(body, dt, input, { speed, grip, softness, gravity, normal, surface }) {
  const config = body.config
  const active = input.active !== false
  const throttle = active ? clamp(input.forward || 0, -1, 1) : 0
  const braking = !active || !!input.brake
  const steer = active ? clamp(input.steer || 0, -1, 1) : 0
  const velocity = body.velocity
  const oldX = velocity.x, oldZ = velocity.z
  const priorAlong = -Math.sin(body.yaw) * oldX - Math.cos(body.yaw) * oldZ
  const steeringTarget = steer * config.maxSteeringAngle / (1 + Math.abs(priorAlong) / 12)
  body.steeringAngle = approach(body.steeringAngle, steeringTarget,
    (steer ? config.steeringRate : config.steeringReturnRate) * dt)
  const tireAcceleration = Math.max(0.12, grip * gravity * normal.y)
  const yawLimit = tireAcceleration / Math.max(2, Math.abs(priorAlong)) * (surface.gripFactor < 0.8 ? 1.08 : 0.88)
  const wantedYawRate = body.grounded
    ? clamp(-priorAlong * Math.tan(body.steeringAngle) / config.wheelbase, -yawLimit, yawLimit) : 0
  body.yawRate += (wantedYawRate - body.yawRate) * (1 - Math.exp(-dt * 7))
  if (body.grounded) body.yaw += body.yawRate * dt

  const forwardX = -Math.sin(body.yaw), forwardZ = -Math.cos(body.yaw)
  const rightX = Math.cos(body.yaw), rightZ = -Math.sin(body.yaw)
  let along = velocity.x * forwardX + velocity.z * forwardZ
  let lateral = velocity.x * rightX + velocity.z * rightZ
  const lateralAllowance = tireAcceleration * (braking ? 0.55 : 1)
  const lateralChange = clamp(-lateral, -lateralAllowance * dt, lateralAllowance * dt)
  lateral += lateralChange
  const lateralAcceleration = lateralChange / dt
  const longitudinalBudget = Math.sqrt(Math.max(0, tireAcceleration ** 2 - lateralAcceleration ** 2))
  const uphill = Math.max(0, -(forwardX * normal.x + forwardZ * normal.z) * Math.sign(throttle))
  const target = braking ? 0 : throttle * speed / (1 + uphill * 1.35)
  const opposing = throttle && Math.sign(along) !== Math.sign(throttle) && Math.abs(along) > 0.3
  const requested = braking || opposing ? config.brakeAcceleration
    : throttle ? config.groundAcceleration * (1 - softness * 0.3) : config.coastDeceleration
  const before = along
  if (!throttle && !braking) {
    // Released wheels may roll down a slope; pausing applies a parking brake.
    const downhill = gravity * normal.y * (normal.x * forwardX + normal.z * forwardZ)
    along = approach(along + downhill * dt, 0, Math.min(config.coastDeceleration, longitudinalBudget) * dt)
  } else along = approach(along, target, Math.min(requested, longitudinalBudget) * dt)
  velocity.x = forwardX * along + rightX * lateral
  velocity.z = forwardZ * along + rightZ * lateral
  body.forwardSpeed = along
  body.sideSpeed = Math.abs(lateral)
  body.slideAngle = Math.atan2(Math.abs(lateral), Math.max(0.2, Math.abs(along))) * 180 / Math.PI
  body.longitudinalAcceleration = (along - before) / dt
  body.lateralAcceleration = lateralAcceleration
}
