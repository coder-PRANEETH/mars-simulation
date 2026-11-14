import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zoomView, boundView } from './mapViewport.js'

test('map zoom keeps cursor position stable and constrains scale and panning', () => {
  const full = { x: 0, y: 0, width: 6000, height: 3600 }
  const anchor = { x: 2200, y: 1700 }
  const zoomed = zoomView(full, anchor, .5, 6000, 3600)
  assert.equal((anchor.x - zoomed.x) / zoomed.width, anchor.x / full.width)
  assert.equal((anchor.y - zoomed.y) / zoomed.height, anchor.y / full.height)
  assert.deepEqual(zoomView(zoomed, anchor, 100, 6000, 3600), full)
  assert.equal(zoomView(full, anchor, .001, 6000, 3600).width, 500)
  assert.deepEqual(boundView({ x: -10, y: 4000, width: 3000, height: 1800 }, 6000, 3600), { x: 0, y: 1800, width: 3000, height: 1800 })
})
