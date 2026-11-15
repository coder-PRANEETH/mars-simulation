import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EVA_DEFAULTS, effortWatts, emptyBudget, advanceBudget, walkingSpeed, forecastEVA } from './eva.js'

test('Pandolf uses kilograms, metres per second and percent grade with an explicit downhill baseline', () => {
  const s = { ...EVA_DEFAULTS, model: 'pandolf' }
  assert.ok(Math.abs(effortWatts(1, 0, 1, s) - 411.111111111) < 1e-6)
  assert.ok(Math.abs(effortWatts(1, .1, 1, s) - 848.611111111) < 1e-6)
  assert.equal(effortWatts(1, -.1, 1, s), effortWatts(1, 0, 1, s))
  assert.ok(walkingSpeed(1, .1, 1.5) < walkingSpeed(1, .1, 1))
})

test('workload lag integrates energy exactly and preserves cooling balance across time steps', () => {
  const s = { ...EVA_DEFAULTS, responseSeconds: 30 }
  const single = advanceBudget(emptyBudget(), 600, 500, s)
  let split = emptyBudget()
  for (let i = 0; i < 600; i++) split = advanceBudget(split, 1, 500, s)
  const expected = 500 * 600 + (150 - 500) * 30 * (1 - Math.exp(-20))
  assert.ok(Math.abs(single.energyJ - expected) < 1e-6)
  assert.ok(Math.abs(single.energyJ - split.energyJ) < 1e-6)
  assert.ok(Math.abs(single.heatJ - split.heatJ) < 1e-6)
  const cooling = advanceBudget(single, 600, 150, s)
  assert.equal(cooling.heatJ, 0)
  assert.ok(cooling.peakHeatJ > single.heatJ) // residual demand before cooling crosses
  assert.ok(cooling.workloadWatts < 151)
})

test('changing the research model changes the complete route oxygen and thermal forecast', () => {
  const route = { points: [{ x: 0, y: 0, z: 0 }, { x: 300, y: 30, z: 0 }], waypoints: [] }
  const reference = forecastEVA(route)
  const research = forecastEVA(route, { model: 'pandolf' })
  assert.ok(research.oxygenUsed > reference.oxygenUsed)
  assert.ok(research.peakWatts > reference.peakWatts)
  assert.ok(research.peakHeatJ > reference.peakHeatJ)
})
