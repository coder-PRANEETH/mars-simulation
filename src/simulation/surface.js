import { buildGrid } from '../planner/terrainGrid.js'

export const FIRM_SURFACE = Object.freeze({ name: 'Firm ground', speedFactor: 1, gripFactor: 1 })

/** Driving coefficients are illustrative responses to the mapped surface and DEM. */
export function createSurfaceSampler(terrain) {
  if (!terrain.heights || !terrain.metadata?.columns) return () => FIRM_SURFACE
  const grid = buildGrid(terrain, terrain.surfaceFlags)
  const { width, height, dx, dz, roughness, slope, surface } = grid

  return ({ x, z }) => {
    // Interpolate cell values so both sides of a mapped boundary blend smoothly.
    const column = Math.max(0, Math.min(width - 1, x / dx + width / 2 - 0.5))
    const row = Math.max(0, Math.min(height - 1, z / dz + height / 2 - 0.5))
    const c = Math.floor(column), r = Math.floor(row)
    const nextC = Math.min(width - 1, c + 1), nextR = Math.min(height - 1, r + 1)
    const u = column - c, v = row - r
    const indices = [r * width + c, r * width + nextC, nextR * width + c, nextR * width + nextC]
    const weights = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v]
    let sand = 0, deposits = 0, uneven = 0, incline = 0
    for (let i = 0; i < 4; i++) {
      const index = indices[i]
      sand += (surface?.[index] & 1 ? 1 : 0) * weights[i]
      deposits += (surface?.[index] & 2 ? 1 : 0) * weights[i]
      uneven += roughness[index] * weights[i]
      incline += slope[index] * weights[i]
    }
    const rough = Math.min(1, uneven * 4)
    const groundSpeed = Math.min(1 - sand * 0.58, 1 - deposits * 0.25) * (1 - rough * 0.38)
    const slopeSpeed = 1 / (1 + (incline / 26) ** 2)
    const name = sand > 0.5 ? 'Loose sand' : deposits > 0.5 ? 'Surface deposits'
      : rough > 0.35 ? 'Rocky ground' : incline > 12 ? 'Steep ground' : 'Firm ground'
    return {
      name,
      speedFactor: Math.max(0.2, groundSpeed * slopeSpeed),
      gripFactor: Math.max(0.45, 1 - sand * 0.34 - deposits * 0.13 - rough * 0.12),
    }
  }
}
