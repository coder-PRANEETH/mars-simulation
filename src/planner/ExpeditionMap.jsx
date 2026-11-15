import { useEffect, useMemo, useRef, useState } from 'react'
import { loadTerrain } from '../terrain/terrain.js'
import { fieldGeologyAt } from '../terrain/photogeology.js'
import { buildGrid, cellAt, cellPoint, cellsInZones } from './terrainGrid.js'
import { mapLayer } from './mapLayers.js'
import { scienceSites } from './scienceSites.js'
import { useRoutes } from './useRoutes.js'
import RouteControls from './RouteControls.jsx'
import DrivingHazards from './DrivingHazards.jsx'
import Icon from '../ui/Icon.jsx'
import { GeologyLayer } from './GeologyLayer.jsx'
import { geologicUnitAt } from '../terrain/geology.js'
import { createSurfaceSampler } from '../simulation/surface.js'
import sampleData from './data/samples.json'
import { SampleMarkers } from './ScienceNotebook.jsx'
import { DiscoverWorkspace, PlaceDetails } from './DiscoverWorkspace.jsx'
import MapLayersMenu from './MapLayersMenu.jsx'
import RouteLaunch from './RouteLaunch.jsx'
import { EVA_DEFAULTS, forecastEVA } from '../simulation/eva.js'
import EVAPlanner, { EVAReturnLayer } from './EVAPlanner.jsx'
import MapViewport, { useMapScale, useMapUnitsPerPixel } from './MapViewport.jsx'
import './expedition.css'

const origin = (point, metadata) => ({
  x: point.x + metadata.widthMeters / 2,
  y: point.z + metadata.depthMeters / 2,
})

