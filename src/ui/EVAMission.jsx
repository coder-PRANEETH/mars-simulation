import { useState } from 'react'

export default function EVAMission({ model, paused, onReturn, onWork, onStorm, onEnd }) {
  const [expanded, setExpanded] = useState(false)
  if (!model) return null
  const status = model.finished ? 'Back at your base' : model.storm ? 'Practice alert · return to shelter' : model.warning ? 'Check supplies · head home' : model.returning ? 'Retracing your trail' : paused ? 'Marswalk paused' : 'Marswalk in progress'
  return <aside className={`eva-mission ${paused ? 'is-paused' : ''} ${model.warning ? 'has-warning' : ''}`} aria-label="Marswalk suit model">
    <button type="button" className="eva-mission-heading" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><span>SUIT MODEL · {paused ? 'PAUSED' : 'SIMULATED'}</span><span>{expanded ? '−' : '+'}</span></button>
    <strong>{status}</strong>
    <div className="eva-mission-summary"><span>O₂ <b>{model.oxygenLeft.toFixed(1)} L</b></span><span>Return <b>{Math.ceil(model.returnSeconds / 60)} min</b></span><span>{Math.round(model.watts)} W</span></div>
    {expanded && <div className="eva-mission-details">
      <dl><dt>Gait estimate</dt><dd>{model.gait}</dd><dt>Stored heat</dt><dd>{model.heatKjKg.toFixed(2)} / 3 kJ/kg</dd><dt>O₂ after return + reserve</dt><dd>{model.margin.toFixed(1)} L</dd><dt>Extra time at this effort</dt><dd>{Math.floor(model.extraSeconds / 60)} min</dd><dt>Mission clock</dt><dd>{Math.floor(model.elapsed / 60)} min</dd></dl>
      <button type="button" onClick={onReturn} disabled={model.finished || model.returning}>Head home · retrace trail</button>
      <button type="button" disabled={!model.canWork || model.taskDone || !model.settings.taskMinutes} onClick={onWork}>{model.taskDone ? 'Science work logged' : `Log ${model.settings.taskMinutes} min of science`}</button>
      {!model.taskDone && <p>Stop within 30 m of {model.stopName} to log work. This advances the model clock by the planned task time.</p>}
      <button type="button" aria-pressed={model.storm} onClick={onStorm}>Practice a solar-storm alert</button>
      <p>Scenario only: no live radiation or storm feed. Return time follows your recorded footsteps. Press Esc to use these controls. This model does not predict body temperature or medical status.</p>
      <button type="button" onClick={onEnd}>End suit simulation</button>
    </div>}
  </aside>
}
