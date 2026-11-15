import Icon from '../ui/Icon.jsx'
import { riskLabel } from './routeRisk.js'
import { distanceText } from './RouteResults.jsx'

export default function RouteLaunch({ route, planning, eva, forecast, onLaunch, onRoute, onBudget }) {
  return <footer className="mission-route-bar" aria-label="Route launch controls">
    <div className="mission-route-summary">
      <strong>{planning ? 'Finding your route…' : route ? `${distanceText(route.distance)} · ${route.stop ? `via ${route.stop.name}` : 'Easier terrain'}` : 'Choose a start and destination'}</strong>
      {route && <dl className="mission-summary-metrics" aria-label="Route summary">
        <div><dt>Distance</dt><dd>{distanceText(route.distance)}</dd></div>
        <div><dt>Walk time</dt><dd>{Math.ceil(route.time / 60)} min</dd></div>
        <div title="One-way walking and planned science work; metabolic energy estimate, not rover battery use"><dt>Walk energy</dt><dd>{forecast ? (forecast.outward.energyJ / 1e6).toFixed(2) : '—'} MJ</dd></div>
        <div title="Relative model index from slope, roughness, loose ground and data quality; not injury probability"><dt>Risk · model</dt><dd>{route.risk ? `${riskLabel(route.risk.mean)} · ${Math.round(route.risk.mean * 100)}/100` : '—'}</dd></div>
      </dl>}
      {!route && !planning && <button type="button" onClick={onRoute}>Pick a route<Icon name="arrow" size={14} /></button>}
      {eva && !eva.feasible && <button type="button" className="mission-budget-warning" onClick={onBudget}>Review Marswalk budget before walking<Icon name="arrow" size={14} /></button>}
    </div>
    <div className="expedition-launch">
      <button className="expedition-primary" type="button" disabled={!route || planning} onClick={() => onLaunch(route, true)}>Drive route<Icon name="arrow" size={18} /></button>
      <button type="button" disabled={!route || planning || (!!eva && !eva.feasible)} onClick={() => onLaunch(route, false)}><Icon name="walking" size={17} />Walk route</button>
    </div>
  </footer>
}
