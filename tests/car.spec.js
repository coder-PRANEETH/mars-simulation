import { test, expect } from '@playwright/test';

const telemetry = (page) => page.evaluate(() => window.__MARS_SIM__.getTelemetry());

test('drives faster than walking, steers, brakes, and switches back to foot mode', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to car mode' }).click();
  await page.getByRole('button', { name: /^Enter simulation/ }).click();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await expect(page.locator(".sim-hud")).toHaveClass(/is-locked/);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await telemetry(page)).speed, { timeout: 15000 }).toBeGreaterThan(8);
  const before = await telemetry(page);
  await page.keyboard.down('KeyD');
  await expect.poll(async () => {
    const heading = (await telemetry(page)).heading;
    return (heading - before.heading + 360) % 360;
  }, { timeout: 9000 }).toBeGreaterThan(12);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyW');
  await page.keyboard.down('Space');
  await expect.poll(async () => (await telemetry(page)).speed).toBeLessThan(0.3);
  await page.keyboard.up('Space');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  const stopped = await telemetry(page);
  await page.getByRole('button', { name: 'Switch to foot mode' }).click();
  await expect(page.getByRole('button', { name: 'Switch to car mode' })).toBeVisible();
  await expect.poll(async () => {
    const after = await telemetry(page);
    return Math.hypot(after.position.x - stopped.position.x, after.position.z - stopped.position.z);
  }).toBeLessThan(1);
  expect(errors).toEqual([]);
});
