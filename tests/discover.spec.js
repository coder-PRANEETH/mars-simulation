import { test, expect } from '@playwright/test';

test('children can reveal Mars facts, switch questions and reach the exploration controls on a phone', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const lesson = page.getByRole('complementary', { name: 'Discover Mars' });
  await expect(lesson.getByRole('heading')).toHaveText('Could you jump higher on Mars?');
  await expect(lesson.getByText(/Mars has about 38%/)).toBeHidden();
  await lesson.getByRole('button', { name: 'Reveal answer' }).click();
  await expect(lesson.getByText(/Mars has about 38%/)).toBeVisible();
  await expect(lesson.getByRole('link', { name: 'Learn more with NASA' })).toHaveAttribute('href', /^https:\/\/www.jpl.nasa.gov\//);
  await lesson.getByRole('button', { name: 'Next question' }).click();
  await expect(lesson.getByRole('heading')).toHaveText('Why is the Red Planet red?');
  await expect(lesson.getByRole('button', { name: 'Reveal answer' })).toHaveAttribute('aria-expanded', 'false');
  await lesson.getByRole('button', { name: 'Reveal answer' }).click();
  await expect(lesson.getByText(/Iron minerals/)).toBeVisible();
  await lesson.getByRole('button', { name: 'Next question' }).click();
  await expect(lesson.getByRole('heading')).toHaveText('Did Jezero crater have a lake?');
  await lesson.getByRole('button', { name: 'Next question' }).click();
  await expect(lesson.getByRole('heading')).toHaveText('Could you jump higher on Mars?');
  await page.getByRole('button', { name: 'Discover Mars' }).click();
  await expect(lesson).toHaveCount(0);
  await page.getByRole('button', { name: 'Discover Mars' }).click();
  await expect(lesson).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const enter = page.getByRole('button', { name: 'Enter simulation', exact: true });
  await expect(enter).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Switch to car mode' })).toBeInViewport();
  await lesson.getByRole('button', { name: 'Reveal answer' }).click();
  await expect(lesson.getByText(/Mars has about 38%/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
