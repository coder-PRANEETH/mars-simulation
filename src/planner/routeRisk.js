// Relative planning index, not a probability of injury or a NASA safety limit.
export function terrainRisk(grid, index, maxSlope = 20) {
  const slope = Math.min(1, (grid.slope[index] / maxSlope) ** 2)
  const roughness = Math.min(1, grid.roughness[index] / .25)
  const loose = Math.min(1, Math.max(0, 1 - (grid.groundSpeed?.[index] ?? 1)) / .6)
  const quality = grid.quality?.[index] ?? grid.analysisQuality ?? 1
  const uncertainty = Math.max(0, 1 - quality)
  return { value: Math.min(1, .5 * slope + .2 * roughness + .2 * loose + .1 * uncertainty), slope, roughness, loose, uncertainty }
}

export function riskLabel(value) {
  return value < .2 ? 'Lower' : value < .45 ? 'Moderate' : 'Higher'
}
