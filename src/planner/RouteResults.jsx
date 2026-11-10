export const distanceText = (distance) => distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`
const timeRange = (seconds) => `${Math.max(1, Math.round(seconds * 0.8 / 60))}–${Math.max(1, Math.ceil(seconds * 1.2 / 60))} min`

export default function RouteResults({ driving, routes, selected, onSelect, onWalk }) {
  if (!routes.terrain) return <p role="status">No connected route under these settings. Check the endpoints, terrain limit, and avoid zones.</p>
  const route = routes[selected] ?? routes.terrain
  const delta = route.distance - routes.terrain.distance
  const comparison = Math.abs(delta) < 1 ? 'same distance' : `${distanceText(Math.abs(delta))} ${delta > 0 ? 'longer' : 'shorter'}`

  return <div className="expedition-route-results">
    <h2>Route comparison</h2>
    <div className="expedition-route-choices">
      <button aria-pressed={selected === 'terrain'} type="button" onClick={() => onSelect('terrain')}>
        <span>Terrain first</span><strong>{distanceText(routes.terrain.distance)}</strong>
      </button>
      <button aria-pressed={selected === 'science'} type="button" onClick={() => onSelect('science')} disabled={!routes.science}>
        <span>Science stop</span><strong>{routes.science ? distanceText(routes.science.distance) : 'Unavailable'}</strong>
      </button>
    </div>
    {!routes.science && <p>No additional science stop is reachable with these settings.</p>}
    {route.stop && <p>Visits {route.stop.name} · {comparison} compared with the terrain-first route.</p>}
    <dl className="expedition-readings">
      <dt>Surface distance</dt><dd>{distanceText(route.distance)}</dd>
      <dt>Elevation gain</dt><dd>{Math.round(route.gain)} m</dd>
      <dt>Steepest route cell</dt><dd>{route.maxSlope.toFixed(1)}°</dd>
      <dt>Estimated walk</dt><dd>{timeRange(route.time)}</dd>
      <dt>Out and back</dt><dd>{timeRange(route.time + route.returnTime)}</dd>
    </dl>
    <button className="expedition-primary" type="button" onClick={() => onWalk(route)}>{driving ? 'Drive selected route' : 'Walk selected route'} ↗</button>
    <details className="expedition-waypoints">
      <summary>Waypoints · {route.waypoints.length}</summary>
      <ol>{route.waypoints.map((waypoint, index) => <li key={index}>{waypoint.label} · {distanceText(waypoint.distance)}</li>)}</ol>
    </details>
    <p>Times are scenario estimates and exclude science stops and rest.</p>
  </div>
}
