import { useEffect, useRef, useState } from 'react'
import { advanceBudget, emptyBudget, effortWatts, transitionSpeed, returnBudget, JOULES_PER_LITRE_O2 } from './eva.js'

export function useEVAMission(terrain, telemetry, active, gravity) {
  const mission = useRef(null)
  const [display, setDisplay] = useState(null)

  function publish() {
    const m = mission.current
    if (!m) { setDisplay(null); return }
    const back = returnBudget(m.breadcrumbs, m.settings)
    const reserve = 350 * m.settings.reserveMinutes * 60 / JOULES_PER_LITRE_O2
    const oxygenLeft = Math.max(0, m.settings.oxygenLitres - m.budget.oxygenUsed)
    const margin = oxygenLeft - back.oxygenUsed - reserve
    const oxygenTime = margin * JOULES_PER_LITRE_O2 / Math.max(150, m.watts)
    const missionTime = m.settings.durationMinutes * 60 - m.budget.elapsed - back.elapsed - m.settings.reserveMinutes * 60
    const heatTime = m.watts > m.settings.coolingWatts ? (3000 * m.settings.bodyKg - m.budget.heatJ) / (m.watts - m.settings.coolingWatts) : Infinity
    const extraSeconds = Math.max(0, Math.min(oxygenTime, missionTime, heatTime))
    const atStop = m.position && Math.hypot(m.position.x - m.stop.x, m.position.z - m.stop.z) < 30
    setDisplay({ ...m.budget, settings: m.settings, oxygenLeft, margin, extraSeconds, returnSeconds: back.elapsed,
      heatKjKg: m.budget.heatJ / 1000 / m.settings.bodyKg, watts: m.watts, gait: m.gait,
      taskDone: m.taskDone, canWork: !!atStop && (telemetry.speed ?? 0) < .2 && !m.returning && !m.finished,
      returning: m.returning, finished: m.finished, storm: m.storm, stopName: m.stop.label ?? 'Science stop',
      warning: margin < 0 || missionTime < 0 || heatTime <= 0 || back.elapsed > 7200 || m.storm })
  }

  useEffect(() => {
    const m = mission.current
    if (!m || !terrain || !telemetry.position) return
    const now = telemetry.elapsedSeconds ?? 0
    const seconds = active && m.lastTime != null ? Math.max(0, Math.min(.3, now - m.lastTime)) : 0
    m.lastTime = active ? now : null
    if (m.finished) return
    const position = { ...telemetry.position, y: terrain.sampleHeight(telemetry.position.x, telemetry.position.z),
      effortTerrain: 1 + (telemetry.surface?.roughness ?? 0) + Math.max(0, 1 / (telemetry.surface?.speedFactor ?? 1) - 1) }
    const previous = m.position ?? position
    const run = Math.hypot(position.x - previous.x, position.z - previous.z)
    const grade = run > .03 ? Math.max(-.8, Math.min(.8, (position.y - previous.y) / run)) : 0
    m.watts = effortWatts(telemetry.speed ?? 0, grade, position.effortTerrain, m.settings)
    m.gait = (telemetry.speed ?? 0) < .1 ? 'Standing' : telemetry.speed < transitionSpeed(gravity, m.settings.legMeters) ? 'Walking' : 'Loping'
    if (seconds) {
      m.budget = advanceBudget(m.budget, seconds, m.watts, m.settings)
      const last = m.breadcrumbs.at(-1)
      if (Math.hypot(position.x - last.x, position.z - last.z) > 1) {
        if (m.returning && m.breadcrumbs.length > 1) {
          // Returning consumes the recorded trail rather than growing a new one.
          let closest = m.breadcrumbs.length - 1, distance = Infinity
          m.breadcrumbs.forEach((point, index) => {
            const d = Math.hypot(position.x - point.x, position.z - point.z)
            if (d < distance) { distance = d; closest = index }
          })
          if (distance < 2) m.breadcrumbs = m.breadcrumbs.slice(0, closest + 1)
          else m.breadcrumbs.push(position)
        } else if (!m.returning) m.breadcrumbs.push(position)
      }
      if (m.returning && Math.hypot(position.x - m.base.x, position.z - m.base.z) < 5) m.finished = true
    }
    m.position = position
    publish()
  }, [terrain, telemetry, active, gravity])

  return {
    display,
    begin(route) {
      if (!route.eva) { mission.current = null; setDisplay(null); return }
      const first = { ...route.points[0] }
      mission.current = { settings: route.eva.settings, stop: route.eva.stop, base: first, position: first,
        breadcrumbs: [first], budget: emptyBudget(), watts: 150, gait: 'Standing', lastTime: null,
        taskDone: false, returning: false, finished: false, storm: false }
      publish()
    },
    end() { mission.current = null; setDisplay(null) },
    work() {
      const m = mission.current
      if (!m || !display?.canWork || m.taskDone || m.settings.taskMinutes === 0) return
      m.budget = advanceBudget(m.budget, m.settings.taskMinutes * 60, m.settings.taskWatts, m.settings)
      m.taskDone = true
      publish()
    },
    storm() { if (mission.current) { mission.current.storm = !mission.current.storm; publish() } },
    headHome() {
      const m = mission.current
      if (!m || m.finished) return null
      m.returning = true
      const points = [...m.breadcrumbs, m.position].reverse().map(({ x, y, z }) => ({ x, y, z }))
      const waypoints = [{ ...points[0], label: 'Return start', distance: 0 }]
      let distance = 0, previousWaypoint = 0
      for (let i = 1; i < points.length; i++) {
        distance += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
        if (distance - previousWaypoint >= 50) { waypoints.push({ ...points[i], label: 'Traverse', distance }); previousWaypoint = distance }
      }
      waypoints.push({ ...m.base, label: 'Simulated base', distance })
      publish()
      return { points, waypoints, distance }
    },
  }
}
