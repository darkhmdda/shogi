import { expect, test, type Locator, type Page } from '@playwright/test'

/** Pulsa una casilla por su etiqueta (por ejemplo "7七"). */
const square = (scope: Locator | Page, label: string) => scope.locator(`button[aria-label^="${label}"]`)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('la portada muestra las secciones principales', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Aprende paso a paso' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Problemas de mate' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Juega y practica' })).toBeVisible()
  await page.getByRole('link', { name: /Practicar/ }).click()
  await expect(page).toHaveURL(/#problemas$/)
})

test('se completa la primera lección', async ({ page }) => {
  const lessons = page.locator('#aprender')
  await square(lessons, '7七').click()
  await square(lessons, '7六').click()
  await expect(lessons.locator('.training-feedback')).toContainText('alfil')
  await lessons.getByRole('button', { name: 'Siguiente paso' }).click()
  await square(lessons, '5五').click()
  await square(lessons, '5四').click()
  await expect(lessons.locator('.training-progress')).toContainText('1 de 16')
})

test('una jugada que no cumple el objetivo se explica', async ({ page }) => {
  const lessons = page.locator('#aprender')
  await square(lessons, '2七').click()
  await square(lessons, '2六').click()
  await expect(lessons.locator('.training-feedback')).toContainText('no es el objetivo')
})

test('se resuelve un problema de mate en 1', async ({ page }) => {
  const puzzles = page.locator('#problemas')
  await puzzles.locator('.shogi-hand-piece').first().click()
  await square(puzzles, '5二').click()
  await expect(puzzles.locator('.training-feedback')).toContainText('Problema resuelto')
  await expect(page.locator('.progress-strip')).toContainText('1/20')
})

test('el tsume exige dar jaque', async ({ page }) => {
  const puzzles = page.locator('#problemas')
  await puzzles.locator('.shogi-hand-piece').first().click()
  await square(puzzles, '9九').click()
  await expect(puzzles.locator('.training-feedback')).toContainText('debe dar jaque')
})

test('la máquina responde, se puede deshacer y la partida se recupera', async ({ page }) => {
  const board = page.locator('#tablero')
  await square(board, '7七').click()
  await expect(board.locator('.move-hint')).toHaveCount(1)
  await square(board, '7六').click()
  await expect(board.locator('.kifu li')).toHaveCount(2, { timeout: 10_000 })
  await expect(board.locator('.kifu li').first()).toHaveText('▲7六歩')

  await page.reload()
  await expect(page.locator('#tablero .kifu li')).toHaveCount(2)
  await expect(page.locator('#tablero .shogi-message')).toContainText('Partida recuperada')

  await page.locator('#tablero').getByRole('button', { name: 'Deshacer' }).click()
  await expect(page.locator('#tablero .kifu li')).toHaveCount(0)
})

test('los movimientos ilegales se explican', async ({ page }) => {
  const board = page.locator('#tablero')
  await square(board, '2八').click()
  await square(board, '5五').click()
  await expect(board.locator('.shogi-message')).toContainText('no puede saltar')
})

test('se carga una posición SFEN', async ({ page }) => {
  const board = page.locator('#tablero')
  await board.locator('summary', { hasText: 'Exportar e importar' }).click()
  await board.locator('textarea').fill('4k4/9/4P4/9/9/9/9/9/4K4 b G 1')
  await board.getByRole('button', { name: 'Cargar SFEN' }).click()
  await expect(board.locator('.shogi-message')).toContainText('SFEN cargada')
  await board.locator('.shogi-hand-piece').click()
  await square(board, '5二').click()
  await expect(board.locator('.shogi-turn')).toContainText('Jaque mate')
})

test('se resuelve un mate en 5 contra la defensa automática', async ({ page }) => {
  const puzzles = page.locator('#problemas')
  await puzzles.locator('.training-chip', { hasText: /^16$/ }).click()
  await expect(puzzles.locator('.training-step')).toContainText('mate en 5')
  await puzzles.getByRole('button', { name: 'Ver solución' }).click()
  const solution = await puzzles.locator('.training-hint', { hasText: 'Solución' }).innerText()
  expect(solution.split(' ').length).toBeGreaterThanOrEqual(6)
})

test('funciona sin conexión gracias al service worker', async ({ page, context }) => {
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Juega y practica' })).toBeVisible()
  await context.setOffline(false)
})

test('la página tiene manifiesto e idioma', async ({ page }) => {
  await expect(page).toHaveTitle(/Shōgi/)
  expect(await page.locator('html').getAttribute('lang')).toBe('es')
  const manifest = await page.request.get('/manifest.webmanifest')
  expect((await manifest.json()).short_name).toBe('Shōgi')
})

test('el selector de tema cambia y recuerda el modo oscuro', async ({ page }) => {
  const fondo = () => page.locator('.app-shell').evaluate((e) => getComputedStyle(e).backgroundColor)
  const claro = await fondo()
  await page.getByRole('radio', { name: 'Oscuro' }).click()
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  const oscuro = await fondo()
  expect(oscuro).not.toBe(claro)
  await page.reload()
  expect(await fondo()).toBe(oscuro)
  // El tablero mantiene su madera en modo oscuro.
  const madera = await page.locator('#tablero .shogi-square').first().evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(madera).not.toBe(oscuro)
  await page.getByRole('radio', { name: /Automático/ }).click()
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined()
})