export default function ExpeditionMap({ terrain: worldTerrain, sceneLoading, drivingHazards, open, onClose, onLaunch, onClearRoute }) {
  const [terrain, setTerrain] = useState(worldTerrain)
  const [coverageLoading, setCoverageLoading] = useState(false)
  const [coverageError, setCoverageError] = useState(null)
  const initialized = useRef(false)
  const metadata = terrain.metadata
  const { widthMeters, depthMeters } = metadata
  const surface = terrain.surfaceFlags
  const grid = useMemo(() => buildGrid(terrain, surface), [terrain, surface])
  const sampleSurface = useMemo(() => createSurfaceSampler(terrain), [terrain])
  const locate = useMemo(() => (longitude, latitude) => origin(terrain.location(latitude, longitude), metadata), [terrain, metadata])
  const [layer, setLayer] = useState('Imagery')
  const [hazards, setHazards] = useState(false)
  const [maxSlope, setMaxSlope] = useState(20)
  const [mode, setMode] = useState('Inspect')
  const [start, setStart] = useState(-1)
  const [end, setEnd] = useState(-1)
  const [zones, setZones] = useState([])
  const pinCoordinates = useRef({ start: null, end: null })
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
  const [workspace, setWorkspace] = useState('route')
  const [detail, setDetail] = useState(null)
  const [discoverTopic, setDiscoverTopic] = useState('sites')
  const [sheetExpanded, setSheetExpanded] = useState(true)
  const panelBody = useRef(null)
  const detailHeading = useRef(null)
  const detailOrigin = useRef(null)
  const workspaceScroll = useRef({})
  const workspaceNav = useRef(null)
  const [selectedSite, setSelectedSite] = useState(null)
  const [showGeology, setShowGeology] = useState(false)
  const [showCover, setShowCover] = useState(false)
  const coverRaster = useMemo(() => showCover ? mapLayer(grid, metadata, 'Surface cover', maxSlope) : null, [showCover, grid, metadata, maxSlope])
  const [geologySource, setGeologySource] = useState('field')
  const geology = geologySource === 'field' ? terrain.photogeology : terrain.geology
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [samplesVisible, setSamplesVisible] = useState(false)
  const [selectedSample, setSelectedSample] = useState(null)
  const [evaEnabled, setEvaEnabled] = useState(false)
  const [evaSettings, setEvaSettings] = useState(EVA_DEFAULTS)
  const evaPreview = useMemo(() => forecastEVA(routes?.[selected] ?? routes?.terrain, { ...evaSettings, pace }), [routes, selected, evaSettings, pace])
  const eva = evaEnabled ? evaPreview : null
  const selectedRoute = routes?.[selected] ?? routes?.terrain
  useEffect(() => {
    if (routes && !routes[selected]) setSelected('terrain')
  }, [routes, selected])
  const [thermal, setThermal] = useState(false)
  const [context, setContext] = useState(false)
  const [crater, setCrater] = useState(null)
  const [contextError, setContextError] = useState(false)
  const raster = useMemo(() => layer === 'Imagery' ? null : mapLayer(grid, metadata, layer, maxSlope), [grid, metadata, layer, maxSlope])
  const hazard = useMemo(() => hazards ? mapLayer(grid, metadata, showGeology ? 'Hazard boundaries' : 'Hazards', maxSlope, avoid) : null, [grid, metadata, hazards, maxSlope, avoid, showGeology])
  const scaleBar = widthMeters >= 10000 ? 2000 : widthMeters >= 3000 ? 500 : 200

  async function changeCoverage(directory) {
    if (coverageLoading) return
    setCoverageLoading(true)
    setCoverageError(null)
    clear()
    onClearRoute()
    try {
      const next = await loadTerrain(directory)
      const nextGrid = buildGrid(next)
      const convert = (index, key) => {
        if (index < 0 && !pinCoordinates.current[key]) return -1
        const point = index >= 0 ? cellPoint(grid, index) : null
        const coords = pinCoordinates.current[key] ?? terrain.coordinates(point.x, point.z)
        pinCoordinates.current[key] = coords
        return cellAt(nextGrid, next.location(coords.latitude, coords.longitude))
      }
      setStart(convert(start, 'start'))
      setEnd(convert(end, 'end'))
      setZones(zones.map((zone) => {
        const c = terrain.coordinates(zone.x, zone.z)
        return { ...next.location(c.latitude, c.longitude), radius: zone.radius }
      }))
      setTerrain(next)
      setContext(false)
      setInspection(null)
      setDetail(null)
      setSelectedUnit(null)
      setMode('Inspect')
    } catch (error) { setCoverageError(error.message) }
    finally { setCoverageLoading(false) }
  }

  useEffect(() => {
    if (open && !initialized.current) {
      initialized.current = true
      changeCoverage('jezero-regional')
    }
  }, [open])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__MARS_PLANNER__ = { getTerrain: () => terrain }
    return () => { delete window.__MARS_PLANNER__ }
  }, [terrain])

  function switchWorkspace(next) {
    if (!detail && panelBody.current) workspaceScroll.current[workspace] = panelBody.current.scrollTop
    setWorkspace(next)
    setDetail(null)
    setSheetExpanded(true)
    setMode('Inspect')
  }

  function openDetails(kind) {
    if (!detail) {
      detailOrigin.current = document.activeElement
      workspaceScroll.current[workspace] = panelBody.current?.scrollTop ?? 0
    }
    setDetail(kind)
    setSheetExpanded(true)
  }

  function backToWorkspace() {
    setDetail(null)
    requestAnimationFrame(() => {
      if (detailOrigin.current?.isConnected && detailOrigin.current.getClientRects().length) detailOrigin.current.focus({ preventScroll: true })
      else workspaceNav.current?.querySelector('[aria-selected="true"]')?.focus()
    })
  }

  useEffect(() => {
    if (panelBody.current) panelBody.current.scrollTop = detail ? 0 : workspaceScroll.current[workspace] ?? 0
    if (detail) detailHeading.current?.focus({ preventScroll: true })
  }, [detail, workspace])

  function beginPick(action) {
    switchWorkspace('route')
    setContext(false)
    setMode(action)
  }

  function tabKey(event) {
    const ids = ['route', 'marswalk', 'discover']
    const index = ids.findIndex((id) => event.target.closest('[role="tab"]')?.id === `workspace-${id}`)
    if (index < 0) return
    const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1
    if (next < 0) return
    event.preventDefault()
    switchWorkspace(ids[next])
    workspaceNav.current?.querySelector(`#workspace-${ids[next]}`)?.focus()
  }

  const overlays = [
    { name: 'Hazards', active: hazards, onChange: () => setHazards(!hazards), disabled: context },
    { name: 'Geologic regions', active: showGeology, onChange: () => setShowGeology(!showGeology) },
    { name: 'Surface cover', active: showCover, onChange: () => setShowCover(!showCover), disabled: context },
    { name: 'Science sites', active: sitesVisible, onChange: () => setSitesVisible(!sitesVisible) },
    { name: 'Collected samples', active: samplesVisible, onChange: () => setSamplesVisible(!samplesVisible) },
    { name: 'Thermal IR', active: thermal, onChange: toggleThermal },
  ]
  const layerNames = overlays.filter(({ active, disabled }) => active && !disabled).map(({ name }) => name)
  const launch = (route, asCar) => { if (route && !coverageLoading) onLaunch({ ...route, walkPace: pace, gridMeters: Math.min(grid.dx, grid.dz), slopeLimit: maxSlope, avoidZones: zones, assetDirectory: terrain.assetBase.split('/').at(-1), ...(asCar || !eva ? {} : { eva }) }, asCar) }

  function endpointLabel(cell, key) {
    if (cell < 0) return pinCoordinates.current[key] ? 'Outside this area · choose regional view' : 'Choose on the map'
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
    pinCoordinates.current = { start: localSites.find((s) => s.id === 'landing'), end: localSites.find((s) => s.id === 'depot') }
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
      maxSlope, pace, eva: evaSettings, requireBudget: evaEnabled, objective, scienceStop,
      dustPenalty: { clear: 0, haze: 0.12, heavy: 0.32 }[dust],
      thermalPenalty: { nominal: 0, cold: 0.16, warm: 0.20 }[temperature],
    }
    const timer = setTimeout(() => calculate({ start, end, profile, avoid: [...avoid], sites: candidates }), 120)
    return () => clearTimeout(timer)
  }, [surface, start, end, scienceStop, localSites, objective, maxSlope, pace, dust, temperature, avoid, calculate, evaSettings, evaEnabled])

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
    setSitesVisible(true)
    openDetails('site')
    if (terrain.contains(...sitePosition(terrain, site))) setContext(false)
    else showCrater()
  }

  function selectSample(site) {
    setSelectedSample(site)
    setSamplesVisible(true)
    openDetails('sample')
    if (terrain.contains(...sitePosition(terrain, site))) setContext(false)
    else showCrater()
  }

  function inspect(event) {
    const svg = event.currentTarget
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse())
    pickPoint({ x: point.x - widthMeters / 2, z: point.y - depthMeters / 2 })
  }

  function pickPoint({ x, z }) {
    if (coverageLoading) return
    const cell = cellAt(grid, { x, z })
    if (cell < 0) return
    if (mode === 'Set start') {
      pinCoordinates.current.start = terrain.coordinates(x, z)
      if (cell !== start) update(setStart, cell)
      setMode(end < 0 ? 'Set destination' : 'Inspect')
    } else if (mode === 'Set destination') {
      pinCoordinates.current.end = terrain.coordinates(x, z)
      if (cell !== end) update(setEnd, cell)
      setMode('Inspect')
    } else if (mode === 'Mark avoid zone') {
      update(setZones, [...zones, { x, z, radius: 40 }])
      setHazards(true)
    } else {
      setInspection({ x, z })
      openDetails('terrain')
      setSelectedUnit((geologySource === 'field' ? fieldGeologyAt(terrain, { x, z }).bedrock : geologicUnitAt(terrain, { x, z }))?.id ?? null)
    }
  }

  if (!open) return drivingHazards ? <DrivingHazards terrain={worldTerrain} maxSlope={maxSlope} {...drivingHazards} /> : null

  return <section className="expedition mission-workspaces mission-full-map" aria-label="Jezero expedition map">
    <header className="expedition-heading">
      <div className="expedition-title"><span className="expedition-eyebrow">MARS EXPLORER / MISSION MAP</span><h1 aria-label="Jezero Expedition Planner">Jezero crater</h1></div>
      <label className="mission-extent"><span className="sr-only">Map extent</span><select aria-label="Map extent" value={context ? 'crater' : terrain.assetBase.endsWith('jezero-regional') ? 'regional' : 'local'} disabled={coverageLoading} onChange={(event) => {
        setMode('Inspect')
        if (event.target.value === 'crater') showCrater()
        else changeCoverage(event.target.value === 'regional' ? 'jezero-regional' : 'jezero')
      }}><option value="regional">Western Delta + surroundings</option><option value="local">HiRISE landing area</option><option value="crater">Whole crater</option></select></label>
      <button type="button" className="expedition-back" onClick={onClose} aria-label="Return to surface">Back to exploring<Icon name="arrow" size={18} /></button>
    </header>
    <div className="expedition-content">
      <div className="expedition-map">
        {context ? (
          crater ? <CraterMap crater={crater} terrain={terrain} samplesVisible={samplesVisible} selectedSample={detail === 'sample' ? selectedSample : null} onSample={selectSample} geology={showGeology ? geology : null} selectedUnit={selectedUnit} thermal={thermal} sitesVisible={sitesVisible} selectedSite={detail === 'site' ? selectedSite : null} onSelect={selectSite} onDetail={() => setContext(false)} />
            : <p role="status">{contextError ? 'Crater overview could not be loaded. Select Crater overview to retry.' : 'Loading crater overview…'}</p>
        ) : <MapViewport key={terrain.assetBase} width={widthMeters} height={depthMeters} onClick={inspect} aria-label="Detailed traverse map" role="img">
          <clipPath id="expedition-detail"><rect width={widthMeters} height={depthMeters} /></clipPath>
          <RegionalImagery terrain={terrain} raster={raster} />
          {thermal && crater && <LocalThermal terrain={terrain} crater={crater} />}
          {showGeology && geology && <GeologyLayer data={geology} locate={locate} clipPath="url(#expedition-detail)" selectedId={selectedUnit} labels />}
          {coverRaster && <image data-layer="surface-cover" href={coverRaster} width={widthMeters} height={depthMeters} preserveAspectRatio="none" className="expedition-pixels" />}
          {hazard && <image href={hazard} width={widthMeters} height={depthMeters} preserveAspectRatio="none" className="expedition-pixels" />}
          <g transform={`translate(${widthMeters * 0.03} ${depthMeters * 0.94})`} className="expedition-scale">
            <rect x={-widthMeters * .012} y={-widthMeters * .047} width={scaleBar + widthMeters * .025} height={widthMeters * .067} rx={widthMeters * .007} />
            <line x2={scaleBar} strokeWidth={widthMeters * .004} />
            <text y={-widthMeters * .012} fontSize={widthMeters * .028}>{scaleBar} m</text>
          </g>
          {sitesVisible && <SiteMarkers size={widthMeters} sites={scienceSites.filter((site) => terrain.contains(...sitePosition(terrain, site)))}
            locate={(site) => origin(terrain.location(site.latitude, site.longitude), metadata)} selected={detail === 'site' ? selectedSite : null} onSelect={(site) => {
              if (mode === 'Inspect') selectSite(site)
              else pickPoint(terrain.location(site.latitude, site.longitude))
            }} />}
          {samplesVisible && <SampleMarkers sites={sampleData.sites.filter((site) => terrain.contains(...sitePosition(terrain, site)))} size={widthMeters}
            locate={(site) => origin(terrain.location(site.latitude, site.longitude), metadata)} selected={detail === 'sample' ? selectedSample : null} onSelect={(site) => {
              if (mode === 'Inspect') selectSample(site)
              else pickPoint(terrain.location(site.latitude, site.longitude))
            }} />}
          {eva && <EVAReturnLayer plan={eva} metadata={metadata} />}
          <RouteOverlay routes={routes} selected={selected} grid={grid} start={start} end={end} zones={zones} metadata={metadata} />
          {inspection && detail === 'terrain' && mode === 'Inspect' && <circle cx={origin(inspection, metadata).x} cy={origin(inspection, metadata).y} r={widthMeters / 145} fill="none" stroke="#fff" strokeWidth={widthMeters / 500} />}
        </MapViewport>}
        {(coverageLoading || coverageError) && <p className="mission-map-task" role={coverageError ? 'alert' : 'status'}>{coverageError ?? 'Loading regional terrain…'}</p>}
        <div className="mission-coverage-note">{context ? 'Crater overview · context only' : `${terrain.metadata.coverageTier ?? 'HiRISE detailed'} · ${Math.round(terrain.metadata.meshResolutionMeters ?? terrain.metadata.gridMeters ?? 8)} m terrain grid · ${metadata.areaKm2.toFixed(1)} km²`}</div>
        <div className="mission-map-controls"><MapLayersMenu openMap={open} context={context} layer={layer} onLayer={setLayer} overlays={overlays} /></div>
        {!context && mode !== 'Inspect' && <div className="mission-map-task" role="status">
          <span>{mode === 'Set start' ? 'Choose your start on the map' : mode === 'Set destination' ? 'Choose your destination on the map' : 'Click to mark a 40 m avoid zone'}</span>
          {mode === 'Mark avoid zone' && zones.length > 0 && <button type="button" onClick={() => update(setZones, zones.slice(0, -1))}>Undo last avoid zone</button>}
          <button type="button" onClick={() => setMode('Inspect')}>{mode === 'Mark avoid zone' ? 'Done' : 'Cancel'}</button>
        </div>}
        <div className="expedition-north" aria-hidden="true">↑<span>N</span></div>
        {(layerNames.length > 0 || layer !== 'Imagery') && <details className="mission-map-key">
          <summary>Map key · {layerNames.length ? layerNames.join(' + ') : layer}</summary>
          {hazards && !context && <ul className="expedition-legend"><li><i className="hazard-blocked" />Above the slope limit or marked avoid zone</li><li><i className="hazard-caution" />Steep or locally uneven, or mapped surface caution</li><li><i className="hazard-unknown" />No elevation data</li></ul>}
          {showCover && <p>Separate mapped cover: sand, smooth deposits, talus and mantles. Major cover can conceal bedrock contacts.</p>}
          {showGeology && <p>{geologySource === 'field' ? 'Science Team photogeology · 1:5,000 · pre-landing interpretation' : 'USGS geologic units · 1:75,000'}. Explore each region in Discover.</p>}
          {layer === 'Elevation' && !context && <p>Elevation: {Math.round(metadata.minimumElevation)} to {Math.round(metadata.maximumElevation)} m · USGS datum</p>}
          {layer === 'Slope' && !context && <p>Slope: 0° teal to 35° or more red.</p>}
          {thermal && <p>Mars Odyssey THEMIS nighttime infrared · relative brightness at 100 m resolution.</p>}
          {samplesVisible && <p>Diamonds: sample collection sites, not cached tube locations. Gold: sedimentary; blue: other materials.</p>}
          {sitesVisible && <p>Numbered circles: science sites. Select a marker for its field notes.</p>}
        </details>}
      </div>
      <aside className={`expedition-panel ${sheetExpanded ? '' : 'is-collapsed'}`} aria-label="Mission workspace">
        <div className="mission-workspace-heading">
          <nav ref={workspaceNav} className="mission-workspace-tabs" role="tablist" aria-label="Mission workspaces" onKeyDown={tabKey}>
            {[['route', 'Route'], ['marswalk', 'Marswalk'], ['discover', 'Discover']].map(([id, name]) => <button key={id} id={`workspace-${id}`} type="button" role="tab" tabIndex={workspace === id ? 0 : -1} aria-controls="mission-workspace-body" aria-selected={workspace === id} onClick={() => switchWorkspace(id)}>{name}</button>)}
          </nav>
          <button type="button" className="mission-sheet-toggle" aria-label={sheetExpanded ? 'Collapse workspace' : 'Expand workspace'} aria-expanded={sheetExpanded} aria-controls="mission-workspace-body" onClick={() => setSheetExpanded(!sheetExpanded)}>{sheetExpanded ? '⌄' : '⌃'}</button>
        </div>
        <div id="mission-workspace-body" ref={panelBody} className="mission-workspace-body" role="tabpanel" aria-labelledby={`workspace-${workspace}`}>
          <div hidden={!!detail || workspace !== 'route'} data-workspace="route">
            {context && <p>Routes use the measured Western Delta terrain. Choosing a pin opens that area.</p>}
            <fieldset disabled={coverageLoading} className="mission-coverage-fields"><RouteControls start={start} end={end} startLabel={endpointLabel(start, 'start')} endLabel={endpointLabel(end, 'end')} mode={mode} setMode={beginPick}
              maxSlope={maxSlope} setMaxSlope={(value) => update(setMaxSlope, value)} pace={pace} setPace={(value) => update(setPace, value)}
              dust={dust} setDust={(value) => update(setDust, value)} temperature={temperature} setTemperature={(value) => update(setTemperature, value)}
              objective={objective} setObjective={(value) => update(setObjective, value)} scienceStop={scienceStop} setScienceStop={(value) => update(setScienceStop, value)}
              sites={localSites} onDemo={demo} planning={planning} loadingSurface={surface === undefined} error={error} routes={routes}
              selected={selected} onSelect={setSelected} zones={zones} onUndo={() => update(setZones, zones.slice(0, -1))} /></fieldset>
          </div>
          <div hidden={!!detail || workspace !== 'marswalk'} data-workspace="marswalk">
            <label className="mission-suit-toggle"><input type="checkbox" checked={evaEnabled} onChange={(event) => setEvaEnabled(event.target.checked)} />Apply suit budget to Walk route</label>
            <EVAPlanner settings={evaSettings} onChange={setEvaSettings} plan={evaPreview} />
            {!selectedRoute && <button type="button" className="mission-text-action" onClick={() => switchWorkspace('route')}>Choose a route<Icon name="arrow" size={14} /></button>}
          </div>
          <div hidden={!!detail || workspace !== 'discover'} data-workspace="discover">
            <DiscoverWorkspace category={discoverTopic} onCategory={(value) => { setDiscoverTopic(value); if (panelBody.current) panelBody.current.scrollTop = 0 }} terrain={terrain} geology={geology} geologySource={geologySource} onGeologySource={(value) => { setGeologySource(value); setSelectedUnit(null); setShowGeology(true) }} context={context} selectedUnit={selectedUnit} selectedSite={selectedSite} selectedSample={selectedSample}
              onUnit={(value) => { setSelectedUnit(value); if (value) setShowGeology(true) }} onSite={selectSite} onSample={selectSample} />
          </div>
          {detail && <section className="mission-place-details" aria-label="Place details">
            <div ref={detailHeading} tabIndex="-1" className="mission-place-back"><button type="button" onClick={backToWorkspace} aria-label="Back to workspace">← Back to {workspace === 'route' ? 'Route' : workspace === 'marswalk' ? 'Marswalk' : 'Discover'}</button></div>
            <PlaceDetails detail={detail} terrain={terrain} grid={grid} maxSlope={maxSlope} avoid={avoid} sampleSurface={sampleSurface} selectedSite={selectedSite} selectedSample={selectedSample} inspection={inspection} onSite={selectSite} onSample={selectSample} />
          </section>}
        </div>
      </aside>
    </div>
    <RouteLaunch loadingScene={sceneLoading} route={coverageLoading ? null : selectedRoute} planning={planning} eva={eva} forecast={evaPreview} onLaunch={launch} onRoute={() => switchWorkspace('route')} onBudget={() => switchWorkspace('marswalk')} />
  </section>
}

