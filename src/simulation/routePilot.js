import { advanceBudget, effortWatts, emptyBudget, EVA_DEFAULTS, walkingSpeed } from './eva.js'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))
const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z)
const yawTo = (a, b) => Math.atan2(a.x - b.x, a.z - b.z)
const stopped = (yaw = 0) => ({ forward: 0, right: 0, steer: 0, yaw, jump: false, brake: true, active: true })

/** Educational motor estimate for the fast exploration vehicle, not NASA rover telemetry. */
export function motorWatts(body) {
  const speed = Math.hypot(body.velocity.x, body.velocity.z)
  const surface = body.currentSurface ?? { speedFactor: 1 }
  const rolling = .035 + .16 * (1 - (surface.speedFactor ?? 1))
  const gravity = body.environment.getGravity()
  const traction = 1000 * gravity * rolling * speed
  const climb = 1000 * gravity * Math.max(0, body.velocity.y)
  const acceleration = 1000 * Math.max(0, (body.longitudinalAcceleration ?? 0) * (body.forwardSpeed ?? speed))
  return 120 + (traction + climb + acceleration) / .65
}

/** Pure pursuit through the existing physics controller. Never writes body position. */
export class RoutePilot {
  constructor(route, driving) {
    this.route = route
    this.driving = driving
    this.points = route.points.filter((point, i, all) => !i || distance(point, all[i - 1]) > .001)
    this.runs = this.points.slice(1).map((p, i) => distance(this.points[i], p))
    this.lengths = this.points.slice(1).map((p, i) => Math.hypot(this.runs[i], p.y - this.points[i].y))
    this.cumulative = [0]
    for (const length of this.lengths) this.cumulative.push(this.cumulative.at(-1) + length)
    this.total = this.cumulative.at(-1)
    this.segment = 0; this.progress = 0; this.elapsed = 0; this.energyJ = 0; this.power = 0
    this.status = this.points.length > 1 ? 'Following route' : 'Complete'
    this.reason = ''; this.gear = 1; this.stalled = 0; this.lastProgress = 0
    this.budget = emptyBudget()
    this.settings = { ...EVA_DEFAULTS, ...route.settings, ...route.eva?.settings }
    this.command = stopped()
  }

