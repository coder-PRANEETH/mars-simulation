import { useEffect, useState } from 'react';
import './hud.css';
import Icon from './Icon.jsx';
import DiscoverMars from './DiscoverMars.jsx';
import { GroundInfo } from './GroundResponse.jsx';

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
        <h2>About this world</h2>
        <button className="sim-close" onClick={onClose} aria-label="Close terrain data">×</button>
      </div>
      <p className="sim-data-intro">Spacecraft measured these hills from above Mars. Those measurements make the ground you explore here. The rocks, colours and dust effects help bring the scene to life.</p>
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [learnOpen, setLearnOpen] = useState(true);
  const [groundOpen, setGroundOpen] = useState(false);

  const active = locked || (driving && carActive);
  useEffect(() => {
    if (active) {
      setHasEntered(true);
      setDataOpen(false);
      setHelpOpen(false);
      setLearnOpen(false);
      setGroundOpen(false);
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
      <div className="sim-scene-shade" aria-hidden="true" />
      <div className="sim-mission-frame" aria-hidden="true"><span>04 — MARS</span><span>EXPLORE / LEARN / DISCOVER</span></div>
      <header className="sim-brand">
        <Icon name="rocket" size={34} />
        <div><span className="sim-eyebrow">A MISSION TO DISCOVER</span>
        <h1>MARS<span> EXPLORER</span></h1>
        <p className="sim-region">{region}</p>
        </div>
      </header>

      {!driving && active && <div className="sim-crosshair" aria-hidden="true"><i /><i /><i /><i /></div>}

      <nav className="sim-top-actions sim-interactive" aria-label="Exploration">
        <button className={`sim-tool-button ${learnOpen ? 'is-active' : ''}`} onClick={() => { setLearnOpen(!learnOpen); setGroundOpen(false); }} aria-expanded={learnOpen} aria-label="Discover Mars"><Icon name="spark" size={16} />Discover</button>
        {driving && carActive && <button type="button" className={`sim-tool-button ${showHazards ? 'is-active' : ''}`} aria-pressed={showHazards} onClick={onToggleHazards}>
          <Icon name="hazard" size={16} /><span>Hazards</span>
        </button>}
        {onOpenMap && <button className="sim-tool-button sim-map-link" onClick={onOpenMap} aria-label="Expedition map"><Icon name="route" size={17} />Mission map</button>}
        <button className="sim-tool-button" onClick={onChangeRegion}><Icon name="compass" size={17} />{regionId === 'jezero' ? 'Southeast hills' : 'Explore Jezero'}</button>
        <button className="sim-icon-button" onClick={() => setDataOpen((open) => !open)} aria-expanded={dataOpen} aria-label="Terrain & data"><Icon name="info" /></button>
      </nav>

      {dataOpen && <DataPanel metadata={metadata} onClose={() => setDataOpen(false)} />}

      {!active && !dataOpen && <div className="sim-launch-layout">
      <div className="sim-entry sim-interactive" role="region" aria-label="Enter simulation">
        <div className="sim-entry-index"><span />{loading ? 'LOADING YOUR MISSION' : loadError ? 'MISSION ON HOLD' : hasEntered ? 'MISSION PAUSED' : 'YOUR MISSION STARTS HERE'}</div>
        <h2>{loading ? <>Getting<br /><em>ready.</em></> : loadError ? <>Let’s<br /><em>try again.</em></> : hasEntered ? <>Mission<br /><em>paused.</em></> : <>Explore<br /><em>Mars.</em></>}</h2>
        <p>{loading ? 'Building the landscape from spacecraft images.' : loadError ? 'We couldn’t load the landscape. Reload this page to try again.' : regionId === 'jezero' ? 'Explore an ancient lakebed. Pick a path and visit the places scientists study.' : 'Walk or drive across real Martian hills mapped by spacecraft. What will you discover?'}</p>
        {!loading && !loadError && <>
          <div className="sim-mode-choice" role="group" aria-label="Travel mode">
            <button type="button" aria-pressed={!driving} aria-label={driving ? 'Switch to foot mode' : 'Foot mode selected'} onClick={() => { if (driving) onToggleDriving(); }}><Icon name="walking" size={23} /><span>Walk<small>Explore on foot</small></span></button>
            <button type="button" aria-pressed={driving} aria-label={driving ? 'Car mode selected' : 'Switch to car mode'} onClick={() => { if (!driving) onToggleDriving(); }}><Icon name="car" size={23} /><span>Drive a rover<small>Cover more ground</small></span></button>
          </div>
          <button className="sim-enter-button" onClick={enter} aria-label={hasEntered ? 'Resume simulation' : 'Enter simulation'}>
            {hasEntered ? 'Resume mission' : 'Start exploring'}<Icon name="arrow" size={23} />
          </button>
          {hasEntered && <button type="button" className="sim-reset" onClick={onReset}>Return to the start</button>}
          <p className="sim-entry-tip">{driving ? 'W / S to drive · A / D to steer · Space to brake' : 'W A S D to move · Mouse to look · Space to jump'}</p>
        </>}
        {loading && <div className="sim-load-line" aria-label="Loading" />}
      </div>
      {!loading && !loadError && learnOpen && <DiscoverMars />}
      </div>}
      {active && learnOpen && !dataOpen && <DiscoverMars compact />}
      {groundOpen && !dataOpen && <section className="sim-ground-panel sim-interactive" aria-label="Ground beneath you">
        <div className="sim-panel-heading"><h2>Ground beneath you</h2><button className="sim-close" aria-label="Close ground information" onClick={() => setGroundOpen(false)}>×</button></div>
        <div className="sim-ground-body"><GroundInfo surface={telemetry.surface} sinkDepth={driving ? telemetry.sinkDepth : undefined} wheelSlip={driving ? telemetry.wheelSlip : undefined} /></div>
      </section>}

      {inspection && <section className="sim-inspection sim-interactive" aria-label="Inspected terrain point">
        <div className="sim-panel-heading"><h2>Terrain scanner</h2><button className="sim-close" onClick={onClearInspection} aria-label="Clear inspected point">×</button></div>
        <div className="sim-inspection-coordinates">{coordinate(inspection.latitude ?? inspection.lat, 'lat')}<br />{coordinate(inspection.longitude ?? inspection.lon, 'lon')}</div>
        <dl className="sim-readout"><dt>Elevation</dt><dd>{number(inspection.elevation ?? inspection.altitude, 2)} m</dd><dt>Local slope</dt><dd>{number(inspection.slope, 1)}°</dd></dl>
        <p>{inspection.terrainInfo ?? inspection.surfaceInfo ?? inspection.surface ?? 'Elevation and slope from the terrain model. Mineral and material composition are not available.'}</p>
        {inspection.ground && <div className="sim-scanner-ground"><GroundInfo surface={inspection.ground} /></div>}
      </section>}

      {debug && <section className="sim-debug sim-interactive" aria-label="Physics debug telemetry">
        <div className="sim-panel-heading"><h2>Physics diagnostics</h2><span>F3</span></div>
        <dl className="sim-readout"><dt>FPS</dt><dd>{number(telemetry.fps, 0)}</dd><dt>XYZ · m</dt><dd>{vector(telemetry.position)}</dd><dt>Velocity · m/s</dt><dd>{vector(telemetry.velocity)}</dd><dt>Vertical velocity</dt><dd>{number(telemetry.verticalVelocity ?? component(telemetry.velocity, 'y'), 2)} m/s</dd><dt>Grounded</dt><dd className={telemetry.grounded ? 'sim-grounded' : ''}>{telemetry.grounded ? 'YES' : 'NO'}</dd><dt>Terrain elevation</dt><dd>{number(telemetry.terrainElevation, 2)} m</dd><dt>Local slope</dt><dd>{number(telemetry.slope, 1)}°</dd><dt>Gravity</dt><dd>{number(simulation.gravity, 2)} m/s²</dd><dt>Friction</dt><dd>{number(simulation.friction, 2)}</dd><dt>Airborne time</dt><dd>{number(telemetry.airborneTime, 2)} s</dd><dt>Player altitude</dt><dd>{number(altitude, 2)} m AGL</dd></dl>
      </section>}

      <div className="sim-help-dock sim-interactive">
        <button className="sim-help-button" aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)}><span>?</span> Controls</button>
        {helpOpen && <div className="sim-controls-legend">
          <p>{driving ? 'ROVER CONTROLS' : 'EXPLORER CONTROLS'}</p>
          <div><kbd>{driving ? 'W / S' : 'W A S D'}</kbd><span>{driving ? 'Drive / reverse' : 'Move'}</span></div>
          {driving && <div><kbd>A / D</kbd><span>Steer</span></div>}
          <div><kbd>{driving ? 'DRAG' : 'MOUSE'}</kbd><span>Look around</span></div>
          <div><kbd>SPACE</kbd><span>{driving ? 'Brake' : 'Jump'}</span></div>
          <div><kbd>ESC</kbd><span>{driving ? 'Pause' : 'Release cursor'}</span></div>
          <div><kbd>E</kbd><span>Scan the ground</span></div>
        </div>}
      </div>
      {(active || hasEntered) && !loading && telemetry.surface && <button className="sim-surface-note sim-interactive" aria-label="Current surface condition" aria-expanded={groundOpen}
        onClick={() => { setGroundOpen(!groundOpen); setLearnOpen(false); onClearInspection?.(); }}>
        <i className={telemetry.surface.speedFactor < 0.7 ? 'surface-slow' : ''} />
        <span>{telemetry.surface.unit?.label ?? telemetry.surface.name}</span>
        {driving && telemetry.wheelSlip > 0.3 ? <small>Wheels slipping</small> : telemetry.surface.speedFactor < 0.7 && <small>Slow ground</small>}
        <Icon name="info" size={14} />
      </button>}

      <section className="sim-telemetry" aria-label="Live telemetry">
        <div className="sim-telemetry-title">LIVE FROM THE SURFACE <span>Weather is simulated</span></div>
        <dl>
          <dt><Icon name="wind" size={16} />Wind</dt><dd title="Simulated wind speed">{number(simulation.windSpeed, 0)} <span>km/h</span></dd>
          <dt><Icon name="temperature" size={16} />Temperature</dt><dd title="Simulated air temperature">{number(simulation.temperature, 0)} <span>°C</span></dd>
          <dt><Icon name="pin" size={16} />Coordinates</dt><dd className="sim-position"><span>{coordinate(latitude, 'lat')}</span> <span>{coordinate(longitude, 'lon')}</span></dd>
          <dt>Speed</dt><dd className="sim-travel-speed">{number(driving ? speed * 3.6 : speed, driving ? 1 : 2)} <span>{driving ? 'km/h' : 'm/s'}</span></dd>
        </dl>
      </section>
      {locked && <div className="sim-lock-hint">Esc <span>to release the cursor</span></div>}
    </div>
  );
}
