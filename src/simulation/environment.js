import { simulationStore } from './store.js';

// Shared by the walker, dust renderer and future vehicles. Coordinates are local
// metres: +x east, +z south, +y up; bearings run clockwise from north.
export function createEnvironment(terrain, store = simulationStore) {
  return {
    getState: store.getState,
    getGravity: () => store.getState().gravity,
    getSurfaceFriction: () => store.getState().friction * (1 - 0.45 * store.getState().regolithSoftness),
    getRegolithSoftness: () => store.getState().regolithSoftness,
    getSlope: ({ x, z }) => terrain.sampleSlope(x, z),
    getTerrainHeight: ({ x, z }) => terrain.sampleHeight(x, z),
    getTemperature: () => store.getState().temperature,
    getWind() {
      const { windSpeed, windDirection, atmosphericDensity } = store.getState();
      const radians = windDirection * Math.PI / 180;
      return { speed: windSpeed / 3.6, direction: windDirection, x: Math.sin(radians) * windSpeed / 3.6, z: -Math.cos(radians) * windSpeed / 3.6, atmosphericDensity };
    },
  };
}
