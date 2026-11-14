import { transitionSpeed } from '../simulation/eva.js'

export default function EVAPlanner({ settings, onChange, plan }) {
  const field = (key, label, min, max, step = 1) => <label className="eva-setting" key={key}>{label}
    <input type="number" min={min} max={max} step={step} value={settings[key]} onChange={(event) => {
      const value = event.target.valueAsNumber
      if (Number.isFinite(value)) onChange({ ...settings, [key]: Math.min(max, Math.max(min, value)) })
    }} /></label>
  return <section className="eva-planner" aria-label="Marswalk life support planner">
    <p className="expedition-eyebrow">PACK FOR THE WAY HOME</p><h2>Your Marswalk</h2>
    <p>The start pin is your simulated base and shelter. The plan includes retracing the route, science work and a reserve.</p>
    {plan ? <>
      <strong className={`eva-status ${plan.feasible ? '' : 'is-warning'}`} role="status">{plan.feasible ? 'Within your modelled budget' : 'Revise this Marswalk'}</strong>
      <dl className="expedition-readings">
        <dt>O₂ including reserve</dt><dd>{Math.round(plan.oxygenUsed + plan.reserveOxygen)} / {settings.oxygenLitres} L</dd>
        <dt>Peak stored heat</dt><dd>{plan.peakHeatKjKg.toFixed(2)} / 3 kJ/kg</dd>
        <dt>Return to base</dt><dd>{Math.ceil(plan.returnSeconds / 60)} min</dd>
      </dl>
      <meter aria-label="Oxygen budget including reserve" min="0" max={settings.oxygenLitres} value={Math.min(settings.oxygenLitres, plan.oxygenUsed + plan.reserveOxygen)} />
      {plan.reasons.map((reason) => <p className="eva-warning" key={reason}>{reason}</p>)}
      <p>Science work: {settings.taskMinutes} min at {plan.stop.label ?? plan.stop.name ?? 'the destination'}. Green/red route bands show the oxygen, time and shelter return check. Heat is checked over the full excursion.</p>
    </> : <p>Choose a start and destination to check your supplies.</p>}
    {plan && <details className="expedition-disclosure">
      <summary>Energy & science breakdown</summary>
      <dl className="expedition-readings">
        <dt>Oxygen · walk + work + return</dt><dd>{Math.round(plan.oxygenUsed)} L</dd>
        <dt>Held in reserve</dt><dd>{Math.round(plan.reserveOxygen)} L</dd>
        <dt>Oxygen margin</dt><dd>{Math.round(plan.oxygenMargin)} L</dd>
        <dt>Metabolic energy</dt><dd>{(plan.energyJ / 1e6).toFixed(2)} MJ</dd>
        <dt>Science per oxygen</dt><dd>{plan.sciencePerLitre.toFixed(3)} min/L</dd>
      </dl>
    </details>}
    <details className="expedition-disclosure">
      <summary>Suit & science plan</summary>
      <div className="eva-settings">
        {field('oxygenLitres', 'Usable oxygen (L, STPD)', 50, 1200, 25)}
        {field('coolingWatts', 'Cooling capacity (W)', 150, 700, 25)}
        {field('durationMinutes', 'Mission duration (min)', 30, 480, 30)}
        {field('reserveMinutes', 'Return reserve (min)', 15, 90, 5)}
        {field('taskMinutes', 'Science work (min)', 0, 180, 5)}
        <label className="eva-setting">Science effort<select aria-label="Science effort" value={settings.taskWatts} onChange={(event) => onChange({ ...settings, taskWatts: +event.target.value })}>
          <option value="220">Photograph · 220 W</option><option value="350">Survey · 350 W</option><option value="500">Sampling · 500 W</option>
        </select></label>
      </div>
    </details>
    <details className="expedition-disclosure">
      <summary>Astronaut & model assumptions</summary>
      <div className="eva-settings">{field('bodyKg', 'Body mass (kg)', 45, 120)}{field('suitKg', 'Suit + tools (kg)', 10, 150)}{field('legMeters', 'Leg length (m)', .6, 1.2, .05)}</div>
      <p>Predicted walk–lope transition: {transitionSpeed(3.71, settings.legMeters).toFixed(2)} m/s at Mars gravity. This is a Froude-number estimate, not a speed limit.</p>
      <p>Educational estimates, not a validated Mars suit or medical model. Effort rises with speed, grade, carried mass and rough/soft ground. Curves and task rates are our assumptions. Oxygen excludes leakage and system overhead. All metabolic heat is treated as heat load; cooling is constant and excludes solar, wind and contact heat transfer. No body temperature, heart rate or CO₂ readings are invented.</p>
      <p>The 3 kJ/kg heat ceiling is an illustrative reference to NASA’s nominal heat-storage criterion; NASA uses detailed human thermal models. The 2-hour shelter rule is a scenario choice. No actual habitat is mapped.</p>
      <a href="https://ntrs.nasa.gov/citations/20260002884" target="_blank" rel="noreferrer">NASA Mars PLSS study ↗</a><br />
      <a href="https://www.nasa.gov/reference/11-0-spacesuits-vol-2/" target="_blank" rel="noreferrer">NASA spacesuit requirements ↗</a>
    </details>
  </section>
}

export function EVAReturnLayer({ plan, metadata }) {
  const checks = plan.returnChecks
  const firstFail = checks.findIndex((point) => !point.canReturn)
  const parts = firstFail < 0 ? [checks, []] : [checks.slice(0, firstFail), checks.slice(Math.max(0, firstFail - 1))]
  return <g aria-hidden="true" pointerEvents="none">{parts.map((part, index) => part.length > 1 && <polyline key={index}
    points={part.map(({ x, z }) => `${x + metadata.widthMeters / 2},${z + metadata.depthMeters / 2}`).join(' ')}
    fill="none" stroke={index ? '#f18c7b' : '#93d9b9'} strokeWidth="8" opacity=".55" vectorEffect="non-scaling-stroke" />)}</g>
}