function CraterMap({ crater, terrain, samplesVisible, selectedSample, onSample, geology, selectedUnit, thermal, sitesVisible, selectedSite, onSelect, onDetail }) {
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
    {samplesVisible && <SampleMarkers sites={sampleData.sites.filter((site) => site.longitude >= west && site.longitude <= east && site.latitude >= south && site.latitude <= north)} size={width}
      locate={(site) => locate(site.longitude, site.latitude)} selected={selectedSample} onSelect={onSample} />}
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
  const radius = size * 0.012 * useMapScale()
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

function RouteOverlay({ routes, selected, grid, start, end, zones, metadata }) {
  const toMap = (point) => origin(point, metadata)
  const labelSize = 11 * useMapUnitsPerPixel()
  const selectedRoute = routes?.[selected]
  return <g className="expedition-route-overlay" aria-hidden="true">
    {zones.map((zone, index) => {
      const point = toMap(zone)
      return <circle key={index} cx={point.x} cy={point.y} r={zone.radius} className="expedition-avoid" />
    })}
    {['terrain', 'energy', 'science'].map((id) => {
      const route = routes?.[id]
      if (!route) return null
      const color = id === 'science' ? '#ffbe75' : id === 'energy' ? '#bba5ee' : '#8ef0d8'
      return <polyline key={id} points={route.points.map((point) => {
        const { x, y } = toMap(point)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')} fill="none" stroke={color} strokeWidth={id === selected ? 3 : 1.6}
        strokeDasharray={id === selected ? undefined : '4 4'} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    })}
    {selectedRoute?.waypoints.filter((waypoint, index, all) => {
      if (index === 0 || index === all.length - 1) return true
      if (waypoint.label !== 'Traverse') return true
      const nearEnd = Math.min(waypoint.distance, selectedRoute.distance - waypoint.distance) < labelSize * 4
      return !nearEnd && Math.floor(waypoint.distance / (labelSize * 4)) !== Math.floor(all[index - 1].distance / (labelSize * 4))
    }).map((waypoint) => {
      const index = selectedRoute.waypoints.indexOf(waypoint)
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

/** Imagery detail changes independently from the explicitly labelled analysis grid. */
function RegionalImagery({ terrain, raster }) {
  const scale = useMapScale()
  const { widthMeters: width, depthMeters: height, detailInset } = terrain.metadata
  const overview = detailInset && scale > .7
  const inset = detailInset && scale < .34 && !raster
  const bounds = detailInset?.bounds
  const top = bounds && origin(terrain.location(bounds[3], bounds[0]), terrain.metadata)
  const bottom = bounds && origin(terrain.location(bounds[1], bounds[2]), terrain.metadata)
  return <g aria-label={inset ? 'HiRISE imagery inset over CTX regional terrain' : 'Orbital imagery'}>
    <image href={raster ?? `${terrain.assetBase}/${overview ? 'overview' : 'texture'}.jpg`} width={width} height={height} preserveAspectRatio="none" />
    {inset && <image href={`${import.meta.env.BASE_URL}${detailInset.assetDirectory}/texture.jpg`} x={top.x} y={top.y} width={bottom.x - top.x} height={bottom.y - top.y} preserveAspectRatio="none" />}
    {top && !raster && <rect x={top.x} y={top.y} width={bottom.x - top.x} height={bottom.y - top.y} fill="none" stroke="#e9ba88" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
  </g>
}
