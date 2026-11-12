import { Vector3 } from 'three'
import { attachGeology } from './geology.js'

const pendingTerrain = new Map()

/** Shared, measured terrain for visual mesh, collision, HUD and scientific queries. */
export function loadTerrain(assetDirectory = 'terrain') {
  const assetBase = `${import.meta.env.BASE_URL}${assetDirectory}`
  if (!pendingTerrain.has(assetDirectory)) {
    const loading = Promise.all([
      fetch(`${assetBase}/metadata.json`).then(checkResponse).then((response) => response.json()),
      fetch(`${assetBase}/heights.bin`).then(checkResponse).then((response) => response.arrayBuffer()),
      fetch(`${assetBase}/surface-flags.bin`).then(checkResponse).then((response) => response.arrayBuffer()).catch(() => null),
      fetch(`${assetBase}/geology.json`).then(checkResponse).then((response) => response.json()).catch(() => null),
      fetch(`${assetBase}/geology-grid.bin`).then(checkResponse).then((response) => response.arrayBuffer()).catch(() => null),
    ]).then(([metadata, buffer, flags, geology, ids]) => {
      const terrain = createTerrain(metadata, new Float32Array(buffer), assetBase)
      const count = (metadata.columns - 1) * (metadata.rows - 1)
      terrain.surfaceFlags = flags?.byteLength === count ? new Uint8Array(flags) : null
      return attachGeology(terrain, geology, ids ? new Uint8Array(ids) : null)
    })
      .catch((error) => {
        pendingTerrain.delete(assetDirectory)
        throw error
      })
    pendingTerrain.set(assetDirectory, loading)
  }
  return pendingTerrain.get(assetDirectory)
}

function checkResponse(response) {
  if (!response.ok) throw new Error(`Terrain asset failed to load: ${response.url} (${response.status})`)
  return response
}

/** Triangle interpolation matches exactly the rendered a,c,b / b,c,d index order. */
export function createTerrain(metadata, heights, assetBase = '/terrain') {
  const { columns, rows, widthMeters, depthMeters, elevationOffset } = metadata
  if (heights.length !== columns * rows) throw new Error('Terrain height buffer does not match metadata')
  const dx = widthMeters / (columns - 1)
  const dz = depthMeters / (rows - 1)

  function cell(x, z) {
    const column = Math.max(0, Math.min(columns - 1, (x + widthMeters / 2) / dx))
    const row = Math.max(0, Math.min(rows - 1, (z + depthMeters / 2) / dz))
    const c = Math.min(columns - 2, Math.floor(column))
    const r = Math.min(rows - 2, Math.floor(row))
    const index = r * columns + c
    return { u: column - c, v: row - r, a: heights[index], b: heights[index + 1], c: heights[index + columns], d: heights[index + columns + 1] }
  }

  function sampleHeight(x, z) {
    const { u, v, a, b, c, d } = cell(x, z)
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : b * (1 - v) + c * (1 - u) + d * (u + v - 1)
  }

  function sampleNormal(x, z, target = new Vector3()) {
    const { u, v, a, b, c, d } = cell(x, z)
    const dhdx = u + v <= 1 ? (b - a) / dx : (d - c) / dx
    const dhdz = u + v <= 1 ? (c - a) / dz : (d - b) / dz
    return target.set(-dhdx, 1, -dhdz).normalize()
  }

  function sampleSlope(x, z) {
    const { u, v, a, b, c, d } = cell(x, z)
    const dhdx = u + v <= 1 ? (b - a) / dx : (d - c) / dx
    const dhdz = u + v <= 1 ? (c - a) / dz : (d - b) / dz
    return Math.atan(Math.hypot(dhdx, dhdz)) * 180 / Math.PI
  }

  function coordinates(x, z) {
    return {
      latitude: metadata.centerLatitude + (metadata.latitudeSouth - metadata.latitudeNorth) * z / depthMeters,
      longitude: metadata.centerLongitude + (metadata.longitudeEast - metadata.longitudeWest) * x / widthMeters,
    }
  }

  function location(latitude, longitude) {
    return {
      x: (longitude - metadata.centerLongitude) * widthMeters / (metadata.longitudeEast - metadata.longitudeWest),
      z: (latitude - metadata.centerLatitude) * depthMeters / (metadata.latitudeSouth - metadata.latitudeNorth),
    }
  }

  return {
    assetBase, location, metadata, heights, sampleHeight, sampleNormal, sampleSlope, coordinates,
    getElevation: (x, z) => sampleHeight(x, z) + elevationOffset,
    contains: (x, z, margin = 0) => Math.abs(x) <= widthMeters / 2 - margin && Math.abs(z) <= depthMeters / 2 - margin,
  }
}
