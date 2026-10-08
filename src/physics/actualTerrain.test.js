import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createTerrain } from '../terrain/terrain.js'
import { PlayerPhysics, PLAYER_CONFIG } from './PlayerPhysics.js'

// These checks exercise the shipped measured HiRISE mesh, including its real
// triangle boundaries, rather than only idealized synthetic test surfaces.
const metadata = JSON.parse(readFileSync(new URL('../../public/terrain/metadata.json', import.meta.url), 'utf8'))
const binary = readFileSync(new URL('../../public/terrain/heights.bin', import.meta.url))
const heights = new Float32Array(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength))
const terrain = createTerrain(metadata, heights)
const dt = PLAYER_CONFIG.fixedStep

function environment(initial = {}) {
  const state = { gravity: 3.71, friction: 0.85, regolithSoftness: 0.3, ...initial }
  return {
    state,
    getGravity: () => state.gravity,
    getSurfaceFriction: () => state.friction * (1 - 0.45 * state.regolithSoftness),
    getRegolithSoftness: () => state.regolithSoftness,
  }
}

test('walking, sprinting and jumping across the actual DEM keep feet above the visual surface', () => {
  let minimumElevation = Infinity
  let maximumElevation = -Infinity
  let maximumSlope = 0
  let landings = 0
  for (let direction = 0; direction < 12; direction++) {
    const body = new PlayerPhysics(terrain, environment())
    for (let step = 0; step < 120 * 45; step++) {
      body.step(dt, {
        forward: 1, yaw: direction * Math.PI / 6, sprint: true,
        jump: step % (120 * 8) === 600,
      })
      const surface = terrain.sampleHeight(body.position.x, body.position.z)
      const clearance = body.position.y - surface
      assert.ok(clearance >= PLAYER_CONFIG.contactMargin - 1e-8)
      if (body.grounded) assert.ok(Math.abs(clearance - PLAYER_CONFIG.contactMargin) < 1e-8)
      const elevation = terrain.getElevation(body.position.x, body.position.z)
      minimumElevation = Math.min(minimumElevation, elevation)
      maximumElevation = Math.max(maximumElevation, elevation)
      maximumSlope = Math.max(maximumSlope, terrain.sampleSlope(body.position.x, body.position.z))
    }
    landings += body.landingCount
    assert.ok(Math.hypot(body.position.x, body.position.z) > 100)
    const coordinates = terrain.coordinates(body.position.x, body.position.z)
    assert.equal(body.telemetry().latitude, coordinates.latitude)
    assert.equal(body.telemetry().longitude, coordinates.longitude)
  }
  assert.ok(maximumElevation - minimumElevation > 30)
  assert.ok(maximumSlope > 15)
  assert.ok(landings >= 60)
})

test('actual Mars terrain preserves the expected Earth, Mars and Moon jump durations', () => {
  const measurements = []
  for (const gravity of [9.81, 3.71, 1.62]) {
    const body = new PlayerPhysics(terrain, environment({ gravity }))
    body.step(dt, { jump: true })
    let maximumAltitude = 0
    while (!body.grounded && body.elapsed < 10) {
      maximumAltitude = Math.max(maximumAltitude, body.telemetry().altitude)
      body.step(dt)
    }
    assert.ok(body.grounded)
    assert.ok(Math.abs(maximumAltitude - PLAYER_CONFIG.jumpSpeed ** 2 / (2 * gravity)) < 0.04)
    assert.ok(Math.abs(body.lastAirborneTime - 2 * PLAYER_CONFIG.jumpSpeed / gravity) < 0.025)
    measurements.push({ altitude: maximumAltitude, duration: body.lastAirborneTime })
  }
  assert.ok(measurements[1].duration > measurements[0].duration * 2.5)
  assert.ok(measurements[2].duration > measurements[1].duration * 2)
})

test('low traction slides downhill on a measured Martian slope while high traction holds', () => {
  let slopePoint
  for (let z = -500; z <= 500 && !slopePoint; z += 10) {
    for (let x = -500; x <= 500; x += 10) {
      const slope = terrain.sampleSlope(x, z)
      if (slope > 17 && slope < 23) { slopePoint = { x, z }; break }
    }
  }
  assert.ok(slopePoint, 'The shipped terrain must contain an actual moderate slope')
  const grippy = new PlayerPhysics(terrain, environment({ friction: 1.2, regolithSoftness: 0 }))
  const loose = new PlayerPhysics(terrain, environment({ friction: 0.1, regolithSoftness: 1 }))
  grippy.reset(slopePoint)
  loose.reset(slopePoint)
  for (let step = 0; step < 120 * 2; step++) {
    grippy.step(dt)
    loose.step(dt)
  }
  assert.ok(Math.hypot(grippy.position.x - slopePoint.x, grippy.position.z - slopePoint.z) < 1e-8)
  assert.ok(Math.hypot(loose.position.x - slopePoint.x, loose.position.z - slopePoint.z) > 0.5)
  assert.ok(loose.position.y < grippy.position.y)
  assert.ok(loose.grounded)
})
