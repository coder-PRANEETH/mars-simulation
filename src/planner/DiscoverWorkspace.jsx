import { scienceSites } from './scienceSites.js'
import sampleData from './data/samples.json'
import { GeologyExplorer } from './GeologyLayer.jsx'
import ScienceNotebook, { SiteFieldNotes, SamplePanel } from './ScienceNotebook.jsx'
import WeatherObservations from './WeatherObservations.jsx'
import GroundResponse from '../ui/GroundResponse.jsx'
import { geologicUnitAt } from '../terrain/geology.js'
import { cellAt, terrainClass } from './terrainGrid.js'

export function DiscoverWorkspace({ category, onCategory, terrain, context, selectedUnit, onUnit, selectedSite, selectedSample, onSite, onSample }) {
  return <div className="discover-workspace">
    <div><p className="expedition-eyebrow">FOLLOW YOUR CURIOSITY</p><h2>Discover Jezero</h2></div>
    <label className="discover-topic">Explore
      <select aria-label="Discover topic" value={category} onChange={(event) => onCategory(event.target.value)}>
        <option value="sites">Science sites</option><option value="regions">Geologic regions</option>
        <option value="samples">Collected samples</option><option value="notes">Life & science</option>
        <option value="data">Map & weather data</option>
      </select>
    </label>
    <div hidden={category !== 'sites'}><SciencePanel selected={selectedSite} onSelect={onSite} showDetails={false} /><p>Choose a place here or select a marker on the map.</p></div>
    <div hidden={category !== 'regions'}><GeologyExplorer data={terrain.geology} selectedId={selectedUnit} onSelect={onUnit} context={context} /></div>
    <div hidden={category !== 'samples'}><SamplePanel data={sampleData} selected={selectedSample} onSelect={onSample} showDetails={false} /></div>
    <div hidden={category !== 'notes'}><ScienceNotebook /></div>
    <div hidden={category !== 'data'} className="mission-data">
      <h2>Data behind this map</h2>
      <p>{context ? 'Jezero Crater · CTX elevation mosaic' : `Western Delta · HiRISE imagery and elevation · ${terrain.metadata.areaKm2.toFixed(1)} km²`}</p>
      <p>Elevation, imagery and geology come from spacecraft observations and published maps. Surface handling and suit budgets are simulation models.</p>
      <WeatherObservations assetBase={terrain.assetBase} />
      <p>Mars Odyssey THEMIS nighttime infrared shows relative brightness at 100 m resolution, not a live temperature map.</p>
      <a href="https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources" target="_blank" rel="noreferrer">Challenge resources ↗</a>
    </div>
  </div>
}

export function PlaceDetails({ detail, terrain, grid, maxSlope, avoid, sampleSurface, selectedSite, selectedSample, inspection, onSite, onSample }) {
  if (detail === 'site') return <SciencePanel selected={selectedSite} onSelect={onSite} />
  if (detail === 'sample') return <SamplePanel data={sampleData} selected={selectedSample} onSelect={onSample} />
  if (!inspection) return null
  return <section aria-label="Location inspector">
    <p className="expedition-eyebrow">GROUND REPORT</p><h2>Location inspector</h2>
    <dl className="expedition-readings">
      <dt>Coordinates</dt><dd>{terrain.coordinates(inspection.x, inspection.z).latitude.toFixed(5)}° N, {terrain.coordinates(inspection.x, inspection.z).longitude.toFixed(5)}° E</dd>
      <dt>Geologic region</dt><dd>{geologicUnitAt(terrain, inspection)?.label ?? 'Outside mapped coverage'}</dd>
      <dt>Elevation</dt><dd>{terrain.getElevation(inspection.x, inspection.z).toFixed(1)} m</dd>
      <dt>Slope</dt><dd>{terrain.sampleSlope(inspection.x, inspection.z).toFixed(1)}°</dd>
      <dt>Terrain class</dt><dd>{terrainClass(grid, cellAt(grid, inspection), maxSlope, avoid)}</dd>
    </dl>
    <GroundResponse surface={sampleSurface(inspection)} />
  </section>
}

function SciencePanel({ selected, onSelect, showDetails = true }) {
  return <section className="expedition-science" aria-label="Science site information">
    <h2>Science sites</h2>
    <select aria-label="Inspect science site" value={selected?.id ?? ''} onChange={(event) => {
      const site = scienceSites.find(({ id }) => id === event.target.value)
      if (site) onSelect(site)
    }}>
      <option value="" disabled>Select a science site</option>
      {scienceSites.map((site, index) => <option key={site.id} value={site.id}>{index + 1}. {site.name}</option>)}
    </select>
    {selected && showDetails && <div><strong>{selected.category}</strong><p>{selected.description}</p><p>{selected.locationNote}</p>
      <SiteFieldNotes site={selected} /><a href={selected.source} target="_blank" rel="noreferrer">Science source ↗</a>
    </div>}
  </section>
}
