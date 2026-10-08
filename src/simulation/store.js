import { useSyncExternalStore } from 'react';

// Representative environmental values, not a weather report for the DEM epoch.
// Friction, softness and dust levels are adjustable game-model coefficients.
export const PRESETS = {
  'realistic-mars': { gravity: 3.71, atmosphericDensity: 0.016, windSpeed: 18, windDirection: 245, temperature: -63, dustLevel: 'medium', regolithSoftness: 0.3, friction: 0.85 },
  'earth-physics': { gravity: 9.81, atmosphericDensity: 1.225, windSpeed: 10, windDirection: 245, temperature: 15, dustLevel: 'low', regolithSoftness: 0.15, friction: 1.0 },
  'moon-like': { gravity: 1.62, atmosphericDensity: 0, windSpeed: 0, windDirection: 245, temperature: -80, dustLevel: 'none', regolithSoftness: 0.45, friction: 0.75 },
};

const limits = {
  gravity: [0.5, 15], atmosphericDensity: [0, 1.225], windSpeed: [0, 150],
  windDirection: [0, 360], temperature: [-130, 30], regolithSoftness: [0, 1], friction: [0.1, 1.5],
};
let state = { ...PRESETS['realistic-mars'], preset: 'realistic-mars' };
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

export const simulationStore = {
  getState: () => state,
  subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  setParameter(key, value) {
    if (key === 'dustLevel') {
      if (!['none', 'low', 'medium', 'high', 'storm'].includes(value)) return;
    } else {
      if (!limits[key] || !Number.isFinite(Number(value))) return;
      value = Math.min(limits[key][1], Math.max(limits[key][0], Number(value)));
    }
    state = { ...state, [key]: value, preset: 'custom' };
    emit();
  },
  applyPreset(name) {
    if (name === 'custom') state = { ...state, preset: name };
    else if (PRESETS[name]) state = { ...PRESETS[name], preset: name };
    else return;
    emit();
  },
};

export function useSimulation() {
  return useSyncExternalStore(simulationStore.subscribe, simulationStore.getState);
}
