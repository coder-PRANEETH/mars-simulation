import { test, expect } from '@playwright/test'
import { openJezero } from './helpers.js'

async function shortRoute(page, offset = 8) {
  await page.goto('/')
  await openJezero(page)
  await page.getByRole('combobox', { name: 'Map extent', exact: true }).selectOption('local')
  await page.getByRole('button', { name: 'Set start', exact: true }).click()
  const landing = page.getByRole('button', { name: 'Octavia E. Butler Landing Site', exact: true })
  await landing.click()
  await landing.hover()
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -300)
  await page.getByRole('button', { name: 'Map layers', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Science sites', exact: true }).uncheck()
  await page.keyboard.press('Escape')
  const target = await page.getByRole('img', { name: 'Detailed traverse map' }).evaluate((svg, offset) => {
    const t = window.__MARS_PLANNER__.getTerrain()
    const p = t.location(18.44462715, 77.45088572)
    const q = new DOMPoint(p.x + t.metadata.widthMeters / 2 + offset, p.z + t.metadata.depthMeters / 2).matrixTransform(svg.getScreenCTM())
    return { x: q.x, y: q.y }
  }, offset)
  await page.mouse.click(target.x, target.y)
  await expect(page.getByRole('button', { name: 'Drive route', exact: true })).toBeEnabled({ timeout: 30000 })
  await page.getByRole('checkbox', { name: 'Auto follow route', exact: true }).check()
}

const telemetry = (page) => page.evaluate(() => window.__MARS_SIM__.getTelemetry())

test('astronaut automatically follows a chosen route, pauses, resumes and arrives with energy statistics', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await shortRoute(page)
  await page.getByRole('button', { name: 'Walk route', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Automatic route statistics' })
  await expect(panel).toBeVisible()
  await expect(page.getByLabel('Traverse guidance')).toContainText('Next stop')
  await expect.poll(async () => (await telemetry(page)).auto?.progress, { timeout: 20000 }).toBeGreaterThan(1)
  await expect(panel).toContainText('Metabolic energy')
  await expect.poll(async () => (await telemetry(page)).auto?.energyJ).toBeGreaterThan(0)
  await panel.getByRole('button', { name: 'Pause auto', exact: true }).click()
  await expect.poll(async () => (await telemetry(page)).auto?.status).toBe('Paused')
  const paused = (await telemetry(page)).auto
  await page.waitForTimeout(600)
  expect((await telemetry(page)).auto.elapsed).toBeCloseTo(paused.elapsed, 2)
  await panel.getByRole('button', { name: 'Resume auto', exact: true }).click()
  await expect(panel).toContainText('Destination reached', { timeout: 90000 })
  expect((await telemetry(page)).auto.fraction).toBe(1)
  await expect(page.getByLabel('Traverse guidance')).toContainText('You reached your destination!')
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull()
  await expect(page.getByRole('region', { name: 'Live telemetry' }).locator('dt')).toHaveText(['Wind', 'Temperature', 'Coordinates', 'Speed'])
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(panel.getByRole('button', { name: 'Toggle automatic route statistics' })).toHaveAttribute('aria-expanded', 'false')
  await expect(panel.getByRole('button', { name: 'Take control' })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('rover auto mode shows throttle and motor energy and yields immediately to manual input', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await shortRoute(page, 24)
  await page.getByRole('button', { name: 'Drive route', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Automatic route statistics' })
  await expect(panel).toContainText('Throttle')
  await expect.poll(async () => (await telemetry(page)).auto?.throttle, { timeout: 20000 }).toBeGreaterThan(0)
  await expect.poll(async () => (await telemetry(page)).auto?.energyJ).toBeGreaterThan(0)
  await expect(panel).toContainText('Motor energy · model')
  await page.keyboard.press('Escape')
  await expect(panel.getByRole('button', { name: 'Resume auto', exact: true })).toBeVisible()
  await panel.getByRole('button', { name: 'Resume auto', exact: true }).click()
  await page.keyboard.down('KeyW')
  await expect(panel).toHaveCount(0)
  await page.keyboard.up('KeyW')
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull()
  expect(errors).toEqual([])
})
