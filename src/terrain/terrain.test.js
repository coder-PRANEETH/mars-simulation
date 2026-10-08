import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Vector3 } from 'three'
import { createTerrain } from './terrain.js'

const metadata = JSON.parse(readFileSync(new URL('../../public/terrain/metadata.json', import.meta.url), 'utf8'))
const data = readFileSync(new URL('../../public/terrain/heights.bin', import.meta.url))
const heights = new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
const terrain = createTerrain(metadata, heights)
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`)

test('shipped terrain preserves independently read original PDS elevations at crop corners and center', () => {
  const halfWidth = metadata.widthMeters / 2
  const halfDepth = metadata.depthMeters / 2
  // Values independently read from the original HiRISE DTM .IMG, prior to packaging.
  close(terrain.getElevation(-halfWidth, -halfDepth), -789.42919921875)
  close(terrain.getElevation(halfWidth, -halfDepth), -725.4089965820312)
  close(terrain.getElevation(-halfWidth, halfDepth), -825.8577270507812)
  close(terrain.getElevation(halfWidth, halfDepth), -604.3015747070312)
  close(terrain.getElevation(0, 0), -497.99560546875)
  assert.ok(heights.every(Number.isFinite))
  assert.equal(heights.length, 401 * 401)
})

test('collision interpolation follows both actual mesh triangles rather than a bilinear surface', () => {
  const saddle = createTerrain({ columns: 2, rows: 2, widthMeters: 2, depthMeters: 2, elevationOffset: 0 }, new Float32Array([0, 0, 0, 4]))
  close(saddle.sampleHeight(-0.5, -0.5), 0)
  close(saddle.sampleHeight(0, 0), 0)
  close(saddle.sampleHeight(0.5, 0.5), 2)
  close(saddle.sampleHeight(1, 1), 4)
  assert.ok(saddle.sampleNormal(-0.5, -0.5).equals(new Vector3(0, 1, 0)))
  assert.ok(saddle.sampleNormal(0.5, 0.5).distanceTo(new Vector3(-2, 1, -2).normalize()) < 1e-10)
  close(saddle.sampleSlope(0.5, 0.5), Math.atan(Math.sqrt(8)) * 180 / Math.PI)
})

test('scientific coordinates map crop corners to the documented source bounds', () => {
  const northwest = terrain.coordinates(-metadata.widthMeters / 2, -metadata.depthMeters / 2)
  const southeast = terrain.coordinates(metadata.widthMeters / 2, metadata.depthMeters / 2)
  close(northwest.latitude, metadata.latitudeNorth, 1e-10)
  close(northwest.longitude, metadata.longitudeWest, 1e-10)
  close(southeast.latitude, metadata.latitudeSouth, 1e-10)
  close(southeast.longitude, metadata.longitudeEast, 1e-10)
  close(metadata.meshResolutionMeters, metadata.originalResolutionMeters * 3, 1e-10)
  assert.ok(metadata.areaSquareKilometers >= 2 && metadata.areaSquareKilometers <= 10)
})

test('source heightfield normals remain upward and agree with slope for real terrain', () => {
  for (const [x, z] of [[0, 0], [-400, -200], [250, 250], [-900, 800], [600, -450]]) {
    const normal = terrain.sampleNormal(x, z)
    close(normal.length(), 1)
    assert.ok(normal.y > 0)
    close(Math.acos(normal.y) * 180 / Math.PI, terrain.sampleSlope(x, z))
  }
  assert.ok(terrain.sampleSlope(0, 0) < 8, 'Center datum post remains a measured gentle surface')
})

test('default spawn is gentle terrain below a visible real hill', () => {
  const { x, z, yaw } = metadata.spawn
  assert.ok(terrain.contains(x, z, 300), 'Player starts safely inside the measured crop')
  assert.ok(terrain.sampleSlope(x, z) < 12, 'Starting point permits walking and jumping')
  const forwardX = -Math.sin(yaw)
  const forwardZ = -Math.cos(yaw)
  close(metadata.spawn.headingDegrees, ((-yaw * 180 / Math.PI) % 360 + 360) % 360)
  const ahead = terrain.sampleHeight(x + forwardX * 200, z + forwardZ * 200)
  assert.ok(ahead - terrain.sampleHeight(x, z) > 20, 'Actual measured relief should be visible ahead')
})
