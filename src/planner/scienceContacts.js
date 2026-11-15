import { cellPoint, terrainClass } from './terrainGrid.js'

/** Targets are adjacent cells across actual mapped boundaries, not invented point sites. */
export function contactTargets(grid, start, end, profile, avoid) {
  if (!grid.photoUnitIds) return []
  const best = new Map()
  const s = cellPoint(grid, start), e = cellPoint(grid, end)
  const open = (i) => ['open', 'caution'].includes(terrainClass(grid, i, profile.maxSlope, avoid))
  for (let a = 0; a < grid.photoUnitIds.length; a++) {
    const unitA = grid.photoUnits[grid.photoUnitIds[a]]
    if (!unitA) continue
    for (const b of [a % grid.width < grid.width - 1 ? a + 1 : -1, a + grid.width]) {
      if (b < 0 || b >= grid.photoUnitIds.length) continue
      const unitB = grid.photoUnits[grid.photoUnitIds[b]]
      if (!unitB || unitA.id === unitB.id) continue
      const groups = [unitA.group, unitB.group]
      if (!groups.includes('delta') || !(groups.includes('floor') || groups.includes('margin'))) continue
      if ([a, b].some((i) => grid.coverIds?.[i] && grid.coverIds[i] !== 6) || !open(a) || !open(b)) continue
      const point = cellPoint(grid, a)
      const proximity = Math.hypot(point.x - s.x, point.z - s.z) + Math.hypot(point.x - e.x, point.z - e.z)
      const key = [unitA.id, unitB.id].sort((x, y) => x - y).join(':')
      if ((best.get(key)?.proximity ?? Infinity) <= proximity) continue
      best.set(key, { id: `contact-${key}`, kind: 'contact', name: `${unitA.symbol} ↔ ${unitB.symbol} transect`,
        cell: b, cells: [a, b], proximity, habitability: 8, geology: 10,
        description: 'Cross exposed delta and floor or margin units to compare their contact and relative-age relationship. Derived from the 2020 field map; exposure and access require field verification.' })
    }
  }
  return [...best.values()].sort((a, b) => a.proximity - b.proximity).slice(0, 4)
}
