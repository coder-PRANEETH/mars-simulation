import { useMemo } from 'react'
import { mapLayer } from './mapLayers.js'
import { buildGrid, cellAt, terrainClass } from './terrainGrid.js'
import { landTypeAtCell } from '../terrain/materials.js'

const SIZE = 320

export default function DrivingHazards({ terrain, grid, avoid, maxSlope = 20, telemetry, route, showLandTypes, onToggleLandTypes }) {
  const { widthMeters, depthMeters } = terrain.metadata
  const localGrid = useMemo(() => grid ?? buildGrid(terrain), [terrain, grid])
  const raster = useMemo(() => mapLayer(localGrid, terrain.metadata, showLandTypes ? 'Hazard boundaries' : 'Hazards', maxSlope, avoid),
    [terrain, localGrid, avoid, maxSlope, showLandTypes])
  const land = useMemo(() => showLandTypes ? mapLayer(localGrid, terrain.metadata, 'Land types', maxSlope) : null,
    [terrain, localGrid, maxSlope, showLandTypes])
  const routeLine = useMemo(() => route?.points.map(({ x, z }) => `${x},${z}`).join(' '), [route])
  const { x, z } = telemetry.position ?? terrain.metadata.spawn ?? { x: 0, z: 0 }
  const cell = cellAt(localGrid, { x, z })
  const hazard = cell < 0 ? 'unknown' : terrainClass(localGrid, cell, maxSlope, avoid)
  const landType = landTypeAtCell(localGrid, cell)

  return <aside className="drive-hazards" aria-label="Driving hazard map">
    <header><strong>Nearby hazards</strong><span>320 m · N ↑</span></header>
    <button type="button" className="drive-land-toggle" aria-pressed={!!showLandTypes} onClick={onToggleLandTypes}>Land types <span aria-hidden="true">{showLandTypes ? 'ON' : 'OFF'}</span></button>
    <svg width={SIZE} height={SIZE} viewBox={`${x - SIZE / 2} ${z - SIZE / 2} ${SIZE} ${SIZE}`} aria-hidden="true">
      <image href={`${terrain.assetBase}/texture.jpg`} x={-widthMeters / 2} y={-depthMeters / 2} width={widthMeters} height={depthMeters} preserveAspectRatio="none" />
      {land && <image data-layer="land-types" className="expedition-pixels" href={land} x={-widthMeters / 2} y={-depthMeters / 2} width={widthMeters} height={depthMeters} preserveAspectRatio="none" />}
      <image data-layer="hazards" className="expedition-pixels" href={raster} x={-widthMeters / 2} y={-depthMeters / 2} width={widthMeters} height={depthMeters} preserveAspectRatio="none" />
      {routeLine && <polyline points={routeLine} fill="none" stroke="#8ef0d8" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      <path d="M0 -14 L9 9 L0 5 L-9 9 Z" transform={`translate(${x} ${z}) rotate(${telemetry.heading ?? 0})`}
        fill="#fff" stroke="#102126" strokeWidth="2" />
    </svg>
    <footer><span><i className="hazard-blocked" /> Avoid</span><span><i className="hazard-caution" /> Caution</span></footer>
    <div className={`drive-local-hazard is-${hazard}`} aria-label="Local hazard level">{({ blocked: 'Avoid this ground', caution: 'Use caution', open: 'Below hazard limits', unknown: 'No elevation data' })[hazard]}</div>
    {showLandTypes && <div className="drive-land-name" aria-label="Land type at rover"><i style={{ background: landType.color }} />{landType.name}</div>}
  </aside>
}
