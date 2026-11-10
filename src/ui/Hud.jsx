import { useEffect, useState } from 'react';
import './hud.css';

const number = (value, digits = 1) => value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
const coordinate = (value, axis) => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return `${Math.abs(n).toFixed(5)}° ${axis === 'lat' ? (n < 0 ? 'S' : 'N') : (n < 0 ? 'W' : 'E')}`;
};
const component = (value, axis) => Array.isArray(value) ? value[['x', 'y', 'z'].indexOf(axis)] : value?.[axis];
const vector = (value) => ['x', 'y', 'z'].map((axis) => number(component(value, axis), 2)).join(' / ');

function DataPanel({ metadata, onClose }) {
  let sources = metadata.sources ?? metadata.datasets ?? [];
  if (!Array.isArray(sources)) sources = Object.entries(sources).map(([key, value]) => typeof value === 'string' ? { name: key, url: value } : { name: key, ...value });
  if (!sources.length) sources = [metadata.dem, metadata.imagery].filter(Boolean).map((source) => typeof source === 'string' ? { name: source } : source);
  const transforms = metadata.transformations ?? metadata.processing ?? metadata.preprocessing;
  const center = metadata.center ?? {};
  const bounds = metadata.bounds;
  const area = metadata.areaKm2 ?? metadata.playableAreaKm2 ?? metadata.areaSquareKilometers;

  return (
    <section className="sim-data-panel sim-interactive" aria-label="Terrain source and attribution">
      <div className="sim-panel-heading">
        <h2>Terrain & data</h2>
        <button className="sim-close" onClick={onClose} aria-label="Close terrain data">×</button>
      </div>
      <p className="sim-data-intro">The primary terrain is reconstructed from measured Mars elevation data. Surface rocks and atmospheric effects are visual approximations.</p>
      <dl className="sim-data-details">
        <dt>Region</dt><dd>{metadata.region ?? metadata.name ?? 'Mars terrain region'}</dd>
        <dt>Center</dt><dd>{coordinate(metadata.centerLatitude ?? metadata.latitude ?? center.latitude ?? center.lat, 'lat')}<br />{coordinate(metadata.centerLongitude ?? metadata.longitude ?? center.longitude ?? center.lon, 'lon')}</dd>
        {area && <><dt>Playable area</dt><dd>{number(area, 2)} km²</dd></>}
        {metadata.datasetName && <><dt>Dataset</dt><dd>{metadata.datasetName}</dd></>}
        {metadata.credit && <><dt>Credit</dt><dd>{metadata.credit}</dd></>}
        {metadata.originalResolution && <><dt>Original resolution</dt><dd>{String(metadata.originalResolution)}</dd></>}
        {metadata.originalResolutionMeters && <><dt>Source DTM</dt><dd>{number(metadata.originalResolutionMeters, 3)} m / elevation post</dd></>}
        {metadata.originalImageryResolutionMeters && <><dt>Source image</dt><dd>{number(metadata.originalImageryResolutionMeters, 3)} m / pixel</dd></>}
        {metadata.resolution && <><dt>Prototype mesh</dt><dd>{String(metadata.resolution)}</dd></>}
        {metadata.meshResolutionMeters && <><dt>Prototype mesh</dt><dd>{metadata.columns} × {metadata.rows} · {number(metadata.meshResolutionMeters, 3)} m</dd></>}
        {metadata.textureSize && <><dt>Texture</dt><dd>{metadata.textureSize} × {metadata.textureSize} px · HiRISE RED grayscale with illustrative rust tint</dd></>}
        {(metadata.datum ?? metadata.elevationDatum) && <><dt>Elevation datum</dt><dd>{metadata.datum ?? metadata.elevationDatum}</dd></>}
        {metadata.latitudeNorth != null && <><dt>Latitude extent</dt><dd>{coordinate(metadata.latitudeSouth, 'lat')} — {coordinate(metadata.latitudeNorth, 'lat')}</dd></>}
        {metadata.longitudeEast != null && <><dt>Longitude extent</dt><dd>{coordinate(metadata.longitudeWest, 'lon')} — {coordinate(metadata.longitudeEast, 'lon')}</dd></>}
        {metadata.coordinates && <><dt>Extent</dt><dd>{typeof metadata.coordinates === 'string' ? metadata.coordinates : JSON.stringify(metadata.coordinates)}</dd></>}
        {bounds && <><dt>Bounds</dt><dd>{typeof bounds === 'string' ? bounds : JSON.stringify(bounds)}</dd></>}
      </dl>
      {sources.map((source, index) => (
        <div className="sim-source" key={source.id ?? source.name ?? index}>
          <h3>{source.name ?? source.dataset ?? source.title ?? `Dataset ${index + 1}`}</h3>
          {source.description && <p>{source.description}</p>}
          {(source.originalResolution ?? source.resolution) && <p>Original resolution: {String(source.originalResolution ?? source.resolution)}</p>}
          {source.credit && <p>{source.credit}</p>}
          {(source.url ?? source.sourceUrl ?? source.link) && <a href={source.url ?? source.sourceUrl ?? source.link} target="_blank" rel="noreferrer">Open dataset source ↗</a>}
        </div>
      ))}
      {transforms && <div className="sim-processing"><h3>Processing</h3>{Array.isArray(transforms) ? <ol>{transforms.map((step, index) => <li key={index}>{typeof step === 'string' ? step : JSON.stringify(step)}</li>)}</ol> : <p>{typeof transforms === 'string' ? transforms : JSON.stringify(transforms)}</p>}</div>}
      <p className="sim-data-note">Orbital data resolution limits surface detail. Wind and temperature in the simulator are generated values.</p>
    </section>
  );
}

