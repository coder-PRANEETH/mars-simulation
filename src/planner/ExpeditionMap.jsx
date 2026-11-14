import { useEffect, useMemo, useRef, useState } from 'react'
import { buildGrid, cellAt, cellPoint, cellsInZones, terrainClass } from './terrainGrid.js'
import { mapLayer } from './mapLayers.js'
import { scienceSites } from './scienceSites.js'
import { useRoutes } from './useRoutes.js'
import RouteControls from './RouteControls.jsx'
import DrivingHazards from './DrivingHazards.jsx'
import Icon from '../ui/Icon.jsx'
import WeatherObservations from './WeatherObservations.jsx'
import { GeologyLayer, GeologyExplorer } from './GeologyLayer.jsx'
import { geologicUnitAt } from '../terrain/geology.js'
import { createSurfaceSampler } from '../simulation/surface.js'
import GroundResponse from '../ui/GroundResponse.jsx'
import MapViewport from './MapViewport.jsx'
import './expedition.css'

const origin = (point, metadata) => ({
  x: point.x + metadata.widthMeters / 2,
  y: point.z + metadata.depthMeters / 2,
})

function Tool({ children, onClick, active, ...props }) {
  return <button type="button" onClick={onClick} aria-pressed={active} {...props}>{children}</button>
}

