import { test, expect } from '@playwright/test';

test('scroll zooms maps without changing picked coordinates, and pans without placing pins', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore Jezero' }).click();
  const map = page.getByRole('img', { name: 'Detailed traverse map' });
  const box = await map.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  const coords = page.getByLabel('Location inspector', { exact: true }).locator('dd').first();
  const before = await coords.textContent();
  const full = await map.getAttribute('viewBox');
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -450);
  await expect(map).not.toHaveAttribute('viewBox', full);
  await page.mouse.click(x, y);
  await expect(coords).toHaveText(before);
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Set start', exact: true }).click();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y + 35, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Set start', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Reset map zoom' }).click();
  await expect(map).toHaveAttribute('viewBox', full);
  await page.getByRole('combobox', { name: 'Map extent', exact: true }).selectOption('crater');
  const overview = page.getByRole('img', { name: 'Jezero crater elevation overview' });
  const initial = await overview.getAttribute('viewBox');
  await overview.hover();
  await page.mouse.wheel(0, -250);
  await expect(overview).not.toHaveAttribute('viewBox', initial);
});

test('scroll moves the rover camera while keeping the cursor free', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to car mode' }).click();
  await page.getByRole('button', { name: 'Enter simulation', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__MARS_SIM__.getRenderDiagnostics().vehiclePosition?.length)).toBe(3);
  const distance = () => page.evaluate(() => {
    const { cameraPosition: a, vehiclePosition: b } = window.__MARS_SIM__.getRenderDiagnostics();
    return Math.hypot(...a.map((v, i) => v - b[i]));
  });
  const before = await distance();
  await page.mouse.move(480, 320);
  await page.mouse.wheel(0, 600);
  await expect.poll(distance).toBeGreaterThan(before + 1);
  await page.mouse.wheel(0, -1000);
  await expect.poll(distance).toBeLessThan(before + .5);
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Switch to foot mode' }).click();
  await page.getByRole('button', { name: 'Resume simulation', exact: true }).click();
  const fov = await page.evaluate(() => window.__MARS_SIM__.getRenderDiagnostics().cameraFov);
  await page.mouse.wheel(0, -300);
  await expect.poll(() => page.evaluate(() => window.__MARS_SIM__.getRenderDiagnostics().cameraFov)).toBeLessThan(fov - 3);
});