export default function Hud({ driving, carActive, showHazards, onToggleHazards, onToggleDriving, region: regionId, onChangeRegion, onOpenMap, simulation = {}, telemetry = {}, metadata = {}, locked, loading, loadError, onEnter, onReset, debug, inspection, onClearInspection }) {
  const [dataOpen, setDataOpen] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  const active = locked || (driving && carActive);
  useEffect(() => {
    if (active) {
      setHasEntered(true);
      setDataOpen(false);
    }
  }, [active]);

  const center = metadata.center ?? {};
  const region = metadata.region ?? metadata.name ?? 'Mars surface';
  const latitude = telemetry.latitude ?? metadata.centerLatitude ?? metadata.latitude ?? center.latitude ?? center.lat;
  const longitude = telemetry.longitude ?? metadata.centerLongitude ?? metadata.longitude ?? center.longitude ?? center.lon;
  const speed = telemetry.speed ?? Math.hypot(component(telemetry.velocity, 'x') ?? 0, component(telemetry.velocity, 'z') ?? 0);
  const altitude = telemetry.altitude ?? telemetry.elevation ?? component(telemetry.position, 'y');
  const enter = (event) => {
    event.stopPropagation();
    onEnter?.();
  };

  return (
    <div className={`sim-hud ${locked ? 'is-locked' : active ? 'is-driving' : 'is-paused'}`}>
      <header className="sim-brand">
        <div className="sim-eyebrow"><span className="sim-status-dot" /> Surface exploration / terrain demonstrator</div>
        <h1>MARS SURFACE SIMULATOR</h1>
        <div className="sim-region">{region}</div>
      </header>

      <div className="sim-crosshair" aria-hidden="true"><i /><i /><i /><i /></div>

      <div className="sim-top-actions sim-interactive">
        {driving && carActive && <button type="button" className={`sim-tool-button ${showHazards ? 'is-active' : ''}`} aria-pressed={showHazards} onClick={onToggleHazards}>Hazards</button>}
        {onOpenMap && <button className="sim-tool-button" onClick={onOpenMap}>Expedition map</button>}
        <button className="sim-tool-button" onClick={onChangeRegion}>{regionId === 'jezero' ? 'Southeast hills' : 'Explore Jezero'}</button>
        <button className={`sim-tool-button ${dataOpen ? 'is-active' : ''}`} onClick={() => setDataOpen((open) => !open)} aria-expanded={dataOpen}>Terrain & data</button>
      </div>

      {dataOpen && <DataPanel metadata={metadata} onClose={() => setDataOpen(false)} />}

      {!active && !dataOpen && <div className="sim-entry sim-interactive" role="region" aria-label="Enter simulation">
        <div className="sim-entry-index">{loading ? 'PREPARING SURFACE' : loadError ? 'TERRAIN LOAD ERROR' : hasEntered ? 'SIMULATION PAUSED' : 'SURFACE READY'}</div>
        <h2>{loading ? 'Reconstructing Mars terrain' : loadError ? 'Unable to load terrain' : hasEntered ? 'Return to the surface' : driving ? 'Drive on Mars' : 'Stand on Mars'}</h2>
        <p>{loading ? 'Loading measured elevation and surface assets.' : loadError ? String(loadError.message ?? loadError) : driving ? 'Drive the expedition car on the measured terrain. Steering, braking and traction respond to the surface.' : 'Explore real terrain on foot. Mouse look, physical movement, and gravity-driven jumps.'}</p>
        {!loading && !loadError && <button className="sim-enter-button" onClick={enter}>{hasEntered ? 'Resume simulation' : 'Enter simulation'}<span aria-hidden="true">↗</span></button>}
        {!loading && !loadError && <div className="sim-entry-actions">
          <button type="button" className="sim-tool-button" aria-pressed={driving} onClick={onToggleDriving}>
            {driving ? 'Switch to foot mode' : 'Switch to car mode'}
          </button>
          <button type="button" className="sim-tool-button" onClick={onReset}>Reset position</button>
        </div>}
        {loading && <div className="sim-load-line" aria-label="Loading" />}
        {!loading && !loadError && <div className="sim-entry-hint">{driving ? 'Drag the terrain to orbit the camera. Esc pauses driving.' : <>Click the viewport to capture your mouse.<br /><kbd>ESC</kbd> releases the cursor.</>}</div>}
      </div>}

      {inspection && <section className="sim-inspection sim-interactive" aria-label="Inspected terrain point">
        <div className="sim-panel-heading"><h2><span className="sim-inspect-square" /> Surface sample</h2><button className="sim-close" onClick={onClearInspection} aria-label="Clear inspected point">×</button></div>
        <div className="sim-inspection-coordinates">{coordinate(inspection.latitude ?? inspection.lat, 'lat')}<br />{coordinate(inspection.longitude ?? inspection.lon, 'lon')}</div>
        <dl className="sim-readout"><dt>Elevation</dt><dd>{number(inspection.elevation ?? inspection.altitude, 2)} m</dd><dt>Local slope</dt><dd>{number(inspection.slope, 1)}°</dd></dl>
        <p>{inspection.terrainInfo ?? inspection.surfaceInfo ?? inspection.surface ?? 'Elevation and slope from the terrain model. Mineral and material composition are not available.'}</p>
      </section>}

      {debug && <section className="sim-debug sim-interactive" aria-label="Physics debug telemetry">
        <div className="sim-panel-heading"><h2>Physics diagnostics</h2><span>F3</span></div>
        <dl className="sim-readout"><dt>FPS</dt><dd>{number(telemetry.fps, 0)}</dd><dt>XYZ · m</dt><dd>{vector(telemetry.position)}</dd><dt>Velocity · m/s</dt><dd>{vector(telemetry.velocity)}</dd><dt>Vertical velocity</dt><dd>{number(telemetry.verticalVelocity ?? component(telemetry.velocity, 'y'), 2)} m/s</dd><dt>Grounded</dt><dd className={telemetry.grounded ? 'sim-grounded' : ''}>{telemetry.grounded ? 'YES' : 'NO'}</dd><dt>Terrain elevation</dt><dd>{number(telemetry.terrainElevation, 2)} m</dd><dt>Local slope</dt><dd>{number(telemetry.slope, 1)}°</dd><dt>Gravity</dt><dd>{number(simulation.gravity, 2)} m/s²</dd><dt>Friction</dt><dd>{number(simulation.friction, 2)}</dd><dt>Airborne time</dt><dd>{number(telemetry.airborneTime, 2)} s</dd><dt>Player altitude</dt><dd>{number(altitude, 2)} m AGL</dd></dl>
      </section>}

      <footer className="sim-controls-legend">{driving ? <>
        <div><kbd>W / S</kbd><span>Drive / reverse</span><kbd>A / D</kbd><span>Steer</span></div>
        <div><kbd>SPACE</kbd><span>Brake</span><kbd>DRAG</kbd><span>Orbit view</span></div>
      </> : <><div><kbd>W A S D</kbd><span>Move</span><kbd>MOUSE</kbd><span>Look</span></div><div><kbd>SPACE</kbd><span>Jump</span><kbd>SHIFT</kbd><span>Sprint</span></div></>}<div><kbd>E</kbd><span>Inspect terrain</span><kbd>F3</kbd><span>Debug</span></div><p>{driving ? 'ESC · pause driving' : locked ? 'ESC · release cursor' : 'Keyboard + mouse required for surface exploration'}</p></footer>

      <section className="sim-telemetry" aria-label="Live telemetry">
        <div className="sim-telemetry-title">LIVE TELEMETRY</div>
        <dl>
          <dt>Wind</dt><dd title="Simulated wind speed">{number(simulation.windSpeed, 0)} <span>km/h</span></dd>
          <dt>Temperature</dt><dd title="Simulated air temperature">{number(simulation.temperature, 0)} <span>°C</span></dd>
          <dt>Coordinates</dt><dd className="sim-position"><span>{coordinate(latitude, 'lat')}</span> <span>{coordinate(longitude, 'lon')}</span></dd>
          <dt>Speed</dt><dd>{number(driving ? speed * 3.6 : speed, driving ? 1 : 2)} <span>{driving ? 'km/h' : 'm/s'}</span></dd>
        </dl>
      </section>
      {locked && <div className="sim-lock-hint">MOUSE CAPTURED <span>ESC to release</span></div>}
    </div>
  );
}