export default function ExpeditionMap({ terrain, drivingHazards, open, onClose, onLaunch, onClearRoute }) {
  const metadata = terrain.metadata
  const { widthMeters, depthMeters } = metadata
  const surface = terrain.surfaceFlags
  const grid = useMemo(() => buildGrid(terrain, surface), [terrain, surface])
  const sampleSurface = useMemo(() => createSurfaceSampler(terrain), [terrain])
  const locate = useMemo(() => (longitude, latitude) => origin(terrain.location(latitude, longitude), metadata), [terrain, metadata])
  const [layer, setLayer] = useState('Imagery')
  const [hazards, setHazards] = useState(false)
  const [maxSlope, setMaxSlope] = useState(20)
  const [mode, setMode] = useState('Set start')
  const [start, setStart] = useState(-1)
  const [end, setEnd] = useState(-1)
  const [zones, setZones] = useState([])
  const [pace, setPace] = useState(1)
  const [dust, setDust] = useState('clear')
  const [temperature, setTemperature] = useState('nominal')
  const [objective, setObjective] = useState('habitability')
  const [scienceStop, setScienceStop] = useState('auto')
  const [selected, setSelected] = useState('terrain')
  const { planning, routes, error, clear, calculate } = useRoutes(grid)
  const avoid = useMemo(() => cellsInZones(grid, zones), [grid, zones])
  const localSites = useMemo(() => scienceSites
    .map((site) => ({ ...site, cell: cellAt(grid, terrain.location(site.latitude, site.longitude)) }))
    .filter((site) => site.cell >= 0), [grid, terrain])
  const [inspection, setInspection] = useState(null)
  const [sitesVisible, setSitesVisible] = useState(true)
  const mapInformation = useRef(null)
  const [selectedSite, setSelectedSite] = useState(null)
  const [showGeology, setShowGeology] = useState(false)
  const geology = terrain.geology
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [thermal, setThermal] = useState(false)
  const [context, setContext] = useState(false)
  const [crater, setCrater] = useState(null)
  const [contextError, setContextError] = useState(false)
  const raster = useMemo(() => layer === 'Imagery' ? null : mapLayer(grid, metadata, layer, maxSlope), [grid, metadata, layer, maxSlope])
  const hazard = useMemo(() => hazards ? mapLayer(grid, metadata, 'Hazards', maxSlope, avoid) : null, [grid, metadata, hazards, maxSlope, avoid])
  const scaleBar = widthMeters >= 3000 ? 500 : 200

  function endpointLabel(cell) {
    if (cell < 0) return 'Choose on the map'
    const site = localSites.find((candidate) => candidate.cell === cell)
    if (site) return site.name
    const { x, z } = cellPoint(grid, cell)
    const { latitude, longitude } = terrain.coordinates(x, z)
    return `${latitude.toFixed(4)}° N · ${longitude.toFixed(4)}° E`
  }

  function update(setter, value) {
    setter(value)
    setSelected('terrain')
    clear()
    onClearRoute()
  }

  function demo() {
    const exampleStart = localSites.find((site) => site.id === 'landing').cell
    const exampleEnd = localSites.find((site) => site.id === 'depot').cell
    if (start === exampleStart && end === exampleEnd && scienceStop === 'auto') return
    setStart(exampleStart)
    setEnd(exampleEnd)
    setScienceStop('auto')
    setContext(false)
    setMode('Inspect')
    setSelected('terrain')
    clear()
    onClearRoute()
  }

  useEffect(() => {
    if (surface === undefined || start < 0 || end < 0 || start === end) return
    const candidates = scienceStop === 'auto'
      ? [...localSites].sort((a, b) => b[objective] - a[objective])
      : localSites.filter((site) => site.id === scienceStop)
    const profile = {
      maxSlope, pace,
      dustPenalty: { clear: 0, haze: 0.12, heavy: 0.32 }[dust],
      thermalPenalty: { nominal: 0, cold: 0.16, warm: 0.20 }[temperature],
    }
    const timer = setTimeout(() => calculate({ start, end, profile, avoid: [...avoid], sites: candidates }), 120)
    return () => clearTimeout(timer)
  }, [surface, start, end, scienceStop, localSites, objective, maxSlope, pace, dust, temperature, avoid, calculate])

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

  function toggleGeology() {
    setShowGeology(!showGeology)
  }

  function toggleThermal() {
    if (!thermal) fetchCrater()
    setThermal(!thermal)
  }

  function selectSite(site) {
    setSelectedSite(site)
    if (mapInformation.current) mapInformation.current.open = true
    if (terrain.contains(...sitePosition(terrain, site))) setContext(false)
    else showCrater()
  }

  function inspect(event) {
    const svg = event.currentTarget
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse())
    pickPoint({ x: point.x - widthMeters / 2, z: point.y - depthMeters / 2 })
  }

  function pickPoint({ x, z }) {
    const cell = cellAt(grid, { x, z })
    if (cell < 0) return
    if (mode === 'Set start') {
      if (cell !== start) update(setStart, cell)
      setMode(end < 0 ? 'Set destination' : 'Inspect')
    } else if (mode === 'Set destination') {
      if (cell !== end) update(setEnd, cell)
      setMode('Inspect')
    } else if (mode === 'Mark avoid zone') {
      update(setZones, [...zones, { x, z, radius: 40 }])
      setHazards(true)
    } else {
      setInspection({ x, z })
      setSelectedUnit(geologicUnitAt(terrain, { x, z })?.id ?? null)
    }
  }

  if (!open) return drivingHazards ? <DrivingHazards terrain={terrain} grid={grid} avoid={avoid} maxSlope={maxSlope} {...drivingHazards} /> : null

  return <section className="expedition" aria-label="Jezero expedition map">
    <header className="expedition-heading">
      <div className="expedition-title">
        <span className="expedition-eyebrow">MARS EXPLORER / MISSION MAP</span>
        <h1 aria-label="Jezero Expedition Planner">Jezero crater</h1>
      </div>
      <button type="button" className="expedition-back" onClick={onClose} aria-label="Return to surface">Back to exploring<Icon name="arrow" size={18} /></button>
    </header>
    <div className="expedition-tools">
      <div role="group" aria-label="Map extent">
        <Tool active={!context} onClick={() => setContext(false)}>Exploration area</Tool>
        <Tool active={context} onClick={showCrater}>Crater overview</Tool>
      </div>
      <div className="expedition-map-tools" role="group" aria-label="Map tools">
        {!context && <>
          <Tool active={mode === 'Inspect'} onClick={() => setMode('Inspect')}>Inspect</Tool>
          <Tool active={mode === 'Mark avoid zone'} onClick={() => setMode('Mark avoid zone')}>Mark avoid zone</Tool>
          {!!zones.length && <Tool onClick={() => update(setZones, zones.slice(0, -1))}>Undo last avoid zone</Tool>}
          <Tool active={hazards} onClick={() => setHazards(!hazards)}><Icon name="hazard" size={16} />Hazards</Tool>
        </>}
        <Tool active={showGeology} onClick={toggleGeology} aria-label="Geologic regions"><Icon name="layers" size={16} />Regions</Tool>
        <details className="expedition-layer-menu">
          <summary><Icon name="layers" size={17} />Layers</summary>
          <div role="group" aria-label="Terrain layers">
            {!context && ['Imagery', 'Elevation', 'Slope'].map((name) => <Tool key={name} active={layer === name} onClick={() => setLayer(name)}>{name}</Tool>)}
            <Tool active={thermal} onClick={toggleThermal}>Thermal IR</Tool>
            <Tool active={sitesVisible} onClick={() => setSitesVisible(!sitesVisible)}>Science sites</Tool>
          </div>
        </details>
      </div>
    </div>
    <div className="expedition-content">
      <div className="expedition-map">
        {context ? (
          crater ? <CraterMap crater={crater} terrain={terrain} geology={showGeology ? geology : null} selectedUnit={selectedUnit} thermal={thermal} sitesVisible={sitesVisible} selectedSite={selectedSite} onSelect={selectSite} onDetail={() => setContext(false)} />
            : <p role="status">{contextError ? 'Crater overview could not be loaded. Select Crater overview to retry.' : 'Loading crater overview…'}</p>
        ) : <MapViewport width={widthMeters} height={depthMeters} onClick={inspect} aria-label="Detailed traverse map" role="img">
          <clipPath id="expedition-detail"><rect width={widthMeters} height={depthMeters} /></clipPath>
          <image href={raster ?? `${terrain.assetBase}/texture.jpg`} width={widthMeters} height={depthMeters} preserveAspectRatio="none" />
          {thermal && crater && <LocalThermal terrain={terrain} crater={crater} />}
          {showGeology && geology && <GeologyLayer data={geology} locate={locate} clipPath="url(#expedition-detail)" selectedId={selectedUnit} labels />}
          {hazard && <image href={hazard} width={widthMeters} height={depthMeters} preserveAspectRatio="none" className="expedition-pixels" />}
          <g transform={`translate(${widthMeters * 0.03} ${depthMeters * 0.94})`} className="expedition-scale">
            <rect x={-widthMeters * .012} y={-widthMeters * .047} width={scaleBar + widthMeters * .025} height={widthMeters * .067} rx={widthMeters * .007} />
            <line x2={scaleBar} strokeWidth={widthMeters * .004} />
            <text y={-widthMeters * .012} fontSize={widthMeters * .028}>{scaleBar} m</text>
          </g>
          {sitesVisible && <SiteMarkers size={widthMeters} sites={scienceSites.filter((site) => terrain.contains(...sitePosition(terrain, site)))}
            locate={(site) => origin(terrain.location(site.latitude, site.longitude), metadata)} selected={selectedSite} onSelect={(site) => {
              if (mode === 'Inspect') selectSite(site)
              else pickPoint(terrain.location(site.latitude, site.longitude))
            }} />}
          <RouteOverlay routes={routes} selected={selected} grid={grid} start={start} end={end} zones={zones} metadata={metadata} />
          {inspection && mode === 'Inspect' && <circle cx={origin(inspection, metadata).x} cy={origin(inspection, metadata).y} r={widthMeters / 145} fill="none" stroke="#fff" strokeWidth={widthMeters / 500} />}
        </MapViewport>}
        {!context && mode !== 'Inspect' && <div className="expedition-map-hint" role="status">
          {mode === 'Set start' ? 'Click the map to set your start' : mode === 'Set destination' ? 'Click the map to set your destination' : 'Click to mark a 40 m avoid zone'}
        </div>}
        <div className="expedition-north" aria-hidden="true">↑<span>N</span></div>
      </div>
      <aside className="expedition-panel">
        {showGeology && <GeologyExplorer data={geology} selectedId={selectedUnit} onSelect={setSelectedUnit} context={context} />}
        {!context && <RouteControls start={start} end={end} startLabel={endpointLabel(start)} endLabel={endpointLabel(end)} mode={mode} setMode={setMode}
          maxSlope={maxSlope} setMaxSlope={(value) => update(setMaxSlope, value)} pace={pace} setPace={(value) => update(setPace, value)}
          dust={dust} setDust={(value) => update(setDust, value)} temperature={temperature} setTemperature={(value) => update(setTemperature, value)}
          objective={objective} setObjective={(value) => update(setObjective, value)} scienceStop={scienceStop} setScienceStop={(value) => update(setScienceStop, value)}
          sites={localSites} onDemo={demo} planning={planning} loadingSurface={surface === undefined} error={error} routes={routes}
          selected={selected} onSelect={setSelected} onLaunch={onLaunch} />}
        {context && <p>Select the outlined area to plan a route.</p>}
        <details className="expedition-disclosure" ref={mapInformation}>
          <summary>Map information</summary>
          <p>{context ? 'Jezero Crater · CTX elevation mosaic' : `Western Delta · HiRISE imagery and elevation · ${metadata.areaKm2.toFixed(1)} km²`}</p>
          {thermal && <p>{contextError ? 'Thermal layer unavailable.' : 'Mars Odyssey THEMIS nighttime infrared · relative brightness at 100 m resolution.'}</p>}
          <WeatherObservations assetBase={terrain.assetBase} />
          {sitesVisible && <SciencePanel selected={selectedSite} onSelect={selectSite} />}
        </details>
        {!context && <>
          {hazards && <ul className="expedition-legend">
            <li><i className="hazard-blocked" />Above the slope limit or marked avoid zone</li>
            <li><i className="hazard-caution" />Steep or locally uneven, or mapped surface caution</li>
            <li><i className="hazard-unknown" />No elevation data</li>
          </ul>}
          {hazards && surface === null && <p>Mapped surface data unavailable.</p>}
          {layer === 'Elevation' && <p>Elevation ramp: {Math.round(metadata.minimumElevation)} to {Math.round(metadata.maximumElevation)} m · USGS elevation datum</p>}
          {layer === 'Slope' && <p>Slope ramp: 0° teal to 35° or more red. Color shows the steeper triangle in each cell.</p>}
          {inspection && mode === 'Inspect' && <div>
            <h2>Location inspector</h2>
            <dl className="expedition-readings">
              <dt>Coordinates</dt><dd>{terrain.coordinates(inspection.x, inspection.z).latitude.toFixed(5)}° N, {terrain.coordinates(inspection.x, inspection.z).longitude.toFixed(5)}° E</dd>
              <dt>Geologic region</dt><dd>{geologicUnitAt(terrain, inspection)?.label ?? 'Outside mapped coverage'}</dd>
              <dt>Elevation</dt><dd>{terrain.getElevation(inspection.x, inspection.z).toFixed(1)} m</dd>
              <dt>Slope</dt><dd>{terrain.sampleSlope(inspection.x, inspection.z).toFixed(1)}°</dd>
              <dt>Terrain class</dt><dd>{terrainClass(grid, cellAt(grid, inspection), maxSlope, avoid)}</dd>
            </dl>
            <GroundResponse surface={sampleSurface(inspection)} />
          </div>}
        </>}
      </aside>
    </div>
  </section>
}

