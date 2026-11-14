// Educational model, not a validated prediction of suited Mars physiology.
// 4.825 kcal per STPD litre O2 (NASA CR-1726), rounded to 20.19 kJ/L.
export const JOULES_PER_LITRE_O2 = 20190
export const EVA_DEFAULTS = Object.freeze({ bodyKg: 75, suitKg: 50, legMeters: .9,
  oxygenLitres: 600, coolingWatts: 450, durationMinutes: 240, reserveMinutes: 30,
  taskMinutes: 20, taskWatts: 350, pace: 1 })
export const HEAT_CEILING_KJ_KG = 3
export const SHELTER_SECONDS = 7200
export const transitionSpeed = (gravity = 3.71, legMeters = .9) => Math.sqrt(.5 * gravity * legMeters)

export function effortWatts(speed, grade = 0, terrainFactor = 1, settings = EVA_DEFAULTS) {
  // The reference point is 350 W at 1 m/s on level firm ground, matching the
  // average design assumption in ICES-2026-158. All response curves are ours.
  return 150 * (settings.bodyKg / 75) ** .75 + 200 * Math.max(0, speed) ** 1.5
    * ((settings.bodyKg + settings.suitKg) / 125) ** .6 * Math.max(1, terrainFactor)
    * (1 + 5 * Math.max(0, grade) + Math.max(0, -grade))
}

export function advanceBudget(state, seconds, watts, settings) {
  const energy = watts * seconds
  const heat = Math.max(0, state.heatJ + (watts - settings.coolingWatts) * seconds)
  return { elapsed: state.elapsed + seconds, energyJ: state.energyJ + energy,
    oxygenUsed: state.oxygenUsed + energy / JOULES_PER_LITRE_O2,
    heatJ: heat, peakHeatJ: Math.max(state.peakHeatJ, heat), peakWatts: Math.max(state.peakWatts, watts) }
}
export const emptyBudget = () => ({ elapsed: 0, energyJ: 0, oxygenUsed: 0, heatJ: 0, peakHeatJ: 0, peakWatts: 0 })

export function segmentModel(from, to, settings) {
  const run = Math.hypot(to.x - from.x, to.z - from.z)
  const rise = to.y - from.y
  const length = Math.hypot(run, rise)
  const grade = run > .001 ? rise / run : 0
  const factor = to.effortTerrain ?? 1
  const seconds = to.seconds ?? length / settings.pace * (factor + 3 * Math.max(0, grade) + Math.max(0, -grade))
  const returnSeconds = to.returnSeconds ?? length / settings.pace * (factor + 3 * Math.max(0, -grade) + Math.max(0, grade))
  return { seconds, returnSeconds, watts: effortWatts(length / Math.max(.001, seconds), grade, factor, settings),
    returnWatts: effortWatts(length / Math.max(.001, returnSeconds), -grade, factor, settings), length }
}

export function forecastEVA(route, options = EVA_DEFAULTS) {
  if (!route?.points?.length) return null
  const settings = { ...EVA_DEFAULTS, ...options }
  const segments = route.points.slice(1).map((point, index) => segmentModel(route.points[index], point, settings))
  const stop = (route.stop ? route.waypoints.find((waypoint) => waypoint.label === route.stop.name) : null) ?? { ...route.points.at(-1), label: 'Destination' }
  let stopIndex = route.points.length - 1, nearest = Infinity
  route.points.forEach((point, index) => {
    const distance = Math.hypot(point.x - stop.x, point.z - stop.z)
    if (distance < nearest) { nearest = distance; stopIndex = index }
  })
  const reserveOxygen = 350 * settings.reserveMinutes * 60 / JOULES_PER_LITRE_O2
  let budget = emptyBudget(), backOxygen = 0, backSeconds = 0
  const returnChecks = [{ ...route.points[0], canReturn: reserveOxygen <= settings.oxygenLitres && settings.reserveMinutes <= settings.durationMinutes, distance: 0 }]
  let distance = 0
  segments.forEach((segment, index) => {
    budget = advanceBudget(budget, segment.seconds, segment.watts, settings)
    if (index + 1 === stopIndex) budget = advanceBudget(budget, settings.taskMinutes * 60, settings.taskWatts, settings)
    backOxygen += segment.returnSeconds * segment.returnWatts / JOULES_PER_LITRE_O2
    backSeconds += segment.returnSeconds
    distance += segment.length
    returnChecks.push({ ...route.points[index + 1], distance,
      canReturn: budget.oxygenUsed + backOxygen + reserveOxygen <= settings.oxygenLitres
        && budget.elapsed + backSeconds + settings.reserveMinutes * 60 <= settings.durationMinutes * 60
        && backSeconds <= SHELTER_SECONDS })
  })
  const outward = { ...budget }
  for (const segment of [...segments].reverse()) budget = advanceBudget(budget, segment.returnSeconds, segment.returnWatts, settings)
  // Reserve oxygen and duration are held aside, not counted as completed work.
  const reserveHeat = advanceBudget(budget, settings.reserveMinutes * 60, 350, settings)
  const peakHeatKjKg = reserveHeat.peakHeatJ / 1000 / settings.bodyKg
  const oxygenMargin = settings.oxygenLitres - budget.oxygenUsed - reserveOxygen
  const timeMargin = settings.durationMinutes * 60 - budget.elapsed - settings.reserveMinutes * 60
  const reasons = []
  if (oxygenMargin < 0) reasons.push('Not enough oxygen for the return and reserve.')
  if (timeMargin < 0) reasons.push('The walk, science and reserve exceed the mission duration.')
  if (peakHeatKjKg > HEAT_CEILING_KJ_KG) reasons.push('Heat storage exceeds the model ceiling. Increase cooling or reduce effort.')
  if (backSeconds > SHELTER_SECONDS) reasons.push('The return to the simulated base exceeds the 2-hour shelter scenario.')
  const workOxygen = settings.taskMinutes * 60 * settings.taskWatts / JOULES_PER_LITRE_O2
  return { ...budget, settings, stop, stopIndex, outward, returnSeconds: backSeconds, reserveOxygen,
    oxygenMargin, timeMargin, peakHeatKjKg, reasons, feasible: reasons.length === 0, returnChecks,
    sciencePerLitre: settings.taskMinutes / Math.max(.001, budget.oxygenUsed), workOxygen,
    transition: transitionSpeed(3.71, settings.legMeters) }
}

// Budget for retracing the path actually walked. It does not invent a shortcut.
export function returnBudget(breadcrumbs, settings) {
  let budget = emptyBudget()
  for (let i = breadcrumbs.length - 1; i > 0; i--) {
    const segment = segmentModel(breadcrumbs[i - 1], breadcrumbs[i], settings)
    budget = advanceBudget(budget, segment.returnSeconds, segment.returnWatts, settings)
  }
  return budget
}
