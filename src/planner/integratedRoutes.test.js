import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTerrain } from '../terrain/terrain.js'
import { buildGrid, cellAt } from './terrainGrid.js'
import { planRoutes } from './route.js'
import { contactTargets } from './scienceContacts.js'

const base = { maxSlope: 35, pace: 1, dustPenalty: 0, scienceStop: 'auto', eva: { model: 'pandolf', responseSeconds: 0, taskMinutes: 0 } }

test('energy A* chooses a longer, flatter route when it saves metabolic energy', () => {
  const n = 11
  const heights = Float32Array.from({ length: n*n }, (_, i) => {
    const c = i % n, r = Math.floor(i/n)
    return r >= 3 && r <= 7 && c >= 3 && c <= 7 ? c % 2 * 2 : 0
  })
  const grid = buildGrid(createTerrain({ columns: n, rows: n, widthMeters: 100, depthMeters: 100, elevationOffset: 0 }, heights))
  const routes = planRoutes(grid, { start: 50, end: 59, profile: base })
  assert.ok(routes.energy.distance > routes.terrain.distance)
  assert.ok(routes.energy.energyJ < routes.terrain.energyJ * .8)
})

test('derived science targets cross registered delta contacts and exclude major mapped cover', () => {
  const grid = buildGrid(createTerrain({ columns: 7, rows: 7, widthMeters: 60, depthMeters: 60, elevationOffset: 0 }, new Float32Array(49)))
  grid.photoUnits = { 1: { id: 1, symbol: 'D-tnl', group: 'delta' }, 2: { id: 2, symbol: 'Cf-f-1', group: 'floor' } }
  grid.photoUnitIds = Uint8Array.from({ length: 36 }, (_, i) => i % 6 < 3 ? 1 : 2)
  grid.coverIds = new Uint8Array(36)
  const targets = contactTargets(grid, 12, 17, base, new Set())
  assert.equal(targets.length, 1)
  const routes = planRoutes(grid, { start: 12, end: 17, profile: base })
  assert.equal(routes.science.stop.kind, 'contact')
  const cells = routes.science.points.map((p) => cellAt(grid, p))
  assert.ok(targets[0].cells.every((cell) => cells.includes(cell)))
  assert.ok(routes.science.contacts.length > 0)
  grid.coverIds.fill(2)
  assert.equal(contactTargets(grid, 12, 17, base, new Set()).length, 0)
})

test('science compares benefit with detour energy and obeys enabled supply limits', () => {
  const grid = buildGrid(createTerrain({ columns: 7, rows: 7, widthMeters: 60, depthMeters: 60, elevationOffset: 0 }, new Float32Array(49)))
  const sites = [{ cell: 35, name: 'Far site', habitability: 5 }, { cell: 8, name: 'Near site', habitability: 5 }]
  const options = { start: 0, end: 5, sites, profile: { ...base, objective: 'habitability' } }
  assert.equal(planRoutes(grid, options).science.stop.name, 'Near site')
  options.profile = { ...base, requireBudget: true, eva: { ...base.eva, oxygenLitres: .01 } }
  assert.equal(planRoutes(grid, options).science, null)
})
