function Gauge({ label, value, shown, max = 1, warning = false }) {
  return <div className={warning ? 'is-warning' : ''}>
    <dt>{label}</dt><dd>{shown}<meter min="0" max={max} value={Math.min(max, value)} aria-label={label} /></dd>
  </div>
}

export default function RoverTraction({ telemetry }) {
  const slip = telemetry.wheelSlip ?? 0
  const slide = telemetry.sideSpeed ?? 0
  const sink = telemetry.sinkDepth ?? 0
  const grounded = telemetry.grounded !== false
  const slipping = grounded && slip > 0.25, sliding = grounded && slide > 0.3
  const warning = slipping || sliding
  return <section className={`rover-traction ${warning ? 'has-warning' : ''}`} aria-label="Rover traction">
    <div className="rover-traction-heading"><span>ROVER / GROUND CONTACT</span><small>Simulated</small></div>
    <h2>{!grounded ? 'Wheels off the ground' : sliding ? 'Sliding sideways' : slipping ? 'Wheels slipping' : sink > 0.04 ? 'Wheels settling in soft ground' : 'Grip steady'}</h2>
    <dl>
      <Gauge label="Wheel slip" value={slip} shown={`${Math.round(slip * 100)}%`} warning={slipping} />
      <Gauge label="Side slide" value={slide} max={2} shown={<>{slide.toFixed(1)} <small>m/s</small></>} warning={sliding} />
      <Gauge label="Wheel sink" value={sink} max={0.16} shown={<>{Math.round(sink * 100)} <small>cm</small></>} warning={sink > 0.06} />
    </dl>
    {warning && <p>{sliding ? 'Ease off the turn. Let the rover regain grip.' : 'Ease off W. Spinning wheels make less progress.'}</p>}
  </section>
}
