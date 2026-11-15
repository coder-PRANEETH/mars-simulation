import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RoutePilot, motorWatts } from './routePilot.js'
import { createTerrain } from '../terrain/terrain.js'
import { CAR_CONFIG, PlayerPhysics } from '../physics/PlayerPhysics.js'

function body(driving = false) {
  const terrain = createTerrain({ columns: 3, rows: 3, widthMeters: 300, depthMeters: 300, elevationOffset: 0 }, new Float32Array(9))
  const environment = { getGravity: () => 3.71, getRegolithSoftness: () => 0, getSurfaceFriction: () => .85,
    getSurfaceCondition: () => ({ speedFactor: 1, gripFactor: 1, sinkDepth: 0, effortTerrain: 1 }) }
  return new PlayerPhysics(terrain, environment, driving ? CAR_CONFIG : { walkSpeed: 1.2, budgetedWalk: true })
}

for (const driving of [false, true]) test(`${driving ? 'rover' : 'walker'} follows a bend through actual physics and stops at destination`, () => {
  const player = body(driving)
  const route = { points: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -20 }, { x: 15, y: 0, z: -35 }], walkPace: 1.2 }
  const pilot = new RoutePilot(route, driving)
  let previous = 0
  for (let i = 0; i < 120 * 120 && pilot.status === 'Following route'; i++) {
    const command = pilot.controls(player, 1/120)
    player.step(1/120, command)
    pilot.record(player, 1/120, true)
    assert.ok(pilot.progress >= previous)
    previous = pilot.progress
  }
  assert.equal(pilot.status, 'Complete', pilot.reason)
  assert.ok(Math.hypot(player.position.x - 15, player.position.z + 35) < (driving ? 1.5 : .5))
  assert.ok(pilot.energyJ > 0)
  assert.ok(Math.hypot(player.velocity.x, player.velocity.z) < .2)
  const energy = pilot.energyJ
  pilot.record(player, 10, false)
  assert.equal(pilot.energyJ, energy)
})

test('a reversing contact transect is completed without teleporting', () => {
  const player = body(true)
  const pilot = new RoutePilot({ points: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -12 }, { x: 0, y: 0, z: -4 }] }, true)
  for (let i=0; i<120*90 && pilot.status === 'Following route'; i++) {
    player.step(1/120, pilot.controls(player, 1/120)); pilot.record(player,1/120,true)
  }
  assert.equal(pilot.status, 'Complete', pilot.reason)
  assert.ok(player.position.z < -2.5 && player.position.z > -5.5)
})

test('off-route movement stops automation and loose ground costs more model motor energy', () => {
  const player = body(true)
  const pilot = new RoutePilot({ points: [{x:0,y:0,z:0},{x:0,y:0,z:-20}] }, true)
  player.position.x = 12
  assert.equal(pilot.controls(player,.1).brake,true)
  assert.equal(pilot.status,'Blocked')
  player.velocity.z = -2; player.velocity.y = 0; player.currentSurface={speedFactor:1}
  const firm=motorWatts(player)
  player.currentSurface={speedFactor:.42}
  assert.ok(motorWatts(player)>firm)
})


test('motor acceleration energy has the same sign in forward and reverse travel', () => {
  const player=body(true)
  player.currentSurface={speedFactor:1}; player.velocity.z=-2; player.forwardSpeed=2; player.longitudinalAcceleration=1
  const forward=motorWatts(player)
  player.velocity.z=2; player.forwardSpeed=-2; player.longitudinalAcceleration=-1
  assert.equal(motorWatts(player),forward)
})
