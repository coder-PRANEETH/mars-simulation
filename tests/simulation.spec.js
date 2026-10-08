import { test, expect } from '@playwright/test';

const read = (page) => page.evaluate(() => window.__MARS_SIM__.getTelemetry());
const unlock = async (page) => {
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
};
const enter = async (page) => {
  await page.getByRole('button', { name: /^(Enter|Resume) simulation/ }).click();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await expect(page.locator('.sim-hud')).toHaveClass(/is-locked/);
};
const jump = async (page) => {
  let peak = 0;
  await page.keyboard.down('Space');
  await expect.poll(async () => {
    const telemetry = await read(page);
    peak = Math.max(peak, telemetry.altitude);
    return !telemetry.grounded;
  }, { timeout: 8000, intervals: [50] }).toBe(true);
  await page.keyboard.up('Space');
  await expect.poll(async () => {
    const telemetry = await read(page);
    peak = Math.max(peak, telemetry.altitude);
    return telemetry.grounded;
  }, { timeout: 20000, intervals: [50] }).toBe(true);
  return { peak, time: (await read(page)).lastAirborneTime };
};

test('the actual Mars scene supports FPS movement, gravity changes, inspect and live environment controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /^Enter simulation/ }).waitFor();
  await expect(page.getByRole('heading', { name: 'MARS SURFACE SIMULATOR' })).toBeVisible();
  await expect.poll(async () => (await read(page)).grounded).toBe(true);
  const data = await page.evaluate(() => {
    const terrain = window.__MARS_SIM__.getTerrain();
    return { vertices: terrain.heights.length, area: terrain.metadata.areaKm2 };
  });
  expect(data.vertices).toBe(401 * 401);
  expect(data.area).toBeGreaterThan(2);
  expect(data.area).toBeLessThan(10);
  await enter(page);
  const before = await read(page);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => {
    const now = await read(page);
    return Math.hypot(now.position.x - before.position.x, now.position.z - before.position.z);
  }, { timeout: 10000 }).toBeGreaterThan(2);
  await page.keyboard.up('KeyW');
  await expect.poll(async () => (await read(page)).speed, { timeout: 8000 }).toBeLessThan(0.02);
  expect((await read(page)).altitude).toBeLessThan(0.01);
  const mars = await jump(page);
  await unlock(page);
  await page.getByRole('button', { name: /Environment/ }).click();
  await page.getByRole('button', { name: 'Earth 9.81' }).click();
  await expect(page.getByLabel('GRAVITY', { exact: true })).toHaveValue('9.81');
  await enter(page);
  const earth = await jump(page);
  expect(mars.time).toBeGreaterThan(earth.time * 2.4);
  expect(mars.peak).toBeGreaterThan(0.9);
  expect(earth.peak).toBeGreaterThan(0.2);
  expect(mars.peak).toBeGreaterThan(earth.peak * 2);
  console.log(`Actual browser jumps: Mars ${mars.peak.toFixed(2)}m/${mars.time.toFixed(2)}s; Earth ${earth.peak.toFixed(2)}m/${earth.time.toFixed(2)}s`);

  // Relative mouse events go through the real locked mouse-look handler.
  const heading = (await read(page)).heading;
  await page.evaluate(() => {
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 20, movementY: 0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 20, movementY: 100 }));
  });
  await expect.poll(async () => Math.abs((await read(page)).heading - heading), { timeout: 5000 }).toBeGreaterThan(1);
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('region', { name: 'Inspected terrain point' })).toBeVisible();
  await page.keyboard.press('F3');
  await expect(page.getByRole('region', { name: 'Physics debug telemetry' })).toBeVisible();
  await unlock(page);
  await page.getByRole('button', { name: /Environment/ }).click();
  await page.getByLabel('ATMOSPHERIC DUST').selectOption('storm');
  const wind = page.getByLabel('WIND SPEED', { exact: true });
  await wind.focus();
  await wind.press('End');
  await expect.poll(() => page.evaluate(() => window.__MARS_SIM__.getSimulation().windSpeed)).toBe(150);
  await page.getByLabel('REGOLITH SOFTNESS').focus();
  await page.getByLabel('REGOLITH SOFTNESS').press('End');
  await page.getByLabel('TRACTION / FRICTION').focus();
  await page.getByLabel('TRACTION / FRICTION').press('Home');
  const state = await page.evaluate(() => window.__MARS_SIM__.getSimulation());
  expect(state.dustLevel).toBe('storm');
  expect(state.regolithSoftness).toBe(1);
  expect(state.friction).toBe(0.1);
  await page.getByRole('button', { name: 'Terrain & data' }).click();
  await expect(page.getByRole('region', { name: 'Terrain source and attribution' })).toContainText('2.019');
  await expect(page.getByRole('region', { name: 'Terrain source and attribution' })).toContainText('HiRISE');
  await expect.poll(() => page.evaluate(() => window.__MARS_SIM__.getRenderDiagnostics().dustParticleCount)).toBe(650);
  await expect.poll(() => page.evaluate(() => window.__MARS_SIM__.getRenderDiagnostics().fogDensity)).toBeGreaterThan(0.006);
  expect(errors).toEqual([]);
});
