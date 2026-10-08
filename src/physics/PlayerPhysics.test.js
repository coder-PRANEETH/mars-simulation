import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerPhysics, PLAYER_CONFIG } from './PlayerPhysics.js'

const dt = PLAYER_CONFIG.fixedStep
function makeTerrain(height = () => 0, gradient = () => ({ x: 0, z: 0 })) {
  return {
    metadata: { widthMeters: 2000, depthMeters: 2000 },
    sampleHeight: height,
    sampleNormal(x, z) {
      const grad = gradient(x, z)
      const length = Math.hypot(grad.x, 1, grad.z)
      return { x: -grad.x / length, y: 1 / length, z: -grad.z / length }
    },
    sampleSlope(x, z) {
      const grad = gradient(x, z)
      return Math.atan(Math.hypot(grad.x, grad.z)) * 180 / Math.PI
    },
  }
}
function makeEnvironment(initial = {}) {
  const state = { gravity: 3.71, friction: 0.85, regolithSoftness: 0.2, ...initial }
  return {
    state,
    getGravity: () => state.gravity,
    getSurfaceFriction: () => state.friction,
    getRegolithSoftness: () => state.regolithSoftness,
  }
}
function run(body, seconds, input = {}) {
  for (let step = 0; step < Math.ceil(seconds / dt); step++) body.step(dt, input)
}
function measureJump(gravity) {
  const body = new PlayerPhysics(makeTerrain(), makeEnvironment({ gravity }))
  const startingHeight = body.position.y
  body.step(dt, { jump: true })
  let apex = 0
  while (!body.grounded && body.elapsed < 20) {
    apex = Math.max(apex, body.position.y - startingHeight)
    body.step(dt, {})
  }
  return { apex, flight: body.lastAirborneTime, body }
}

test('jump trajectories are integrated from velocity: Mars lasts longer than Earth', () => {
  const mars = measureJump(3.71)
  const earth = measureJump(9.81)
  const moon = measureJump(1.62)
  assert.ok(Math.abs(mars.apex - 3.4 ** 2 / (2 * 3.71)) < 0.04)
  assert.ok(Math.abs(earth.apex - 3.4 ** 2 / (2 * 9.81)) < 0.04)
  assert.ok(mars.flight > earth.flight * 2.5)
  assert.ok(moon.flight > mars.flight * 2)
  assert.ok(mars.body.grounded)
  assert.equal(mars.body.velocity.y, 0)
})

test('gravity changes affect an already airborne body on the next physics step', () => {
  const environment = makeEnvironment()
  const body = new PlayerPhysics(makeTerrain(), environment)
  body.step(dt, { jump: true })
  const initialVelocity = body.velocity.y
  environment.state.gravity = 9.81
  body.step(dt)
  assert.ok(Math.abs(body.velocity.y - (initialVelocity - 9.81 * dt)) < 1e-10)
})

test('holding jump cannot create repeated jumps or an airborne second jump', () => {
  const body = new PlayerPhysics(makeTerrain(), makeEnvironment())
  run(body, 4, { jump: true })
  assert.ok(body.grounded)
  assert.equal(body.landingCount, 1)
  body.step(dt, { jump: false })
  body.step(dt, { jump: true })
  const velocity = body.velocity.y
  body.step(dt, { jump: false })
  body.step(dt, { jump: true })
  assert.ok(body.velocity.y < velocity)
})

test('the contact constraint follows reconstructed hills without going underground', () => {
  const height = (x, z) => 4 * Math.sin(x / 17) + 3 * Math.cos(z / 23)
  const gradient = (x, z) => ({ x: 4 / 17 * Math.cos(x / 17), z: -3 / 23 * Math.sin(z / 23) })
  const terrain = makeTerrain(height, gradient)
  const body = new PlayerPhysics(terrain, makeEnvironment({ regolithSoftness: 0 }))
  for (let step = 0; step < 2400; step++) {
    body.step(dt, { forward: 1, right: 0.3, yaw: 0.5, sprint: true })
    assert.ok(body.position.y >= terrain.sampleHeight(body.position.x, body.position.z))
    assert.ok(body.grounded)
  }
  assert.ok(Math.hypot(body.position.x, body.position.z) > 100)
  assert.ok(body.telemetry().altitude < 1e-5)
})

test('a terrain ledge releases ground contact and the player falls under gravity', () => {
  const terrain = makeTerrain((x) => x < 0 ? 0 : -5)
  const body = new PlayerPhysics(terrain, makeEnvironment({ regolithSoftness: 0 }))
  body.reset({ x: -0.05, z: 0 })
  run(body, 0.5, { right: 1 })
  assert.equal(body.grounded, false)
  assert.ok(body.position.y < -0.05)
  assert.ok(body.velocity.y < 0)
  run(body, 2, { right: 1 })
  assert.equal(body.grounded, true)
  assert.ok(Math.abs(body.position.y + 5 - PLAYER_CONFIG.contactMargin) < 1e-6)
})

test('low friction increases stopping distance and loose regolith reduces movement speed', () => {
  const stoppingDistance = (friction) => {
    const body = new PlayerPhysics(makeTerrain(), makeEnvironment({ friction, regolithSoftness: 0 }))
    run(body, 3, { right: 1 })
    const start = body.position.x
    run(body, 3)
    return body.position.x - start
  }
  assert.ok(stoppingDistance(0.1) > stoppingDistance(1.2) * 6)
  const hard = new PlayerPhysics(makeTerrain(), makeEnvironment({ regolithSoftness: 0 }))
  const loose = new PlayerPhysics(makeTerrain(), makeEnvironment({ regolithSoftness: 1 }))
  run(hard, 3, { forward: 1 })
  run(loose, 3, { forward: 1 })
  assert.ok(hard.telemetry().speed > loose.telemetry().speed * 1.8)
})

test('slope grip holds firm soil and lets low friction soil slide downhill', () => {
  const rise = Math.tan(20 * Math.PI / 180)
  const terrain = makeTerrain((x) => x * rise, () => ({ x: rise, z: 0 }))
  const grippy = new PlayerPhysics(terrain, makeEnvironment({ friction: 0.85, regolithSoftness: 0 }))
  const slippery = new PlayerPhysics(terrain, makeEnvironment({ friction: 0.1, regolithSoftness: 0 }))
  run(grippy, 2)
  run(slippery, 2)
  assert.ok(Math.abs(grippy.position.x) < 1e-8)
  assert.ok(slippery.position.x < -1)
  assert.ok(slippery.velocity.x < -1)
  assert.ok(slippery.grounded)
})

test('air control is limited and the body cannot escape the terrain bounds', () => {
  const body = new PlayerPhysics(makeTerrain(), makeEnvironment({ gravity: 0.5 }))
  body.step(dt, { jump: true })
  run(body, 0.5, { right: 1 })
  assert.ok(body.velocity.x < 1.1)
  body.reset({ x: 999.6, z: 0 })
  run(body, 1, { right: 1, sprint: true })
  assert.ok(body.position.x <= 1000 - PLAYER_CONFIG.radius)
  assert.ok(body.position.y >= 0)
})
