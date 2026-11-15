import { cellPoint, terrainClass } from './terrainGrid.js'
import { EVA_DEFAULTS, effortWatts, forecastEVA, walkingSpeed } from '../simulation/eva.js'
import { contactTargets } from './scienceContacts.js'
import { terrainRisk } from './routeRisk.js'

const directions = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
]

class MinHeap {
  items = []

  push(entry) {
    let index = this.items.length
    this.items.push(entry)
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.items[parent].priority <= entry.priority) break
      this.items[index] = this.items[parent]
      index = parent
    }
    this.items[index] = entry
  }

  pop() {
    const first = this.items[0]
    const last = this.items.pop()
    if (!this.items.length) return first
    let index = 0
    while (index * 2 + 1 < this.items.length) {
      let child = index * 2 + 1
      if (this.items[child + 1]?.priority < this.items[child].priority) child++
      if (this.items[child].priority >= last.priority) break
      this.items[index] = this.items[child]
      index = child
    }
    this.items[index] = last
    return first
  }
}

function passable(grid, index, profile, avoid) {
  const kind = terrainClass(grid, index, profile.maxSlope, avoid)
  return kind === 'open' || kind === 'caution'
}

function shortestPath(grid, start, end, profile, avoid) {
  if (!passable(grid, start, profile, avoid) || !passable(grid, end, profile, avoid)) return null

  const { width, height, dx, dz, slope, roughness, elevation } = grid
  const endColumn = end % width
  const endRow = Math.floor(end / width)
  const distance = new Float64Array(width * height).fill(Infinity)
  const parent = new Int32Array(distance.length).fill(-1)
  const queue = new MinHeap()
  distance[start] = 0
  queue.push({ cell: start, priority: 0, cost: 0 })

  while (queue.items.length) {
    const { cell, cost } = queue.pop()
    if (cost !== distance[cell]) continue
    if (cell === end) {
      const path = []
      for (let index = end; index !== -1; index = parent[index]) path.push(index)
      return path.reverse()
    }

    const column = cell % width
    const row = Math.floor(cell / width)
    for (const [x, z] of directions) {
      const nextColumn = column + x
      const nextRow = row + z
      if (nextColumn < 0 || nextColumn >= width || nextRow < 0 || nextRow >= height) continue
      const next = nextRow * width + nextColumn
      if (!passable(grid, next, profile, avoid)) continue
      // A diagonal must have room on both sides of the shared corner.
      if (x && z && (!passable(grid, cell + x, profile, avoid) || !passable(grid, cell + z * width, profile, avoid))) continue

      const horizontal = Math.hypot(x * dx, z * dz)
      const rise = elevation[next] - elevation[cell]
      const incline = Math.max(slope[cell], slope[next]) / profile.maxSlope
      const uneven = Math.max(roughness[cell], roughness[next])
      const material = surfacePenalty(grid, cell, next)
      let edgeCost = Math.hypot(horizontal, rise) * (1 + 2.2 * incline ** 2 + 2 * uneven + material)
      if (profile.optimize === 'energy') {
        const factor = 1 + uneven + material + profile.dustPenalty + (profile.thermalPenalty ?? 0)
        const midpointHeight = sharedElevation(grid, cell, next)
        edgeCost = 0
        for (const delta of [midpointHeight - elevation[cell], elevation[next] - midpointHeight]) {
          const segmentLength = Math.hypot(horizontal / 2, delta)
          const speed = walkingSpeed(profile.pace, delta / (horizontal / 2), factor)
          edgeCost += segmentLength / speed * effortWatts(speed, delta / (horizontal / 2), 1 + uneven + material, profile.eva)
        }
      }
      const nextCost = cost + edgeCost
      if (nextCost >= distance[next]) continue
      distance[next] = nextCost
      parent[next] = cell
      const remaining = Math.hypot((endColumn - nextColumn) * dx, (endRow - nextRow) * dz)
      queue.push({ cell: next, priority: nextCost + remaining * (profile.optimize === 'energy' ? effortWatts(0, 0, 1, profile.eva) / profile.pace : 1), cost: nextCost })
    }
  }
  return null
}

// Mapped surface units are broad caution areas with configurable field conditions.
function surfacePenalty(grid, from, to) {
  const flags = grid.surface?.[from] | grid.surface?.[to]
  const legacy = (flags & 1 ? 0.4 : 0) + (flags & 2 ? 0.18 : 0)
  const speed = Math.min(grid.groundSpeed?.[from] ?? 1, grid.groundSpeed?.[to] ?? 1)
  return Math.max(legacy, 1 / Math.max(0.2, speed) - 1)
}

function sharedElevation(grid, from, to) {
  const { width, heights } = grid
  const row = Math.floor(from / width)
  const column = from % width
  const x = to % width - column
  const z = Math.floor(to / width) - row
  const post = (row + Math.max(0, z)) * (width + 1) + column + Math.max(0, x)
  if (x && z) return heights[post]
  if (x) return (heights[post] + heights[post + width + 1]) / 2
  return (heights[post] + heights[post + 1]) / 2
}

