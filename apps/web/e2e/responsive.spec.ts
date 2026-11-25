import { expect, test } from '@playwright/test'

test('en el móvil no hay desplazamiento horizontal', async ({ page }) => {
  await page.goto('/#tablero')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await expect(page.locator('#tablero .shogi-grid')).toBeVisible()
})
