import { useMemo, useState } from 'react'
import { buildGrid, cellAt, terrainClass } from './terrainGrid.js'
import { mapLayer } from './mapLayers.js'
import { scienceSites } from './scienceSites.js'
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
  const [sitesVisible, setSitesVisible] = useState(true)
  const [selectedSite, setSelectedSite] = useState(null)
  const [thermal, setThermal] = useState(false)
  const [context, setContext] = useState(false)
  const [crater, setCrater] = useState(null)
  const [contextError, setContextError] = useState(false)
  const raster = useMemo(() => layer === 'Imagery' ? null : mapLayer(grid, metadata, layer, maxSlope), [grid, metadata, layer, maxSlope])
  const hazard = useMemo(() => hazards ? mapLayer(grid, metadata, 'Hazards', maxSlope) : null, [grid, metadata, hazards, maxSlope])
  const scaleBar = widthMeters >= 3000 ? 500 : 200

  function fetchCrater() {
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

  function showCrater() {
    setContext(true)
    fetchCrater()
  }

  function toggleThermal() {
    if (!thermal) fetchCrater()
    setThermal(!thermal)
  }

  function selectSite(site) {
    setSelectedSite(site)
    if (terrain.contains(...sitePosition(terrain, site))) setContext(false)
    else showCrater()
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
      <div role="group" aria-label="Terrain layers">
        {!context && ['Imagery', 'Elevation', 'Slope'].map((name) => <Tool key={name} active={layer === name} onClick={() => setLayer(name)}>{name}</Tool>)}
        {!context && <Tool active={hazards} onClick={() => setHazards(!hazards)}>Hazards</Tool>}
        <Tool active={thermal} onClick={toggleThermal}>Thermal IR</Tool>
        <Tool active={sitesVisible} onClick={() => setSitesVisible(!sitesVisible)}>Science sites</Tool>
      </div>
    </div>
    <div className="expedition-content">
      <div className="expedition-map">
        {context ? (
          crater ? <CraterMap crater={crater} terrain={terrain} thermal={thermal} sitesVisible={sitesVisible} selectedSite={selectedSite} onSelect={selectSite} onDetail={() => setContext(false)} />
            : <p role="status">{contextError ? 'Crater overview could not be loaded. Select Crater overview to retry.' : 'Loading crater overview…'}</p>
        ) : <svg viewBox={`0 0 ${widthMeters} ${depthMeters}`} onClick={inspect} aria-label="Detailed traverse map" role="img">
          <image href={raster ?? `${terrain.assetBase}/texture.jpg`} width={widthMeters} height={depthMeters} preserveAspectRatio="none" />
          {thermal && crater && <LocalThermal terrain={terrain} crater={crater} />}
          {hazard && <image href={hazard} width={widthMeters} height={depthMeters} preserveAspectRatio="none" className="expedition-pixels" />}
          <g transform={`translate(${widthMeters * 0.03} ${depthMeters * 0.94})`} className="expedition-scale">
            <rect x={-widthMeters * .012} y={-widthMeters * .047} width={scaleBar + widthMeters * .025} height={widthMeters * .067} rx={widthMeters * .007} />
            <line x2={scaleBar} strokeWidth={widthMeters * .004} />
            <text y={-widthMeters * .012} fontSize={widthMeters * .028}>{scaleBar} m</text>
          </g>
          {sitesVisible && <SiteMarkers size={widthMeters} sites={scienceSites.filter((site) => terrain.contains(...sitePosition(terrain, site)))}
            locate={(site) => origin(terrain.location(site.latitude, site.longitude), metadata)} selected={selectedSite} onSelect={selectSite} />}
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
        {thermal && <div>
          <p>{contextError ? 'Thermal layer could not be loaded. Toggle it to retry.' : 'Mars Odyssey THEMIS nighttime infrared · 100 m source pixels. Purple to yellow shows relative brightness in the contrast-stretched mosaic.'}</p>
          <a href="https://astrogeology.usgs.gov/search/map/mars_odyssey_themis_ir_night_60n60s_mosaic_100m_v14" target="_blank" rel="noreferrer">Thermal data source ↗</a>
        </div>}
        {sitesVisible && <SciencePanel selected={selectedSite} onSelect={selectSite} />}
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

function CraterMap({ crater, terrain, thermal, sitesVisible, selectedSite, onSelect, onDetail }) {
  const { width, height, bounds: [west, south, east, north] } = crater
  const metadata = terrain.metadata
  const x = (longitude) => (longitude - west) / (east - west) * width
  const y = (latitude) => (north - latitude) / (north - south) * height
  return <svg viewBox={`0 0 ${width} ${height}`} aria-label="Jezero crater elevation overview" role="img">
    <image href={`${terrain.assetBase}/crater.jpg`} width={width} height={height} />
    {thermal && <image href={`${terrain.assetBase}/thermal.png`} width={width} height={height} preserveAspectRatio="none" className="expedition-pixels" />}
    <rect x={x(metadata.longitudeWest)} y={y(metadata.latitudeNorth)}
      width={x(metadata.longitudeEast) - x(metadata.longitudeWest)}
      height={y(metadata.latitudeSouth) - y(metadata.latitudeNorth)}
      className="expedition-footprint" role="button" tabIndex="0" aria-label="Open detailed traverse area"
      onClick={onDetail} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onDetail() } }} />
    {sitesVisible && <SiteMarkers size={width} sites={scienceSites.filter((site) => !terrain.contains(...sitePosition(terrain, site)))}
      locate={(site) => ({ x: x(site.longitude), y: y(site.latitude) })} selected={selectedSite} onSelect={onSelect} />}
  </svg>
}

