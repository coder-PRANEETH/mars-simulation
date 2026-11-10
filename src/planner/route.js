import { cellPoint, terrainClass } from './terrainGrid.js'

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

  const { width, height, dx, dz, slope, roughness, elevation, surface } = grid
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
      const material = surfacePenalty(surface?.[cell] | surface?.[next])
      const nextCost = cost + Math.hypot(horizontal, rise) * (1 + 2.2 * incline ** 2 + 2 * uneven + material)
      if (nextCost >= distance[next]) continue
      distance[next] = nextCost
      parent[next] = cell
      const remaining = Math.hypot((endColumn - nextColumn) * dx, (endRow - nextRow) * dz)
      queue.push({ cell: next, priority: nextCost + remaining, cost: nextCost })
    }
  }
  return null
}

// Mapped surface units are broad caution areas with configurable field conditions.
function surfacePenalty(flags) {
  return (flags & 1 ? 0.4 : 0) + (flags & 2 ? 0.18 : 0)
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
  const { elevation, roughness, slope, surface } = grid
  const first = { ...cellPoint(grid, path[0]), y: elevation[path[0]] }
  const points = [first]
  const waypoints = [{ ...first, distance: 0, label: 'Start' }]
  let distance = 0
  let gain = 0
  let time = 0
  let returnTime = 0
  let maxSlope = slope[path[0]]
  let lastWaypoint = 0

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]
    const to = path[i]
    const origin = points.at(-1)
    const next = { ...cellPoint(grid, to), y: elevation[to] }
    const midpoint = { x: (origin.x + next.x) / 2, y: sharedElevation(grid, from, to), z: (origin.z + next.z) / 2 }
    points.push(midpoint, next)
    maxSlope = Math.max(maxSlope, slope[to])
    const run = Math.hypot(next.x - origin.x, next.z - origin.z) / 2
    for (const [a, b] of [[origin, midpoint], [midpoint, next]]) {
      const rise = b.y - a.y
      const length = Math.hypot(run, rise)
      const penalty = 1 + Math.max(roughness[from], roughness[to])
        + surfacePenalty(surface?.[from] | surface?.[to])
        + profile.dustPenalty + (profile.thermalPenalty ?? 0)
      distance += length
      gain += Math.max(0, rise)
      time += length / profile.pace * (penalty + Math.max(0, rise) / run * 3 + Math.max(0, -rise) / run)
      returnTime += length / profile.pace * (penalty + Math.max(0, -rise) / run * 3 + Math.max(0, rise) / run)
    }
    const isStop = stop?.cell === to
    const isEnd = i === path.length - 1
    if (isEnd || isStop || distance - lastWaypoint >= 160) {
      waypoints.push({ ...next, distance, label: isEnd ? 'Destination' : isStop ? stop.name : 'Traverse' })
      lastWaypoint = distance
    }
  }

  return { points, waypoints, distance, gain, time, returnTime, maxSlope, stop }
}

export function planRoutes(grid, { start, end, profile, avoid = [], sites = [] }) {
  const blocked = new Set(avoid)
  const terrainPath = shortestPath(grid, start, end, profile, blocked)
  if (!terrainPath) return { terrain: null, science: null }

  const terrain = describeRoute(grid, terrainPath, profile)
  for (const stop of sites) {
    if (stop.cell === start || stop.cell === end) continue
    const firstLeg = shortestPath(grid, start, stop.cell, profile, blocked)
    if (!firstLeg) continue
    const secondLeg = shortestPath(grid, stop.cell, end, profile, blocked)
    if (!secondLeg) continue
    const science = describeRoute(grid, [...firstLeg, ...secondLeg.slice(1)], profile, stop)
    return { terrain, science }
  }
  return { terrain, science: null }
}
