import { useMemo, useState } from 'react'
import { buildGrid, cellAt, terrainClass } from './terrainGrid.js'
import { mapLayer } from './mapLayers.js'
import './expedition.css'

const origin = (point, metadata) => ({
  x: point.x + metadata.widthMeters / 2,
  y: point.z + metadata.depthMeters / 2,
})

function Tool({ children, onClick, active, ...props }) {
  return <button type="button" onClick={onClick} aria-pressed={active} {...props}>{children}</button>
}

export default function ExpeditionMap({ terrain, onClose }) {
  const metadata = terrain.metadata
  const { widthMeters, depthMeters } = metadata
  const grid = useMemo(() => buildGrid(terrain), [terrain])
  const [layer, setLayer] = useState('Imagery')
  const [hazards, setHazards] = useState(false)
  const [maxSlope, setMaxSlope] = useState(20)
  const [inspection, setInspection] = useState(null)
  const [context, setContext] = useState(false)
  const [crater, setCrater] = useState(null)
  const [contextError, setContextError] = useState(false)
  const raster = useMemo(() => layer === 'Imagery' ? null : mapLayer(grid, metadata, layer, maxSlope), [grid, metadata, layer, maxSlope])
  const hazard = useMemo(() => hazards ? mapLayer(grid, metadata, 'Hazards', maxSlope) : null, [grid, metadata, hazards, maxSlope])
  const scaleBar = widthMeters >= 3000 ? 500 : 200

  function showCrater() {
    setContext(true)
    if (crater) return
    setContextError(false)
    fetch(`${terrain.assetBase}/crater.json`)
      .then((response) => {
        if (!response.ok) throw new Error('Crater data unavailable')
        return response.json()
      })
      .then(setCrater)
      .catch(() => setContextError(true))
  }

  function inspect(event) {
    const svg = event.currentTarget
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse())
    const x = point.x - widthMeters / 2
    const z = point.y - depthMeters / 2
    if (cellAt(grid, { x, z }) >= 0) setInspection({ x, z })
  }

  return <section className="expedition" aria-label="Jezero expedition map">
    <header className="expedition-heading">
      <div><p>MARS 2020 FIELD REGION</p><h1>Jezero Expedition Planner</h1></div>
      <button type="button" onClick={onClose}>Return to surface <span aria-hidden="true">↗</span></button>
    </header>
    <div className="expedition-tools">
      <div role="group" aria-label="Map extent">
        <Tool active={!context} onClick={() => setContext(false)}>Traverse area</Tool>
        <Tool active={context} onClick={showCrater}>Crater overview</Tool>
      </div>
      {!context && <div role="group" aria-label="Terrain layers">
        {['Imagery', 'Elevation', 'Slope'].map((name) => <Tool key={name} active={layer === name} onClick={() => setLayer(name)}>{name}</Tool>)}
        <Tool active={hazards} onClick={() => setHazards(!hazards)}>Hazards</Tool>
      </div>}
    </div>
    <div className="expedition-content">
      <div className="expedition-map">
        {context ? (
          crater ? <CraterMap crater={crater} terrain={terrain} onDetail={() => setContext(false)} />
            : <p role="status">{contextError ? 'Crater overview could not be loaded. Select Crater overview to retry.' : 'Loading crater overview…'}</p>
        ) : <svg viewBox={`0 0 ${widthMeters} ${depthMeters}`} onClick={inspect} aria-label="Detailed traverse map" role="img">
          <image href={raster ?? `${terrain.assetBase}/texture.jpg`} width={widthMeters} height={depthMeters} preserveAspectRatio="none" />
          {hazard && <image href={hazard} width={widthMeters} height={depthMeters} preserveAspectRatio="none" className="expedition-pixels" />}
          <g transform={`translate(${widthMeters * 0.03} ${depthMeters * 0.94})`} className="expedition-scale">
            <rect x={-widthMeters * .012} y={-widthMeters * .047} width={scaleBar + widthMeters * .025} height={widthMeters * .067} rx={widthMeters * .007} />
            <line x2={scaleBar} strokeWidth={widthMeters * .004} />
            <text y={-widthMeters * .012} fontSize={widthMeters * .028}>{scaleBar} m</text>
          </g>
          {inspection && <circle cx={origin(inspection, metadata).x} cy={origin(inspection, metadata).y} r={widthMeters / 145} fill="none" stroke="#fff" strokeWidth={widthMeters / 500} />}
        </svg>}
        <div className="expedition-north" aria-hidden="true">↑<span>N</span></div>
      </div>
      <aside className="expedition-panel">
        <div>
          <p className="expedition-kicker">TERRAIN DATA</p>
          <h2>{context ? 'Jezero Crater' : 'Western Delta traverse area'}</h2>
          <p>{context ? 'Crater-wide context from the CTX elevation mosaic. Select the outlined region to return to the detailed map.' : `HiRISE elevation and matched orbital imagery · ${metadata.areaKm2.toFixed(1)} km²`}</p>
        </div>
        {!context && <>
          <label className="expedition-field">Maximum slope <output>{maxSlope}°</output>
            <input type="range" min="10" max="35" value={maxSlope} onChange={(event) => setMaxSlope(+event.target.value)} />
          </label>
          {hazards && <ul className="expedition-legend">
            <li><i className="hazard-blocked" />Above the selected slope limit</li>
            <li><i className="hazard-caution" />Steep or locally uneven</li>
            <li><i className="hazard-unknown" />No elevation data</li>
          </ul>}
          {layer === 'Elevation' && <p>Elevation ramp: {Math.round(metadata.minimumElevation)} to {Math.round(metadata.maximumElevation)} m · USGS elevation datum</p>}
          {layer === 'Slope' && <p>Slope ramp: 0° teal to 35° or more red. Color shows the steeper triangle in each cell.</p>}
          <div>
            <h2>Location inspector</h2>
            {inspection ? <dl className="expedition-readings">
              <dt>Coordinates</dt><dd>{terrain.coordinates(inspection.x, inspection.z).latitude.toFixed(5)}° N, {terrain.coordinates(inspection.x, inspection.z).longitude.toFixed(5)}° E</dd>
              <dt>Elevation</dt><dd>{terrain.getElevation(inspection.x, inspection.z).toFixed(1)} m</dd>
              <dt>Slope</dt><dd>{terrain.sampleSlope(inspection.x, inspection.z).toFixed(1)}°</dd>
              <dt>Terrain class</dt><dd>{terrainClass(grid, cellAt(grid, inspection), maxSlope)}</dd>
            </dl> : <p>Select a point on the map to inspect it.</p>}
          </div>
          <p className="expedition-note">Slope limits are planning assumptions. Small rocks, loose footing and weather require separate assessment.</p>
        </>}
      </aside>
    </div>
  </section>
}

function CraterMap({ crater, terrain, onDetail }) {
  const { width, height, bounds: [west, south, east, north] } = crater
  const metadata = terrain.metadata
  const x = (longitude) => (longitude - west) / (east - west) * width
  const y = (latitude) => (north - latitude) / (north - south) * height
  return <svg viewBox={`0 0 ${width} ${height}`} aria-label="Jezero crater elevation overview" role="img">
    <image href={`${terrain.assetBase}/crater.jpg`} width={width} height={height} />
    <rect x={x(metadata.longitudeWest)} y={y(metadata.latitudeNorth)}
      width={x(metadata.longitudeEast) - x(metadata.longitudeWest)}
      height={y(metadata.latitudeSouth) - y(metadata.latitudeNorth)}
      className="expedition-footprint" role="button" tabIndex="0" aria-label="Open detailed traverse area"
      onClick={onDetail} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onDetail() } }} />
  </svg>
}