const sitePosition = (terrain, site) => {
  const { x, z } = terrain.location(site.latitude, site.longitude)
  return [x, z]
}

function LocalThermal({ terrain, crater }) {
  const [west, south, east, north] = crater.bounds
  const top = origin(terrain.location(north, west), terrain.metadata)
  const bottom = origin(terrain.location(south, east), terrain.metadata)
  return <image href={`${terrain.assetBase}/thermal.png`} x={top.x} y={top.y} width={bottom.x - top.x} height={bottom.y - top.y}
    preserveAspectRatio="none" className="expedition-pixels" />
}

function SiteMarkers({ size, sites, locate, selected, onSelect }) {
  const radius = size * 0.012
  return sites.map((site) => {
    const { x, y } = locate(site)
    function activate(event) {
      event.stopPropagation()
      onSelect(site)
    }
    return <g key={site.id} role="button" tabIndex="0" aria-label={site.name} aria-pressed={selected?.id === site.id}
      transform={`translate(${x} ${y})`} className="expedition-site"
      onClick={activate} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event) } }}>
      <circle r={radius} strokeWidth={radius * 0.2} />
      <text y={radius * 0.37} textAnchor="middle" fontSize={radius * 1.1}>{scienceSites.indexOf(site) + 1}</text>
    </g>
  })
}

function SciencePanel({ selected, onSelect }) {
  return <div className="expedition-science">
    <h2>Science sites</h2>
    <select aria-label="Inspect science site" value={selected?.id ?? ''} onChange={(event) => {
      const site = scienceSites.find(({ id }) => id === event.target.value)
      if (site) onSelect(site)
    }}>
      <option value="" disabled>Select a science site</option>
      {scienceSites.map((site, index) => <option key={site.id} value={site.id}>{index + 1}. {site.name}</option>)}
    </select>
    {selected && <div>
      <strong>{selected.category}</strong>
      <p>{selected.description}</p>
      <p>{selected.locationNote}</p>
      <a href={selected.source} target="_blank" rel="noreferrer">Science source ↗</a>
    </div>}
  </div>
}