function describeRoute(grid, path, profile, stop) {
  const { elevation, roughness, slope } = grid
  const first = { ...cellPoint(grid, path[0]), y: elevation[path[0]] }
  const points = [first]
  const waypoints = [{ ...first, distance: 0, label: 'Start' }]
  let distance = 0
  let gain = 0
  let time = 0
  let returnTime = 0
  let maxSlope = slope[path[0]]
  let riskSum = 0, cautionDistance = 0, peakRisk = 0
  let lastWaypoint = 0
  const contacts = []
  const regionIds = new Set(path.map((cell) => grid.unitIds?.[cell]).filter(Boolean))

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]
    const to = path[i]
    const aUnit = grid.photoUnits?.[grid.photoUnitIds?.[from]]
    const bUnit = grid.photoUnits?.[grid.photoUnitIds?.[to]]
    if (aUnit && bUnit && aUnit.id !== bUnit.id) contacts.push({ from: aUnit.symbol, to: bUnit.symbol, distance, exposed: !grid.coverIds?.[to] || grid.coverIds[to] === 6 })
    const origin = points.at(-1)
    const next = { ...cellPoint(grid, to), y: elevation[to], regionSymbol: bUnit?.symbol, regionColor: bUnit?.color }
    const midpoint = { x: (origin.x + next.x) / 2, y: sharedElevation(grid, from, to), z: (origin.z + next.z) / 2, regionSymbol: aUnit?.symbol, regionColor: aUnit?.color }
    points.push(midpoint, next)
    maxSlope = Math.max(maxSlope, slope[to])
    const run = Math.hypot(next.x - origin.x, next.z - origin.z) / 2
    for (const [a, b] of [[origin, midpoint], [midpoint, next]]) {
      const rise = b.y - a.y
      const length = Math.hypot(run, rise)
      const penalty = 1 + Math.max(roughness[from], roughness[to])
        + surfacePenalty(grid, from, to)
        + profile.dustPenalty + (profile.thermalPenalty ?? 0)
      const risk = Math.max(terrainRisk(grid, from, profile.maxSlope).value, terrainRisk(grid, to, profile.maxSlope).value)
      riskSum += length * risk
      peakRisk = Math.max(peakRisk, risk)
      if (terrainClass(grid, to, profile.maxSlope, null) === 'caution') cautionDistance += length
      distance += length
      gain += Math.max(0, rise)
      b.seconds = length / profile.pace * (penalty + Math.max(0, rise) / run * 3 + Math.max(0, -rise) / run)
      b.returnSeconds = length / profile.pace * (penalty + Math.max(0, -rise) / run * 3 + Math.max(0, rise) / run)
      b.effortTerrain = 1 + Math.max(roughness[from], roughness[to]) + surfacePenalty(grid, from, to)
      time += b.seconds
      returnTime += b.returnSeconds
    }
    const isStop = stop?.cell === to
    const isEnd = i === path.length - 1
    if (isEnd || isStop || distance - lastWaypoint >= 160) {
      waypoints.push({ ...next, distance, label: isEnd ? 'Destination' : isStop ? stop.name : 'Traverse' })
      lastWaypoint = distance
    }
  }

  const route = { points, waypoints, distance, gain, time, returnTime, maxSlope, stop, contacts, settings: profile.eva, risk: { mean: distance ? riskSum / distance : 0, peak: peakRisk, cautionDistance },
    regions: [...regionIds].map((id) => grid.units[id]?.label).filter(Boolean) }
  const forecast = forecastEVA(route, { ...profile.eva, pace: profile.pace })
  route.energyJ = forecast.outward.energyJ
  route.budgetFeasible = forecast.feasible
  return route
}

export function planRoutes(grid, { start, end, profile, avoid = [], sites = [] }) {
  profile = { maxSlope: 20, pace: 1, dustPenalty: 0, thermalPenalty: 0, ...profile, eva: { ...EVA_DEFAULTS, ...profile.eva } }
  const blocked = new Set(avoid)
  const terrainPath = shortestPath(grid, start, end, profile, blocked)
  if (!terrainPath) return { terrain: null, energy: null, science: null }
  const terrain = { ...describeRoute(grid, terrainPath, profile), strategy: 'Easier terrain' }
  const energyProfile = { ...profile, optimize: 'energy' }
  const energyPath = shortestPath(grid, start, end, energyProfile, blocked)
  const energy = energyPath && { ...describeRoute(grid, energyPath, profile), strategy: 'Save your energy' }
  let science = null, bestScore = -Infinity
  const candidates = profile.scienceStop === 'auto' || !profile.scienceStop
    ? [...sites.slice(0, 7), ...contactTargets(grid, start, end, profile, blocked)] : sites
  for (const stop of candidates) {
    if (stop.cell === start || stop.cell === end) continue
    const targets = stop.cells ?? [stop.cell]
    let current = start, path = [start], reachable = true
    for (const target of [...targets, end]) {
      const leg = shortestPath(grid, current, target, energyProfile, blocked)
      if (!leg) { reachable = false; break }
      path.push(...leg.slice(1)); current = target
    }
    if (!reachable) continue
    const option = describeRoute(grid, path, profile, stop)
    if (profile.requireBudget && !option.budgetFeasible) continue
    const priority = stop[profile.objective ?? 'habitability'] ?? 5
    const detourEnergy = Math.max(0, option.energyJ - (energy?.energyJ ?? terrain.energyJ))
    const score = priority / (1 + detourEnergy / 250000 + Math.max(0, option.time - terrain.time) / 1800 + option.risk.mean)
    if (score > bestScore) { science = { ...option, scienceScore: score }; bestScore = score }
  }
  return { terrain, energy, science }
}
