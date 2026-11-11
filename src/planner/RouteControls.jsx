import RouteResults from './RouteResults.jsx'
import Icon from '../ui/Icon.jsx'

export default function RouteControls({
  start, end, startLabel, endLabel, mode, setMode, maxSlope, setMaxSlope, pace, setPace, dust, setDust, temperature, setTemperature,
  objective, setObjective, scienceStop, setScienceStop, sites, onDemo,
  planning, loadingSurface, error, routes, selected, onSelect, onLaunch,
}) {
  return <div className="expedition-routing">
    <div className="expedition-route-heading">
      <div><p className="expedition-eyebrow">CHOOSE YOUR NEXT STOP</p><h2>Pick a route</h2></div>
      <button type="button" className="expedition-example" onClick={onDemo}>Try a route<Icon name="arrow" size={14} /></button>
    </div>
    <div className="expedition-endpoints">
      {[['Set start', 'Start', startLabel, 'S'], ['Set destination', 'Destination', endLabel, 'D']].map(([action, label, place, badge]) =>
        <button key={action} type="button" aria-label={action} aria-pressed={mode === action} onClick={() => setMode(action)}>
          <b>{badge}</b><span><small>{label}</small><strong>{place}</strong></span><small>{mode === action ? 'Click map' : 'Change'}</small>
        </button>
      )}
    </div>
    {(planning || (loadingSurface && start >= 0 && end >= 0)) && <p role="status">Calculating route…</p>}
    {start >= 0 && start === end && <p role="status">Choose a different destination.</p>}
    {error && <p role="alert">{error}</p>}
    {routes && <RouteResults routes={routes} selected={selected} onSelect={onSelect} onLaunch={onLaunch} />}
    <details className="expedition-disclosure">
      <summary>Route settings</summary>
      <label className="expedition-field">Maximum slope <output>{maxSlope}°</output>
        <input type="range" min="10" max="35" value={maxSlope} onChange={(event) => setMaxSlope(+event.target.value)} />
      </label>
      <label className="expedition-field">Walking pace <output>{pace.toFixed(1)} m/s</output>
        <input type="range" min="0.5" max="1.8" step="0.1" value={pace} onChange={(event) => setPace(+event.target.value)} />
      </label>
      <div className="expedition-form-grid">
        <label>Dust
          <select value={dust} onChange={(event) => setDust(event.target.value)}>
            <option value="clear">Clear</option><option value="haze">Hazy</option><option value="heavy">Heavy dust</option>
          </select>
        </label>
        <label>Thermal load
          <select value={temperature} onChange={(event) => setTemperature(event.target.value)}>
            <option value="nominal">Nominal</option><option value="cold">Severe cold</option><option value="warm">High thermal load</option>
          </select>
        </label>
        <label>Science objective
          <select value={objective} onChange={(event) => setObjective(event.target.value)}>
            <option value="habitability">Past habitability</option><option value="geology">Geologic history</option>
          </select>
        </label>
        <label>Science stop
          <select value={scienceStop} onChange={(event) => setScienceStop(event.target.value)}>
            <option value="auto">Highest priority reachable</option>
            {sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}
          </select>
        </label>
      </div>
    </details>
  </div>
}
