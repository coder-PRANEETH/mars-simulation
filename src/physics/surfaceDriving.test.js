import test from 'node:test'
import assert from 'node:assert/strict'
import { createTerrain } from '../terrain/terrain.js'
import { createEnvironment } from '../simulation/environment.js'
import { PlayerPhysics, CAR_CONFIG } from './PlayerPhysics.js'
import { attachGeology } from '../terrain/geology.js'

function setup(flags, ids) {
  const terrain = createTerrain({
    columns: 3, rows: 3, widthMeters: 2000, depthMeters: 2000, elevationOffset: 0,
  }, new Float32Array(9))
  terrain.surfaceFlags = Uint8Array.from(flags)
  if (ids) attachGeology(terrain, { units: [
    { id: 3, symbol: 'Njf', label: 'Crater-floor rock', material: 'floor-rock' },
    { id: 8, symbol: 'Aeb', label: 'Wind-blown sand', material: 'sand' },
    { id: 12, symbol: 'cr', label: 'Crater rim', material: 'broken-rock' },
  ] }, Uint8Array.from(ids))
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

test('registered geological units control handling even without advisory cover flags', () => {
  const floor = run(setup([0, 0, 0, 0], [3, 3, 3, 3]).body)
  const rock = run(setup([0, 0, 0, 0], [12, 12, 12, 12]).body)
  const sand = run(setup([0, 0, 0, 0], [8, 8, 8, 8]).body)
  assert.ok(sand.speed < rock.speed && rock.speed < floor.speed)
  assert.equal(sand.surface.unit.symbol, 'Aeb')
  assert.equal(sand.surface.mapped, true)
  assert.ok(sand.wheelSlip > 0.3)
  assert.ok(sand.sinkDepth > 0.14 && sand.sinkDepth <= 0.16)
  assert.equal(floor.sinkDepth, 0)
  assert.equal(floor.wheelSlip, 0)
  // Published bedrock and overlying sand remain separate observations.
  const covered = run(setup([1, 1, 1, 1], [3, 3, 3, 3]).body)
  assert.equal(covered.surface.unit.symbol, 'Njf')
  assert.equal(covered.surface.name, 'Loose sand')
  assert.ok(covered.sinkDepth > 0.14)
})

test('wheel settling is bounded, recovers on firm ground, and does not deform source elevations', () => {
  const { terrain, body } = setup([0, 0, 0, 0], [8, 3, 8, 3])
  body.reset({ x: -600, z: 0 })
  const sand = run(body)
  assert.ok(sand.sinkDepth > 0.14)
  assert.equal(body.position.y, CAR_CONFIG.contactMargin)
  assert.ok(terrain.heights.every((height) => height === 0))
  // Move onto firm ground without resetting the settling state.
  body.position.x = 600
  for (let i = 0; i < 360; i++) body.step(1 / 120, { forward: 1 })
  assert.ok(body.sinkDepth < 0.001)
  assert.ok(body.wheelSlip < 0.001)
  assert.ok(body.telemetry().speed > sand.speed * 2)
  body.reset({ x: -600, z: 0 })
  assert.equal(body.sinkDepth, 0)
  assert.equal(body.wheelSlip, 0)
})

test('walking responds to the region without giving the walker wheel sinkage', () => {
  const firm = setup([0, 0, 0, 0], [3, 3, 3, 3])
  const sand = setup([0, 0, 0, 0], [8, 8, 8, 8])
  const firmWalker = new PlayerPhysics(firm.terrain, firm.environment)
  const sandWalker = new PlayerPhysics(sand.terrain, sand.environment)
  assert.ok(run(sandWalker).speed < run(firmWalker).speed * 0.5)
  assert.equal(sandWalker.sinkDepth, 0)
  assert.equal(sandWalker.wheelSlip, 0)
  const unknown = run(setup([0, 0, 0, 0]).body)
  assert.equal(unknown.surface.mapped, false)
  assert.equal(unknown.sinkDepth, 0)
})
