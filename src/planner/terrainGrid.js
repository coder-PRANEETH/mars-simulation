import { materialAtCell } from '../terrain/materials.js'

const degrees = 180 / Math.PI

// Each cell matches the two triangles in the rendered mesh.
export function buildGrid(terrain, surface = terrain.surfaceFlags) {
  const { columns, rows, widthMeters, depthMeters } = terrain.metadata
  const width = columns - 1
  const height = rows - 1
  const dx = widthMeters / width
  const dz = depthMeters / height
  const slope = new Float32Array(width * height)
  const roughness = new Float32Array(slope.length)
  const elevation = new Float32Array(slope.length)

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const post = row * columns + column
      const index = row * width + column
      const a = terrain.heights[post]
      const b = terrain.heights[post + 1]
      const c = terrain.heights[post + columns]
      const d = terrain.heights[post + columns + 1]
      const first = Math.hypot((b - a) / dx, (c - a) / dz)
      const second = Math.hypot((d - c) / dx, (d - b) / dz)
      slope[index] = Math.atan(Math.max(first, second)) * degrees
      roughness[index] = Math.abs(a + d - b - c) / Math.min(dx, dz)
      elevation[index] = (b + c) / 2
    }
  }

  // Keep worker messages and telemetry small: geometry stays on terrain.geology.
  const units = Object.fromEntries(Object.values(terrain.geologicUnits ?? {}).map(({ polygons, ...unit }) => [unit.id, unit]))
  const grid = { width, height, dx, dz, slope, roughness, elevation, surface, heights: terrain.heights,
    unitIds: terrain.geologyGrid, units, groundSpeed: new Float32Array(width * height) }
  for (let i = 0; i < grid.groundSpeed.length; i++) grid.groundSpeed[i] = materialAtCell(grid, i).speedFactor
  return grid
}

export function cellAt(grid, { x, z }) {
  const column = Math.floor(x / grid.dx + grid.width / 2)
  const row = Math.floor(z / grid.dz + grid.height / 2)
  return column >= 0 && column < grid.width && row >= 0 && row < grid.height
    ? row * grid.width + column : -1
}

export function cellPoint(grid, index) {
  return {
    x: (index % grid.width + 0.5 - grid.width / 2) * grid.dx,
    z: (Math.floor(index / grid.width) + 0.5 - grid.height / 2) * grid.dz,
  }
}

export function terrainClass(grid, index, maxSlope, closed) {
  if (!Number.isFinite(grid.slope[index])) return 'unknown'
  if (closed?.has(index) || grid.slope[index] > maxSlope) return 'blocked'
  if (grid.slope[index] > maxSlope * 0.65 || grid.roughness[index] >= 0.12 || grid.surface?.[index] || grid.groundSpeed?.[index] < 0.75) return 'caution'
  return 'open'
}

export function cellsInZones(grid, zones) {
  const cells = new Set()
  const halfX = grid.dx / 2
  const halfZ = grid.dz / 2
  for (const zone of zones) {
    const column = Math.floor(zone.x / grid.dx + grid.width / 2)
    const row = Math.floor(zone.z / grid.dz + grid.height / 2)
    const cols = Math.ceil(zone.radius / grid.dx) + 1
    const rows = Math.ceil(zone.radius / grid.dz) + 1
    for (let r = Math.max(0, row - rows); r <= Math.min(grid.height - 1, row + rows); r++) {
      for (let c = Math.max(0, column - cols); c <= Math.min(grid.width - 1, column + cols); c++) {
        const index = r * grid.width + c
        const point = cellPoint(grid, index)
        const x = Math.max(0, Math.abs(zone.x - point.x) - halfX)
        const z = Math.max(0, Math.abs(zone.z - point.z) - halfZ)
        if (x * x + z * z <= zone.radius ** 2) cells.add(index)
      }
    }
  }
  return cells
}
