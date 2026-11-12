import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createTerrain } from './terrain.js'
import { attachGeology, geologicUnitAt } from './geology.js'

const read = (region, file) => readFileSync(new URL(`../../public/${region}/${file}`, import.meta.url))
function load(region) {
  const metadata = JSON.parse(read(region, 'metadata.json'))
  const binary = read(region, 'heights.bin')
  const terrain = createTerrain(metadata, new Float32Array(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength)))
  return attachGeology(terrain, JSON.parse(read(region, 'geology.json')), new Uint8Array(read(region, 'geology-grid.bin')))
}

test('registered cells preserve published unit identities at six independent map locations', () => {
  const terrain = load('jezero')
  // Representative coordinates read from the source geodatabase, not the raster.
  for (const [longitude, latitude, symbol] of [
    [77.393924, 18.454895, 'NHjf2'], [77.419827, 18.451059, 'Njf'],
    [77.434331, 18.443470, 'Nle'], [77.362490, 18.435140, 'Aeb'],
    [77.398287, 18.436684, 'Nue'], [77.383993, 18.475752, 'cr'],
  ]) assert.equal(geologicUnitAt(terrain, terrain.location(latitude, longitude))?.symbol, symbol)
  assert.equal(terrain.geologyGrid.length, (terrain.metadata.rows - 1) * (terrain.metadata.columns - 1))
  assert.equal(terrain.geology.coverageCellCount, terrain.geologyGrid.length)
  assert.ok(terrain.geologyGrid.every((id) => terrain.geologicUnits[id]))
  assert.equal(geologicUnitAt(terrain, { x: terrain.metadata.widthMeters, z: 0 }), null)
})

test('an uncovered region or corrupt registration stays explicitly unmapped', () => {
  const terrain = load('terrain')
  assert.equal(terrain.geology.coverageCellCount, 0)
  assert.equal(geologicUnitAt(terrain, { x: 0, z: 0 }), null)
  const jezero = load('jezero')
  attachGeology(jezero, jezero.geology, new Uint8Array(10))
  assert.equal(geologicUnitAt(jezero, { x: 0, z: 0 }), null)
})
