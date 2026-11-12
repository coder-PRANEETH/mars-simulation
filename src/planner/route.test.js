import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTerrain } from '../terrain/terrain.js'
import { buildGrid, cellAt, cellPoint, terrainClass } from './terrainGrid.js'
import { planRoutes } from './route.js'

const profile = { maxSlope: 20, pace: 1, dustPenalty: 0 }
const metadata = { columns: 5, rows: 5, widthMeters: 40, depthMeters: 40, elevationOffset: 0 }
const flat = () => buildGrid(createTerrain(metadata, new Float32Array(25)))

test('A* avoids blocked cells and prevents diagonal passage through a blocked corner', () => {
  const grid = flat()
  const { terrain } = planRoutes(grid, { start: 0, end: 5, profile, avoid: [1] })
  assert.equal(terrain.distance, 20)
  assert.equal(planRoutes(grid, { start: 0, end: 5, profile, avoid: [1, 4] }).terrain, null)
  assert.equal(planRoutes(grid, { start: 0, end: 5, profile, avoid: [5] }).terrain, null)
})

test('science route visits the highest-priority reachable stop and reports its detour', () => {
  const grid = flat()
  const { terrain, science } = planRoutes(grid, {
    start: 0, end: 3, profile, avoid: [15],
    sites: [{ name: 'Closed', cell: 15 }, { name: 'Outcrop', cell: 9 }],
  })
  assert.equal(science.stop.name, 'Outcrop')
  assert.ok(science.distance > terrain.distance)
  assert.ok(science.waypoints.some((waypoint) => waypoint.label === 'Outcrop'))
  assert.equal(terrain.distance, 30)
  assert.equal(terrain.time, 30)
})

test('route measurements follow both surface triangles and uphill takes longer', () => {
  const heights = new Float32Array(25).map((_, index) => 2 * (index % 5))
  const grid = buildGrid(createTerrain(metadata, heights))
  const { terrain } = planRoutes(grid, { start: 0, end: 3, profile })
  assert.equal(terrain.gain, 6)
  assert.ok(Math.abs(terrain.distance - Math.hypot(30, 6)) < 1e-8)
  assert.ok(terrain.time > terrain.returnTime)
  assert.equal(terrainClass(grid, 0, 10), 'blocked')
  assert.equal(cellAt(grid, cellPoint(grid, 0)), 0)
  assert.equal(cellAt(grid, { x: 30, z: 0 }), -1)
})

test('A* detours around a sand region and accounts for its slower travel when forced through it', () => {
  const terrain = createTerrain(metadata, new Float32Array(25))
  terrain.geologyGrid = new Uint8Array(16).fill(3)
  terrain.geologyGrid[5] = terrain.geologyGrid[6] = 8
  terrain.geologicUnits = {
    3: { id: 3, label: 'Crater-floor rock', material: 'floor-rock' },
    8: { id: 8, label: 'Wind-blown sand', material: 'sand' },
  }
  const grid = buildGrid(terrain)
  const detour = planRoutes(grid, { start: 4, end: 7, profile }).terrain
  assert.ok(detour.distance > 30)
  assert.ok(detour.points.filter((_, index) => index % 2 === 0)
    .every((point) => ![5, 6].includes(cellAt(grid, point))))
  const forced = planRoutes(grid, { start: 4, end: 7, profile, avoid: [0, 1, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15] }).terrain
  assert.equal(forced.distance, 30)
  assert.ok(forced.time > 60)
  assert.ok(forced.regions.includes('Wind-blown sand'))
})