function CraterMap({ crater, terrain, geology, selectedUnit, thermal, sitesVisible, selectedSite, onSelect, onDetail }) {
  const { width, height, bounds: [west, south, east, north] } = crater
  const metadata = terrain.metadata
  const locate = useMemo(() => (longitude, latitude) => ({
    x: (longitude - west) / (east - west) * width,
    y: (north - latitude) / (north - south) * height,
  }), [east, height, north, south, west, width])
  const top = locate(metadata.longitudeWest, metadata.latitudeNorth)
  const bottom = locate(metadata.longitudeEast, metadata.latitudeSouth)
  return <MapViewport width={width} height={height} aria-label="Jezero crater elevation overview" role="img">
    <image href={`${terrain.assetBase}/crater.jpg`} width={width} height={height} />
    {thermal && <image href={`${terrain.assetBase}/thermal.png`} width={width} height={height} preserveAspectRatio="none" className="expedition-pixels" />}
    {geology && <GeologyLayer data={geology} locate={locate} selectedId={selectedUnit} />}
    <rect x={top.x} y={top.y} width={bottom.x - top.x} height={bottom.y - top.y}
      className="expedition-footprint" role="button" tabIndex="0" aria-label="Open detailed traverse area"
      onClick={onDetail} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onDetail() } }} />
    {sitesVisible && <SiteMarkers size={width} sites={scienceSites.filter((site) => !terrain.contains(...sitePosition(terrain, site)))}
      locate={(site) => locate(site.longitude, site.latitude)} selected={selectedSite} onSelect={onSelect} />}
  </MapViewport>
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
    preserveAspectRatio="none" className="expedition-pixels" clipPath="url(#expedition-detail)" />
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

