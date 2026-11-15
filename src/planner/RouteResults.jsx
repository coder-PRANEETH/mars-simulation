import RouteProfile from './RouteProfile.jsx'
export const distanceText = (distance) => distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`
const timeRange = (seconds) => `${Math.max(1, Math.round(seconds * 0.8 / 60))}–${Math.max(1, Math.ceil(seconds * 1.2 / 60))} min`

export default function RouteResults({ routes, selected, onSelect }) {
  if (!routes.terrain) return <p role="status">No route found. Move a pin or check the route settings.</p>
  const route = routes[selected] ?? routes.terrain

  return <div className="expedition-route-results">
    <h2 className="expedition-section-label">Choose your mission</h2>
    <div className="expedition-route-choices">
      <button aria-pressed={selected === 'terrain'} type="button" onClick={() => onSelect('terrain')}>
        <span>Easier terrain<small>Favors gentler ground</small></span><strong>{distanceText(routes.terrain.distance)}</strong>
      </button>
      {routes.energy && <button aria-pressed={selected === 'energy'} type="button" onClick={() => onSelect('energy')}>
        <span>Save your energy<small>Favors lower steady walking effort</small></span><strong>{(routes.energy.energyJ / 1e6).toFixed(2)} MJ</strong>
      </button>}
      <button aria-pressed={selected === 'science'} type="button" onClick={() => onSelect('science')} disabled={!routes.science}>
        <span>Science stop<small>Balances discovery with effort</small></span><strong>{routes.science ? distanceText(routes.science.distance) : 'Unavailable'}</strong>
      </button>
    </div>
    {route.stop && <p>Via {route.stop.name}</p>}
    <details className="expedition-disclosure">
      <summary>Route details · {route.waypoints.length} waypoints</summary>
      <dl className="expedition-readings">
        <dt>Surface distance</dt><dd>{distanceText(route.distance)}</dd>
        <dt>Walk + science energy</dt><dd>{(route.energyJ / 1e6).toFixed(2)} MJ · model</dd><dt>Elevation gain</dt><dd>{Math.round(route.gain)} m</dd>
        {route.risk && <><dt>Relative risk index</dt><dd>{Math.round(route.risk.mean * 100)}/100 · model</dd><dt>Caution terrain</dt><dd>{distanceText(route.risk.cautionDistance)}</dd></>}
        <dt>Steepest slope</dt><dd>{route.maxSlope.toFixed(1)}°</dd>
        <dt>Estimated walk</dt><dd>{timeRange(route.time)}</dd>
        <dt>There and back</dt><dd>{timeRange(route.time + route.returnTime)}</dd>
        {route.regions?.length > 0 && <><dt>Geologic regions</dt><dd>{route.regions.join(', ')}</dd></>}
      </dl>
      <RouteProfile route={route} />
      {route.contacts?.length > 0 && <p>{route.contacts.length} mapped bedrock contact crossings · {route.contacts.filter((c) => c.exposed).length} without major mapped cover. Boundaries are interpretations.</p>}
      {route.stop?.kind === 'contact' && <p>{route.stop.description}</p>}
      <ol className="expedition-waypoints">{route.waypoints.map((waypoint, index) => <li key={index}>{waypoint.label} · {distanceText(waypoint.distance)}</li>)}</ol>
      <p>Walking estimates exclude stops and rest.</p>
    </details>
  </div>
}
