import { segmentModel, EVA_DEFAULTS } from '../simulation/eva.js'

export default function RouteProfile({ route }) {
  if (route.points.length < 2) return null
  const samples = [{ distance: 0, y: route.points[0].y, watts: 150 }]
  let distance = 0
  for (let i = 1; i < route.points.length; i++) {
    const segment = segmentModel(route.points[i - 1], route.points[i], { ...EVA_DEFAULTS, ...route.settings })
    distance += segment.length
    samples.push({ ...route.points[i], distance, watts: segment.watts })
  }
  const low = Math.min(...samples.map((p) => p.y)), high = Math.max(...samples.map((p) => p.y))
  const peak = Math.max(...samples.map((p) => p.watts))
  const axisMax = Math.max(500, peak)
  const xy = (p, type) => `${(p.distance / Math.max(1, distance) * 250).toFixed(1)},${(75 - (type === 'y' ? (p.y - low) / Math.max(1, high - low) : p.watts / axisMax) * 60).toFixed(1)}`
  return <figure className="mission-route-profile" aria-label="Route elevation and metabolic demand profile">
    <figcaption>Across your route <span>{Math.round(high - low)} m relief · up to {Math.round(peak)} W</span></figcaption>
    <svg viewBox="0 0 250 85" role="img" aria-label="Solid colored line: terrain height and geological unit. Dashed line: model metabolic demand.">
      {samples.slice(1).map((p, i) => <line key={i} x1={samples[i].distance / Math.max(1, distance) * 250} y1={75 - (samples[i].y - low) / Math.max(1, high - low) * 60} x2={p.distance / Math.max(1, distance) * 250} y2={75 - (p.y - low) / Math.max(1, high - low) * 60} stroke={p.regionColor ?? '#8ef0d8'} strokeWidth="2" />)}
      <polyline points={samples.map((p) => xy(p, 'watts')).join(' ')} fill="none" stroke="#e7c196" strokeDasharray="3 3" />
    </svg><small>Height · bedrock colors / dashed: steady metabolic demand. Each line has its own scale.</small>
  </figure>
}
