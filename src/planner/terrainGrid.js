const degrees = 180 / Math.PI

// Each cell matches the two triangles in the rendered mesh.
export function buildGrid(terrain) {
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

  return { width, height, dx, dz, slope, roughness, elevation, heights: terrain.heights }
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
  if (grid.slope[index] > maxSlope * 0.65 || grid.roughness[index] >= 0.12) return 'caution'
  return 'open'
}
