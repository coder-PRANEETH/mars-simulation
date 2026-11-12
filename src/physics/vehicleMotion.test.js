import test from 'node:test'
import assert from 'node:assert/strict'
import { createTerrain } from '../terrain/terrain.js'
import { PlayerPhysics, CAR_CONFIG } from './PlayerPhysics.js'
import { SURFACE_MODELS } from '../terrain/materials.js'

function rover(material = 'floor-rock', gravity = 3.71) {
  const terrain = createTerrain({ columns: 3, rows: 3, widthMeters: 2000, depthMeters: 2000, elevationOffset: 0 }, new Float32Array(9))
  const environment = { getGravity: () => gravity, getRegolithSoftness: () => 0,
    getSurfaceFriction: () => 1, getSurfaceCondition: () => SURFACE_MODELS[material] }
  return new PlayerPhysics(terrain, environment, CAR_CONFIG)
}
function run(body, seconds, input) {
  for (let i = 0; i < seconds * 120; i++) body.step(1 / 120, input)
}

test('front wheels steer while stationary without spinning the rover in place', () => {
  const body = rover()
  run(body, 1, { steer: 1 })
  assert.ok(body.steeringAngle > 0.4)
  assert.equal(body.yaw, 0)
  assert.equal(body.position.x, 0)
  assert.equal(body.position.z, 0)
  body.step(1 / 120, { steer: 0 })
  assert.ok(body.steeringAngle > 0.3, 'Steering returns gradually instead of snapping')
})

test('a turning rover retains momentum and develops more lateral slide on loose sand', () => {
  const firm = rover(), sand = rover('sand')
  for (const body of [firm, sand]) {
    body.velocity.z = -8
    run(body, 2, { steer: 1 })
    assert.ok(body.yaw < -0.2)
  }
  assert.ok(sand.sideSpeed > firm.sideSpeed + 0.05)
  assert.ok(sand.slideAngle > 1)
  const reverse = rover()
  reverse.velocity.z = 4
  run(reverse, 1, { steer: 1 })
  assert.ok(reverse.yaw > 0, 'Reverse steering changes heading in the opposite direction')
})

test('combined cornering and motor force stay within the flat-ground tire force budget', () => {
  for (const material of ['floor-rock', 'sand']) {
    const body = rover(material)
    for (let i = 0; i < 720; i++) {
      const { x, z } = body.velocity
      body.step(1 / 120, { forward: 1, steer: i > 240 ? 1 : 0 })
      const acceleration = Math.hypot(body.velocity.x - x, body.velocity.z - z) * 120
      assert.ok(acceleration <= 3.71 * SURFACE_MODELS[material].gripFactor + 1e-7)
    }
  }
})

test('coasting, parking and braking depend on momentum, grip and gravity', () => {
  const coast = rover()
  coast.velocity.z = -5
  run(coast, 2, {})
  assert.ok(coast.telemetry().speed > 3)
  run(coast, 2, { active: false })
  assert.ok(coast.telemetry().speed < 0.01)
  const distances = []
  for (const gravity of [3.71, 9.81]) {
    const body = rover('floor-rock', gravity)
    body.velocity.z = -8
    run(body, 4, { brake: true })
    assert.ok(body.telemetry().speed < 0.01)
    distances.push(Math.abs(body.position.z))
  }
  assert.ok(distances[0] > distances[1] * 2)
  const turning = rover('sand')
  turning.velocity.z = -8
  run(turning, 7, { steer: 1, brake: true })
  assert.ok(turning.telemetry().speed < 0.05, 'Braking still works during a low-grip turn')
})
