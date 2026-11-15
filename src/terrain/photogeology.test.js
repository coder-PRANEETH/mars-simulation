import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createTerrain } from './terrain.js'
import { attachPhotogeology, fieldGeologyAt } from './photogeology.js'
import { buildGrid } from '../planner/terrainGrid.js'
import { materialAtCell } from './materials.js'

function load(name) {
  const base = `public/${name}`
  const meta = JSON.parse(readFileSync(`${base}/metadata.json`))
  const heights = readFileSync(`${base}/heights.bin`)
  const terrain = createTerrain(meta, new Float32Array(heights.buffer.slice(heights.byteOffset, heights.byteOffset + heights.byteLength)))
  const buffer = (file) => { const b = readFileSync(`${base}/${file}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }
  return attachPhotogeology(terrain, JSON.parse(readFileSync(`${base}/photogeology.json`)), buffer('photogeology-grid.bin'), buffer('cover-grid.bin'))
}

test('regional measured terrain encloses the full field map and retains all 15 registered bedrock units', () => {
  const terrain = load('jezero-regional')
  assert.ok(terrain.metadata.areaKm2 > 370)
  assert.ok(terrain.heights.every(Number.isFinite))
  assert.equal(terrain.photogeology.units.length, 15)
  assert.ok(terrain.photogeology.units.every((u) => u.cellCount > 0))
  assert.equal(terrain.photoGrid.length, (terrain.metadata.columns - 1) * (terrain.metadata.rows - 1))
  const grid = buildGrid(terrain)
  for (const cover of terrain.photogeology.covers) {
    assert.match(cover.color, /^#[a-f0-9]{6}$/i)
    const index = terrain.coverGrid.indexOf(cover.id)
    assert.ok(index >= 0, cover.label)
    assert.equal(materialAtCell(grid, index).speedFactor, cover.material === 'sand' ? .42 : materialAtCell(grid, index).speedFactor)
  }
})

test('fine and regional classifications agree at known source-registered landing coordinates', () => {
  const results = ['jezero', 'jezero-regional'].map((name) => {
    const terrain = load(name)
    return fieldGeologyAt(terrain, terrain.location(18.44462715, 77.45088572))
  })
  assert.equal(results[0].bedrock.symbol, 'Cf-fr')
  assert.equal(results[1].bedrock.symbol, 'Cf-fr')
  assert.match(results[0].bedrock.interpretation, /./)
})
