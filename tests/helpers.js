import { expect } from '@playwright/test'

export async function openJezero(page) {
  await page.getByRole('button', { name: 'Explore Jezero' }).click()
  const extent = page.getByRole('combobox', { name: 'Map extent', exact: true })
  await expect(extent).toHaveValue('regional')
  await expect(extent).toBeEnabled()
}