  controls(body, dt, active = true) {
    if (!active || this.status === 'Complete' || this.status === 'Blocked') return this.command = stopped(body.yaw)
    const p = body.position, last = this.points.at(-1)
    const speed = Math.hypot(body.velocity.x, body.velocity.z)
    const reach = this.driving ? .85 : .3
    let a = this.points[this.segment], b = this.points[this.segment + 1]
    let projection = ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / this.runs[this.segment] ** 2
    while (this.segment < this.lengths.length - 1 && (projection >= 1 || distance(p, b) < reach)) {
      this.segment++
      a = this.points[this.segment]; b = this.points[this.segment + 1]
      projection = ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / this.runs[this.segment] ** 2
    }
    const t = clamp(projection, 0, 1)
    const nearest = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
    this.crossTrack = distance(p, nearest)
    this.progress = Math.max(this.progress, this.cumulative[this.segment] + t * this.lengths[this.segment])
    const remaining = Math.max(0, this.total - this.progress)
    if (this.segment === this.lengths.length - 1 && distance(p, last) < (this.driving ? 1.4 : .45)) {
      this.command = stopped(body.yaw)
      if (speed < .18) { this.status = 'Complete'; this.progress = this.total }
      return this.command
    }
    if (this.crossTrack > Math.max(3, Math.min(6, (this.route.gridMeters ?? 8) * .5))) return this.block('Off the planned route. Take control or choose a new route.', body.yaw)
    if (body.terrain.sampleSlope(p.x, p.z) > Math.min(body.config.maxWalkSlope - 1, (this.route.slopeLimit ?? 20) + 3)) return this.block('The ground exceeds this route’s slope limit.', body.yaw)
    this.stalled = this.progress - this.lastProgress > .25 ? 0 : this.stalled + dt
    if (this.progress - this.lastProgress > .25) this.lastProgress = this.progress
    if (this.stalled > 12) return this.block('Progress stopped on difficult ground. Take control or replan.', body.yaw)
    const ahead = this.driving ? clamp(3 + speed * 1.25, 3, 7) : 1.2
    let targetDistance = Math.min(this.total, this.progress + ahead)
    let corner = 0
    if (this.segment < this.lengths.length - 1) {
      corner = Math.abs(wrap(yawTo(a, b) - yawTo(b, this.points[this.segment + 2])))
      if (corner > Math.PI / 2) targetDistance = Math.min(targetDistance, this.cumulative[this.segment + 1])
    }
    let targetIndex = this.segment
    while (targetIndex < this.lengths.length - 1 && this.cumulative[targetIndex + 1] < targetDistance) targetIndex++
    const u = clamp((targetDistance - this.cumulative[targetIndex]) / this.lengths[targetIndex], 0, 1)
    const from = this.points[targetIndex], to = this.points[targetIndex + 1]
    const target = { x: from.x + (to.x - from.x) * u, z: from.z + (to.z - from.z) * u }
    const yaw = yawTo(p, target)
    const surface = body.currentSurface ?? { speedFactor: 1, effortTerrain: 1 }
    const softness = body.environment.getRegolithSoftness()
    const rise = to.y - from.y, grade = rise / Math.max(.01, distance(from, to))
    if (this.driving) {
      const forwardError = wrap(yaw - body.yaw)
      if (Math.abs(forwardError) > 2.2) this.gear = -1
      else if (Math.abs(forwardError) < 1.1) this.gear = 1
      const error = wrap(yaw - body.yaw - (this.gear < 0 ? Math.PI : 0))
      const angle = -this.gear * Math.atan2(2 * body.config.wheelbase * Math.sin(error), Math.max(1.2, distance(p, target)))
      const steer = clamp(angle / (body.config.maxSteeringAngle / (1 + speed / 12)), -1, 1)
      let goal = Math.min(this.gear < 0 ? 1.2 : 3.4, 3.4 / (1 + 2.5 * Math.abs(error)), Math.sqrt(2 * Math.max(.1, remaining)))
      if (corner > Math.PI / 2) goal = Math.min(goal, Math.max(.4, Math.sqrt(distance(p, b))))
      const top = (this.gear < 0 ? body.config.reverseSpeed : body.config.walkSpeed) * (1 - softness * .48) * Math.max(.2, surface.speedFactor)
      const throttle = clamp(goal / Math.max(.2, top) + (goal - speed) * .14, 0, 1)
      const braking = speed > goal + .55
      this.command = { forward: braking ? 0 : this.gear * throttle, steer, right: 0, yaw: body.yaw, brake: braking, active: true }
    } else {
      const pace = this.route.walkPace ?? this.settings.pace
      const plannedSpeed = to.seconds > 0 ? distance(from, to) / to.seconds : Infinity
      const goal = Math.min(plannedSpeed, walkingSpeed(pace, grade, surface.effortTerrain ?? 1) / Math.sqrt(1 + grade ** 2), remaining * 1.5)
      const available = body.config.budgetedWalk ? walkingSpeed(body.config.walkSpeed, grade, surface.effortTerrain ?? 1) / Math.sqrt(1 + grade ** 2)
        : body.config.walkSpeed * (1 - softness * .48) * Math.max(.2, surface.speedFactor) / (1 + 1.35 * Math.max(0, grade))
      this.command = { forward: clamp(goal / Math.max(.1, available), 0, 1), right: 0, yaw, steer: 0, jump: false, brake: false, active: true }
    }
    return this.command
  }

  block(reason, yaw) { this.status = 'Blocked'; this.reason = reason; this.command = stopped(yaw); return this.command }

  record(body, dt, active) {
    if (!active || this.status === 'Complete' || this.status === 'Blocked') return
    this.elapsed += dt
    if (this.driving) { this.power = motorWatts(body); this.energyJ += this.power * dt }
    else {
      const run = Math.hypot(body.velocity.x, body.velocity.z)
      const grade = run > .05 ? body.velocity.y / run : 0
      const watts = effortWatts(Math.hypot(run, body.velocity.y), grade, body.currentSurface?.effortTerrain ?? 1, this.settings)
      this.budget = advanceBudget(this.budget, dt, watts, this.settings)
      this.power = this.budget.workloadWatts; this.energyJ = this.budget.energyJ
    }
  }

  telemetry(paused = false) {
    return { status: paused && this.status === 'Following route' ? 'Paused' : this.status, reason: this.reason,
      driving: this.driving, progress: this.progress, total: this.total, remaining: Math.max(0, this.total - this.progress),
      fraction: this.total ? this.progress / this.total : 1, elapsed: this.elapsed, energyJ: this.energyJ, powerWatts: paused ? 0 : this.power,
      throttle: Math.abs(this.command.forward ?? 0), crossTrack: this.crossTrack ?? 0, gear: this.gear }
  }
}
