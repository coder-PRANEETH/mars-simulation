import { terrainClass } from './terrainGrid.js'
import { landTypeAtCell } from '../terrain/materials.js'

const elevationColor = (value) => [
  35 + 214 * value, 75 + 115 * value, 112 - 48 * value, 255,
]
const slopeColor = (value) => [
  50 + 205 * value, 177 - 112 * value, 169 - 116 * value, 255,
]
const hazardColors = {
  unknown: [12, 16, 20, 235],
  blocked: [235, 53, 65, 200],
  caution: [247, 167, 48, 156],
  open: [0, 0, 0, 0],
}

export function mapLayer(grid, metadata, mode, maxSlope, avoid) {
  const canvas = document.createElement('canvas')
  canvas.width = grid.width
  canvas.height = grid.height
  const context = canvas.getContext('2d')
  const image = context.createImageData(grid.width, grid.height)
  const range = metadata.maximumElevation - metadata.minimumElevation || 1
  const min = metadata.minimumElevation - metadata.elevationOffset
  for (let i = 0; i < grid.slope.length; i++) {
    const kind = terrainClass(grid, i, maxSlope, avoid)
    let color = hazardColors[kind]
    if (kind !== 'unknown' && mode === 'Elevation') color = elevationColor((grid.elevation[i] - min) / range)
    if (kind !== 'unknown' && mode === 'Slope') color = slopeColor(Math.min(grid.slope[i] / 35, 1))
    if (mode === 'Land types') {
      const hex = landTypeAtCell(grid, i).color.slice(1)
      color = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 205]
    }
    if (mode === 'Hazard boundaries' && kind !== 'unknown') {
      const neighbors = [i % grid.width ? i - 1 : i, (i + 1) % grid.width ? i + 1 : i,
        i >= grid.width ? i - grid.width : i, i + grid.width < grid.slope.length ? i + grid.width : i]
      const boundary = neighbors.some((neighbor) => terrainClass(grid, neighbor, maxSlope, avoid) !== kind)
      color = kind === 'blocked' ? [255, 71, 76, boundary ? 255 : 90]
        : kind === 'caution' && boundary ? [255, 211, 115, 245] : [0, 0, 0, 0]
    }
    image.data.set(color, i * 4)
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL()
}