function RouteOverlay({ routes, selected, grid, start, end, zones, metadata }) {
  const toMap = (point) => origin(point, metadata)
  const labelSize = metadata.widthMeters * 0.012
  const selectedRoute = routes?.[selected]
  return <g className="expedition-route-overlay" aria-hidden="true">
    {zones.map((zone, index) => {
      const point = toMap(zone)
      return <circle key={index} cx={point.x} cy={point.y} r={zone.radius} className="expedition-avoid" />
    })}
    {['terrain', 'science'].map((id) => {
      const route = routes?.[id]
      if (!route) return null
      const color = id === 'science' ? '#ffbe75' : '#8ef0d8'
      return <polyline key={id} points={route.points.map((point) => {
        const { x, y } = toMap(point)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')} fill="none" stroke={color} strokeWidth={id === selected ? 3 : 1.6}
        strokeDasharray={id === selected ? undefined : '4 4'} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    })}
    {selectedRoute?.waypoints.map((waypoint, index) => {
      if (index === 0 || index === selectedRoute.waypoints.length - 1) return null
      const { x, y } = toMap(waypoint)
      return <g key={index} transform={`translate(${x} ${y})`}>
        <circle r={labelSize * 0.58} fill={selected === 'science' ? '#ffbe75' : '#8ef0d8'} />
        <text textAnchor="middle" y={labelSize * 0.23} fontSize={labelSize * 0.68}>{index + 1}</text>
      </g>
    })}
    {[[start, 'S'], [end, 'D']].map(([cell, label]) => {
      if (cell < 0) return null
      const { x, y } = toMap(cellPoint(grid, cell))
      return <g key={label} transform={`translate(${x} ${y})`}>
        <circle r={labelSize * 0.8} fill={label === 'S' ? '#8ef0d8' : '#ffd8a9'} />
        <text textAnchor="middle" y={labelSize * 0.33} fontSize={labelSize}>{label}</text>
      </g>
    })}
  </g>
}
