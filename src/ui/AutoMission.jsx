import { useEffect, useState } from 'react'

export default function AutoMission({ model, paused, onPause, onResume, onManual }) {
  const [expanded, setExpanded] = useState(() => window.matchMedia('(min-width: 701px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 701px)')
    const changed = () => setExpanded(media.matches)
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  const complete = model?.status === 'Complete'
  const blocked = model?.status === 'Blocked'
  const status = complete ? 'Destination reached' : blocked ? 'Route paused' : paused ? 'Auto mode paused' : model?.driving ? 'Rover following route' : 'Astronaut following route'
  return <section className="auto-mission sim-interactive" aria-label="Automatic route statistics">
    <header><span>AUTO / ROUTE FOLLOW</span><button className="auto-stat-toggle" type="button" aria-label="Toggle automatic route statistics" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><strong role="status">{model ? status : 'Preparing automatic travel…'}</strong><span aria-hidden="true">{expanded ? '−' : '+'}</span></button></header>
    <progress aria-label="Automatic route progress" max="1" value={model?.fraction ?? 0} />
    {!expanded && <p className="auto-compact-stats">{Math.round((model?.throttle ?? 0) * 100)}% {model?.driving ? 'throttle' : 'pace'} · {model?.driving ? ((model?.energyJ ?? 0) / 3600).toFixed(2) : ((model?.energyJ ?? 0) / 1000).toFixed(1)} {model?.driving ? 'Wh' : 'kJ'} · model</p>}
    <dl hidden={!expanded}>
      <div><dt>{model?.driving ? 'Throttle' : 'Pace command'}</dt><dd>{Math.round((model?.throttle ?? 0) * 100)}<small>%</small></dd></div>
      <div><dt>{model?.driving ? 'Motor power · model' : 'Metabolic effort'}</dt><dd>{Math.round(model?.powerWatts ?? 0)}<small>W</small></dd></div>
      <div><dt>{model?.driving ? 'Motor energy · model' : 'Metabolic energy'}</dt><dd>{model?.driving ? ((model?.energyJ ?? 0) / 3600).toFixed(2) : ((model?.energyJ ?? 0) / 1000).toFixed(1)}<small>{model?.driving ? 'Wh' : 'kJ'}</small></dd></div>
      <div><dt>Route remaining</dt><dd>{Math.round(model?.remaining ?? 0)}<small>m</small></dd></div>
    </dl>
    {blocked && <p className="auto-warning">{model.reason}</p>}
    <div className="auto-actions"><button type="button" onClick={paused ? onResume : onPause} disabled={complete || blocked}>{paused ? 'Resume auto' : 'Pause auto'}</button><button type="button" onClick={onManual}>Take control</button></div>
    <details hidden={!expanded}><summary>About these estimates</summary><p>Energy is estimated from actual simulated movement. Walking uses your effort model. Rover power assumes 1,000 kg, terrain-dependent rolling resistance and 65% drive efficiency; it is not NASA rover telemetry. No regenerative energy is credited. Science tasks remain manual.</p></details>
  </section>
}
