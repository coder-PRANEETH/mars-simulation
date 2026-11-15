/** Independent IDs: never mix the Stack field map with the broader USGS unit IDs. */
export function attachPhotogeology(terrain, data, ids, coverIds) {
  const count = (terrain.metadata.columns - 1) * (terrain.metadata.rows - 1)
  terrain.photogeology = data?.units ? data : null
  terrain.photoGrid = data && ids?.byteLength === count ? new Uint8Array(ids) : null
  terrain.coverGrid = data && coverIds?.byteLength === count ? new Uint8Array(coverIds) : null
  terrain.photoUnits = Object.fromEntries((data?.units ?? []).map(({ polygons, ...unit }) => [unit.id, unit]))
  terrain.photoCovers = Object.fromEntries((data?.covers ?? []).map((cover) => [cover.id, cover]))
  return terrain
}

export function fieldGeologyAt(terrain, { x, z }) {
  const { columns, rows, widthMeters, depthMeters } = terrain.metadata
  const c = Math.floor((x / widthMeters + .5) * (columns - 1))
  const r = Math.floor((z / depthMeters + .5) * (rows - 1))
  if (c < 0 || r < 0 || c >= columns - 1 || r >= rows - 1) return { bedrock: null, cover: null }
  const index = r * (columns - 1) + c
  return { bedrock: terrain.photoUnits?.[terrain.photoGrid?.[index]] ?? null,
    cover: terrain.photoCovers?.[terrain.coverGrid?.[index]] ?? null }
}
