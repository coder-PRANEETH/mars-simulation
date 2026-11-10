import { test, expect } from '@playwright/test';

test('opens real Jezero terrain and inspects its map layers', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore Jezero' }).click();
  await expect(page.getByRole('heading', { name: 'Jezero Expedition Planner' })).toBeVisible();
  await page.getByRole('button', { name: 'Elevation', exact: true }).click();
  await page.getByRole('button', { name: 'Hazards', exact: true }).click();
  await expect(page.getByText('Steep or locally uneven')).toBeVisible();
  await page.getByRole('img', { name: 'Detailed traverse map' }).click();
  await expect(page.getByText('Terrain class')).toBeVisible();
  await page.getByRole('button', { name: 'Crater overview' }).click();
  await expect(page.getByRole('img', { name: 'Jezero crater elevation overview' })).toBeVisible();
  await page.getByRole('button', { name: 'Open detailed traverse area' }).press('Enter');
  await expect(page.getByRole('img', { name: 'Detailed traverse map' })).toBeVisible();
  await page.getByRole('button', { name: 'Return to surface' }).click();
  await expect(page.getByText('Jezero Crater / Western Delta')).toBeVisible();
  await page.getByRole('button', { name: 'Southeast hills' }).click();
  await expect(page.getByText('Hill southeast of Jezero Crater')).toBeVisible();
  expect(errors).toEqual([]);
});
