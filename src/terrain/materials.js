// Educational handling assumptions, not measured geotechnical properties.
// Sink depth is a bounded visual wheel-settling model in metres.
export const SURFACE_MODELS = Object.freeze({
  unknown: { name: 'Unmapped surface', speedFactor: 1, gripFactor: 1, sinkDepth: 0 },
  'floor-rock': { name: 'Crater-floor rock', speedFactor: 1, gripFactor: 1, sinkDepth: 0 },
  'layered-rock': { name: 'Layered rock', speedFactor: 0.84, gripFactor: 0.92, sinkDepth: 0 },
  'etched-rock': { name: 'Eroded rock', speedFactor: 0.76, gripFactor: 0.88, sinkDepth: 0 },
  'broken-rock': { name: 'Broken rock', speedFactor: 0.67, gripFactor: 0.86, sinkDepth: 0 },
  'mixed-rock': { name: 'Mixed rock terrain', speedFactor: 0.88, gripFactor: 0.94, sinkDepth: 0 },
  sand: { name: 'Loose sand', speedFactor: 0.42, gripFactor: 0.64, sinkDepth: 0.16 },
  'loose-cover': { name: 'Loose surface cover', speedFactor: 0.70, gripFactor: 0.78, sinkDepth: 0.07 },
  mantle: { name: 'Wind-blown deposits', speedFactor: 0.75, gripFactor: 0.80, sinkDepth: 0.055 },
})

export function materialAtCell(grid, index) {
  // Surface cover can lie over a different underlying geological unit.
  const flags = grid.surface?.[index] ?? 0
  if (flags & 1) return SURFACE_MODELS.sand
  if (flags & 2) return SURFACE_MODELS.mantle
  return SURFACE_MODELS[grid.units?.[grid.unitIds?.[index]]?.material] ?? SURFACE_MODELS.unknown
}
