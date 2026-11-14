import Icon from '../ui/Icon.jsx'

export const distanceText = (distance) => distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`
const timeRange = (seconds) => `${Math.max(1, Math.round(seconds * 0.8 / 60))}–${Math.max(1, Math.ceil(seconds * 1.2 / 60))} min`

export default function RouteResults({ routes, selected, onSelect, onLaunch, eva }) {
  if (!routes.terrain) return <p role="status">No route found. Move a pin or check the route settings.</p>
  const route = routes[selected] ?? routes.terrain

  return <div className="expedition-route-results">
    <h2 className="expedition-section-label">Two ways to explore</h2>
    <div className="expedition-route-choices">
      <button aria-pressed={selected === 'terrain'} type="button" onClick={() => onSelect('terrain')}>
        <span>Easier terrain<small>Favors gentler ground</small></span><strong>{distanceText(routes.terrain.distance)}</strong>
      </button>
      <button aria-pressed={selected === 'science'} type="button" onClick={() => onSelect('science')} disabled={!routes.science}>
        <span>Science stop<small>Visit a place scientists study</small></span><strong>{routes.science ? distanceText(routes.science.distance) : 'Unavailable'}</strong>
      </button>
    </div>
    {route.stop && <p>Via {route.stop.name}</p>}
    <div className="expedition-launch">
      <button className="expedition-primary" type="button" onClick={() => onLaunch(route, true)}>Drive route<Icon name="arrow" size={18} /></button>
      <button type="button" disabled={!!eva && !eva.feasible} onClick={() => onLaunch(route, false)}><Icon name="walking" size={17} />Walk route</button>
    </div>
    {eva && !eva.feasible && <p role="status">Adjust the Marswalk budget above before walking. Rover travel uses a separate mode.</p>}
    <details className="expedition-disclosure">
      <summary>Route details · {route.waypoints.length} waypoints</summary>
      <dl className="expedition-readings">
        <dt>Surface distance</dt><dd>{distanceText(route.distance)}</dd>
        <dt>Elevation gain</dt><dd>{Math.round(route.gain)} m</dd>
        <dt>Steepest slope</dt><dd>{route.maxSlope.toFixed(1)}°</dd>
        <dt>Estimated walk</dt><dd>{timeRange(route.time)}</dd>
        <dt>There and back</dt><dd>{timeRange(route.time + route.returnTime)}</dd>
        {route.regions?.length > 0 && <><dt>Geologic regions</dt><dd>{route.regions.join(', ')}</dd></>}
      </dl>
      <ol className="expedition-waypoints">{route.waypoints.map((waypoint, index) => <li key={index}>{waypoint.label} · {distanceText(waypoint.distance)}</li>)}</ol>
      <p>Walking estimates exclude stops and rest.</p>
    </details>
  </div>
}
