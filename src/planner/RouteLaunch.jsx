import Icon from '../ui/Icon.jsx'
import { distanceText } from './RouteResults.jsx'

export default function RouteLaunch({ route, planning, eva, onLaunch, onRoute, onBudget }) {
  return <footer className="mission-route-bar" aria-label="Route launch controls">
    <div className="mission-route-summary">
      <strong>{planning ? 'Finding your route…' : route ? `${distanceText(route.distance)} · ${route.stop ? `via ${route.stop.name}` : 'Easier terrain'}` : 'Choose a start and destination'}</strong>
      {route && <span>{Math.ceil(route.time / 60)} min estimated walk · {route.waypoints.length} waypoints</span>}
      {!route && !planning && <button type="button" onClick={onRoute}>Pick a route<Icon name="arrow" size={14} /></button>}
      {eva && !eva.feasible && <button type="button" className="mission-budget-warning" onClick={onBudget}>Review Marswalk budget before walking<Icon name="arrow" size={14} /></button>}
    </div>
    <div className="expedition-launch">
      <button className="expedition-primary" type="button" disabled={!route || planning} onClick={() => onLaunch(route, true)}>Drive route<Icon name="arrow" size={18} /></button>
      <button type="button" disabled={!route || planning || (!!eva && !eva.feasible)} onClick={() => onLaunch(route, false)}><Icon name="walking" size={17} />Walk route</button>
    </div>
  </footer>
}
