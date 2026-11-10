import { useMemo } from 'react'
import { mapLayer } from './mapLayers.js'
import { buildGrid } from './terrainGrid.js'

const SIZE = 320

export default function DrivingHazards({ terrain, grid, avoid, maxSlope = 20, telemetry, route }) {
  const { widthMeters, depthMeters } = terrain.metadata
  const raster = useMemo(() => mapLayer(grid ?? buildGrid(terrain), terrain.metadata, 'Hazards', maxSlope, avoid),
    [terrain, grid, avoid, maxSlope])
  const routeLine = useMemo(() => route?.points.map(({ x, z }) => `${x},${z}`).join(' '), [route])
  const { x, z } = telemetry.position ?? terrain.metadata.spawn ?? { x: 0, z: 0 }

  return <aside className="drive-hazards" aria-label="Driving hazard map">
    <header><strong>Nearby hazards</strong><span>320 m · N ↑</span></header>
    <svg width={SIZE} height={SIZE} viewBox={`${x - SIZE / 2} ${z - SIZE / 2} ${SIZE} ${SIZE}`} aria-hidden="true">
      <image href={`${terrain.assetBase}/texture.jpg`} x={-widthMeters / 2} y={-depthMeters / 2} width={widthMeters} height={depthMeters} preserveAspectRatio="none" />
      <image className="expedition-pixels" href={raster} x={-widthMeters / 2} y={-depthMeters / 2} width={widthMeters} height={depthMeters} preserveAspectRatio="none" />
      {routeLine && <polyline points={routeLine} fill="none" stroke="#8ef0d8" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      <path d="M0 -14 L9 9 L0 5 L-9 9 Z" transform={`translate(${x} ${z}) rotate(${telemetry.heading ?? 0})`}
        fill="#fff" stroke="#102126" strokeWidth="2" />
    </svg>
    <footer><span><i className="hazard-blocked" /> Avoid</span><span><i className="hazard-caution" /> Caution</span></footer>
  </aside>
}
