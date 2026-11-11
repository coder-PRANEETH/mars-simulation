import test from 'node:test'
import assert from 'node:assert/strict'
import { createTerrain } from '../terrain/terrain.js'
import { createEnvironment } from '../simulation/environment.js'
import { PlayerPhysics, CAR_CONFIG } from './PlayerPhysics.js'

function setup(flags) {
  const terrain = createTerrain({
    columns: 3, rows: 3, widthMeters: 2000, depthMeters: 2000, elevationOffset: 0,
  }, new Float32Array(9))
  terrain.surfaceFlags = Uint8Array.from(flags)
  const environment = createEnvironment(terrain, {
    getState: () => ({ gravity: 3.71, friction: 0.85, regolithSoftness: 0.3 }),
  })
  return { terrain, environment, body: new PlayerPhysics(terrain, environment, CAR_CONFIG) }
}

function run(body, forward = 1) {
  for (let i = 0; i < 1200; i++) body.step(1 / 120, { forward, yaw: 0 })
  return body.telemetry()
}

test('mapped sand and deposits slow the same car under the same throttle', () => {
  const firm = run(setup([0, 0, 0, 0]).body)
  const sand = run(setup([1, 1, 1, 1]).body)
  const deposits = run(setup([2, 2, 2, 2]).body)
  assert.equal(sand.surface.name, 'Loose sand')
  assert.ok(sand.speed < deposits.speed && deposits.speed < firm.speed)
  assert.ok(sand.speed < firm.speed * 0.5)
  assert.ok(sand.position.z > firm.position.z)
  assert.ok(run(setup([1, 1, 1, 1]).body, -1).speed < run(setup([0, 0, 0, 0]).body, -1).speed)
})

test('the surface changes with position, blends at boundaries, and restores firm-ground speed', () => {
  const { environment, body } = setup([0, 1, 0, 1])
  const left = environment.getSurfaceCondition({ x: -600, z: 0 })
  const middle = environment.getSurfaceCondition({ x: 0, z: 0 })
  const right = environment.getSurfaceCondition({ x: 600, z: 0 })
  assert.ok(left.speedFactor > middle.speedFactor && middle.speedFactor > right.speedFactor)
  body.reset({ x: 600, z: 0 })
  const sand = run(body)
  body.reset({ x: -600, z: 0 })
  const firm = run(body)
  assert.ok(firm.speed > sand.speed * 2)
})

test('topographic roughness and slopes affect driving when a material map is unavailable', () => {
  const { terrain } = setup([0, 0, 0, 0])
  terrain.surfaceFlags = null
  terrain.heights.set([0, 0, 0, 0, 170, 0, 0, 0, 0])
  const condition = createEnvironment(terrain).getSurfaceCondition({ x: -500, z: -500 })
  assert.equal(condition.name, 'Rocky ground')
  assert.ok(condition.speedFactor < 0.7)
})
