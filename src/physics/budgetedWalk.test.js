import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerPhysics } from './PlayerPhysics.js'
import { createTerrain } from '../terrain/terrain.js'
import { walkingSpeed } from '../simulation/eva.js'

test('budgeted walking converges to the same along-surface pace used in route forecasts', () => {
  const meta = { columns: 3, rows: 3, widthMeters: 100, depthMeters: 100, elevationOffset: 0 }
  const terrain = createTerrain(meta, Float32Array.from({ length: 9 }, (_, i) => i % 3 * 5))
  const env = { getGravity: () => 3.71, getRegolithSoftness: () => 0, getSurfaceFriction: () => .9,
    getSurfaceCondition: () => ({ speedFactor: .7, gripFactor: .9, sinkDepth: 0, effortTerrain: 1.5 }) }
  const player = new PlayerPhysics(terrain, env, { budgetedWalk: true, walkSpeed: 1 })
  for (let i = 0; i < 300; i++) player.step(1 / 120, { forward: 1, yaw: -Math.PI / 2 })
  const actual = Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z)
  assert.ok(Math.abs(actual - walkingSpeed(1, .1, 1.5)) < 1e-6)
})
