/** Register the published unit IDs to the same cells used by the terrain mesh. */
export function attachGeology(terrain, geology, ids) {
  const count = (terrain.metadata.columns - 1) * (terrain.metadata.rows - 1)
  terrain.geology = geology?.units ? geology : null
  terrain.geologicUnits = Object.fromEntries((terrain.geology?.units ?? []).map((unit) => [unit.id, unit]))
  terrain.geologyGrid = terrain.geology && ids?.length === count ? ids : null
  return terrain
}

export function geologicUnitAt(terrain, { x, z }) {
  if (!terrain.geologyGrid) return null
  const { columns, rows, widthMeters, depthMeters } = terrain.metadata
  const column = Math.floor((x / widthMeters + 0.5) * (columns - 1))
  const row = Math.floor((z / depthMeters + 0.5) * (rows - 1))
  if (column < 0 || row < 0 || column >= columns - 1 || row >= rows - 1) return null
  return terrain.geologicUnits?.[terrain.geologyGrid[row * (columns - 1) + column]] ?? null
}
