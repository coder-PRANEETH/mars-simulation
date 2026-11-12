import { buildGrid } from '../planner/terrainGrid.js'
import { materialAtCell } from '../terrain/materials.js'

export const FIRM_SURFACE = Object.freeze({ name: 'Firm ground', speedFactor: 1, gripFactor: 1, sinkDepth: 0, unit: null })

/** Published units and cover observations drive a separate, illustrative handling model. */
export function createSurfaceSampler(terrain) {
  if (!terrain.heights || !terrain.metadata?.columns) return () => FIRM_SURFACE
  const grid = buildGrid(terrain)
  const { width, height, dx, dz, roughness, slope } = grid

  return ({ x, z }) => {
    const column = Math.max(0, Math.min(width - 1, x / dx + width / 2 - 0.5))
    const row = Math.max(0, Math.min(height - 1, z / dz + height / 2 - 0.5))
    const c = Math.floor(column), r = Math.floor(row)
    const nextC = Math.min(width - 1, c + 1), nextR = Math.min(height - 1, r + 1)
    const u = column - c, v = row - r
    const indices = [r * width + c, r * width + nextC, nextR * width + c, nextR * width + nextC]
    const weights = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v]
    let groundSpeed = 0, groundGrip = 0, sinkDepth = 0, uneven = 0, incline = 0
    for (let i = 0; i < 4; i++) {
      const index = indices[i]
      const material = materialAtCell(grid, index)
      groundSpeed += material.speedFactor * weights[i]
      groundGrip += material.gripFactor * weights[i]
      sinkDepth += material.sinkDepth * weights[i]
      uneven += roughness[index] * weights[i]
      incline += slope[index] * weights[i]
    }
    const actualColumn = Math.floor(x / dx + width / 2)
    const actualRow = Math.floor(z / dz + height / 2)
    const inside = actualColumn >= 0 && actualColumn < width && actualRow >= 0 && actualRow < height
    const cell = inside ? actualRow * width + actualColumn : -1
    const unit = grid.units[grid.unitIds?.[cell]] ?? null
    const material = materialAtCell(grid, cell)
    const rough = Math.min(1, uneven * 4)
    const name = material.name === 'Unmapped surface'
      ? rough > 0.35 ? 'Rocky ground' : incline > 12 ? 'Steep ground' : material.name
      : material.name
    return {
      name, unit, mapped: !!unit, surfaceMapped: !!grid.surface?.[cell], modeled: true,
      speedFactor: Math.max(0.2, groundSpeed * (1 - rough * 0.38) / (1 + (incline / 26) ** 2)),
      gripFactor: Math.max(0.45, groundGrip * (1 - rough * 0.12)),
      sinkDepth, roughness: rough, slope: incline,
    }
  }
}
