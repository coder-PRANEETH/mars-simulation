import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EVA_DEFAULTS, JOULES_PER_LITRE_O2, effortWatts, transitionSpeed, advanceBudget, emptyBudget, forecastEVA, returnBudget } from './eva.js'

const route = { points: [{ x: 0, y: 0, z: 0 }, { x: 600, y: 0, z: 0 }], waypoints: [] }
test('EVA units, gait estimate and cooling obey explicit energy balances', () => {
  assert.ok(Math.abs(transitionSpeed() - 1.29209) < .0001)
  assert.equal(effortWatts(1), 350)
  assert.ok(effortWatts(1, .1) > effortWatts(1))
  assert.ok(effortWatts(1, 0, 1.3) > effortWatts(1))
  assert.ok(effortWatts(1, 0, 1, { ...EVA_DEFAULTS, suitKg: 100 }) > effortWatts(1))
  const warm = advanceBudget(emptyBudget(), 60, 500, EVA_DEFAULTS)
  assert.equal(warm.heatJ, 3000)
  assert.equal(warm.oxygenUsed, 30000 / JOULES_PER_LITRE_O2)
  const cooled = advanceBudget(warm, 60, 150, EVA_DEFAULTS)
  assert.equal(cooled.heatJ, 0)
  assert.equal(cooled.peakHeatJ, 3000)
})

test('EVA forecast budgets science, directional return, reserve and rejects insufficient supplies', () => {
  const plan = forecastEVA(route)
  assert.equal(plan.elapsed, 2400) // 10 min out + 20 work + 10 back
  assert.equal(plan.returnSeconds, 600)
  assert.equal(plan.oxygenUsed, 350 * 2400 / JOULES_PER_LITRE_O2)
  assert.equal(plan.reserveOxygen, 350 * 1800 / JOULES_PER_LITRE_O2)
  assert.equal(plan.feasible, true)
  assert.equal(forecastEVA(route, { oxygenLitres: 50 }).feasible, false)
  assert.equal(forecastEVA(route, { durationMinutes: 45 }).feasible, false)
  assert.equal(forecastEVA(route, { coolingWatts: 150 }).feasible, false)
  const short = forecastEVA(route, { oxygenLitres: 50 })
  assert.equal(short.returnChecks.at(-1).canReturn, false)
  const slope = { ...route, points: [{ x: 0, y: 0, z: 0 }, { x: 600, y: 60, z: 0 }] }
  const climb = forecastEVA(slope)
  assert.ok(climb.outward.elapsed > climb.returnSeconds + 1200)
  assert.ok(returnBudget(slope.points, EVA_DEFAULTS).elapsed < 700)
})

test('a long route cannot meet the chosen shelter scenario even with abundant oxygen and time', () => {
  const long = { ...route, points: [{ x: 0, y: 0, z: 0 }, { x: 7500, y: 0, z: 0 }] }
  assert.ok(forecastEVA(long, { oxygenLitres: 2000, durationMinutes: 600 }).reasons.some(reason => reason.includes('shelter')))
})
