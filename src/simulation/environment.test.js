import test from 'node:test';
import assert from 'node:assert/strict';
import { simulationStore } from './store.js';
import { createEnvironment } from './environment.js';

const terrain = { sampleHeight: (x, z) => x + z, sampleSlope: () => 12 };

test('existing environment objects read live central simulation parameters', () => {
  simulationStore.applyPreset('realistic-mars');
  const environment = createEnvironment(terrain);
  assert.equal(environment.getGravity(), 3.71);
  simulationStore.setParameter('gravity', 9.81);
  assert.equal(environment.getGravity(), 9.81);
  assert.equal(environment.getState().preset, 'custom');
  simulationStore.setParameter('regolithSoftness', 1);
  simulationStore.setParameter('friction', 1);
  assert.equal(environment.getSurfaceFriction({ x: 10, z: 0 }), 0.55);
  assert.equal(environment.getTerrainHeight({ x: 10, z: 5 }), 15);
  assert.equal(environment.getSlope({ x: 10, z: 5 }), 12);
});

test('wind has explicit SI units and clockwise-from-north world directions', () => {
  const environment = createEnvironment(terrain);
  simulationStore.setParameter('windSpeed', 36);
  simulationStore.setParameter('windDirection', 90);
  assert.equal(environment.getWind().speed, 10);
  assert.ok(Math.abs(environment.getWind().x - 10) < 1e-12);
  assert.ok(Math.abs(environment.getWind().z) < 1e-12);
  simulationStore.setParameter('windDirection', 0);
  assert.equal(environment.getWind().z, -10);
});

test('the parameter API rejects invalid keys and values and clamps supported bounds', () => {
  simulationStore.setParameter('gravity', 99);
  assert.equal(simulationStore.getState().gravity, 15);
  simulationStore.setParameter('gravity', NaN);
  simulationStore.setParameter('untrusted', 123);
  simulationStore.setParameter('dustLevel', 'invalid');
  assert.equal(simulationStore.getState().gravity, 15);
  assert.equal(simulationStore.getState().untrusted, undefined);
  simulationStore.applyPreset('realistic-mars');
  assert.equal(simulationStore.getState().dustLevel, 'medium');
});
