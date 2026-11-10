import RouteResults from './RouteResults.jsx'

export default function RouteControls({
  start, end, maxSlope, pace, setPace, dust, setDust, temperature, setTemperature,
  objective, setObjective, scienceStop, setScienceStop, sites, onDemo, onCalculate,
  planning, error, routes, selected, onSelect, onWalk,
}) {
  return <div className="expedition-routing">
    <div className="expedition-route-heading">
      <h2>Plan a traverse</h2>
      <button type="button" onClick={onDemo}>Example traverse</button>
    </div>
    <dl className="expedition-readings">
      <dt>Start</dt><dd>{start < 0 ? 'Choose on map' : 'Set'}</dd>
      <dt>Destination</dt><dd>{end < 0 ? 'Choose on map' : 'Set'}</dd>
    </dl>
    <label className="expedition-field">Level walking pace <output>{pace.toFixed(1)} m/s</output>
      <input type="range" min="0.5" max="1.8" step="0.1" value={pace} onChange={(event) => setPace(+event.target.value)} />
    </label>
    <div className="expedition-form-grid">
      <label>Dust scenario
        <select value={dust} onChange={(event) => setDust(event.target.value)}>
          <option value="clear">Clear</option><option value="haze">Hazy</option><option value="heavy">Heavy dust</option>
        </select>
      </label>
      <label>Thermal scenario
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
    <button className="expedition-primary" type="button" onClick={onCalculate} disabled={start < 0 || end < 0 || start === end || planning}>
      {planning ? 'Calculating…' : 'Calculate routes'}
    </button>
    {start >= 0 && start === end && <p role="status">Choose a destination in a different terrain cell.</p>}
    {error && <p role="alert">{error}</p>}
    {routes && <RouteResults routes={routes} selected={selected} onSelect={onSelect} onWalk={onWalk} />}
    <p>Current slope limit {maxSlope}°. Dust and thermal scenarios add time allowances. The pace and allowances are adjustable planning assumptions.</p>
  </div>
}
