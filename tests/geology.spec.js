import { test, expect } from '@playwright/test';

test('mapped sand changes rover handling, wheel settling and live geology information', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore Jezero' }).click();
  await page.getByRole('button', { name: 'Geologic regions', exact: true }).click();
  const regions = page.getByLabel('Geologic region explorer');
  await expect(regions.getByRole('button')).toHaveCount(6);
  await regions.getByRole('combobox').selectOption('8');
  const selected = regions.getByLabel('Selected geologic region');
  await expect(selected).toContainText('Eolian bedform unit');
  await expect(selected.getByLabel('Simulated ground response')).toContainText('Up to 16 cm');
  await page.getByRole('button', { name: 'Return to surface' }).click();
  await page.getByRole('button', { name: 'Switch to car mode' }).click();
  await page.getByRole('button', { name: 'Enter simulation', exact: true }).click();
  // Interior of a published Aeb polygon, independently checked against the source grid.
  await page.evaluate(() => window.__MARS_SIM__.reset({ x: -2136.2345575531235, z: -304, yaw: 0 }));
  const read = () => page.evaluate(() => window.__MARS_SIM__.getTelemetry());
  await expect.poll(async () => (await read()).surface.unit.symbol).toBe('Aeb');
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await read()).wheelSlip, { timeout: 10000 }).toBeGreaterThan(0.3);
  await expect.poll(async () => (await read()).sinkDepth).toBeGreaterThan(0.1);
  const moving = await read();
  expect(moving.speed).toBeGreaterThan(1);
  expect(moving.speed).toBeLessThan(7);
  expect(moving.surface.speedFactor).toBeLessThan(0.5);
  const ground = page.getByRole('button', { name: 'Current surface condition' });
  await expect(ground).toContainText('Wind-blown sand');
  await ground.click();
  await expect(page.getByRole('region', { name: 'Ground beneath you' })).toContainText('simulation assumptions');
  // Clicking a HUD control with the mouse must not steal the rover's brake.
  await page.keyboard.up('KeyW');
  await page.keyboard.down('Space');
  await expect.poll(async () => (await read()).speed).toBeLessThan(0.2);
  await page.keyboard.up('Space');
  await expect.poll(async () => {
    return page.evaluate(() => {
      const t = window.__MARS_SIM__.getTelemetry();
      const p = window.__MARS_SIM__.getRenderDiagnostics().vehiclePosition;
      return Math.abs(t.position.y - p[1] - t.sinkDepth);
    });
  }).toBeLessThan(0.02);
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await expect(page.getByRole('region', { name: 'Live telemetry' }).locator('dt')).toHaveText(['Wind', 'Temperature', 'Coordinates', 'Speed']);
  expect(errors).toEqual([]);
});
