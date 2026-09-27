import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'

test.use({ storageState: { cookies: [], origins: [] } })
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const dialog = (page) => page.getByRole('dialog', { name: 'Math & chemistry' })
async function open(page) {
  await page.goto('/')
  await expect(body(page)).toContainText('Good ideas start')
  await body(page).fill('Science lesson ')
  await body(page).press('End')
  await page.getByRole('button', { name: 'Math & chemistry', exact: true }).click()
}
async function insert(page) {
  await expect(dialog(page).locator('.science-preview img')).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Insert', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
}

test('equations preserve source, edit in place, undo and reload', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await open(page)
  await page.getByLabel('LaTeX equation').fill('E = mc^2')
  await page.getByLabel('Accessible description').fill('Mass-energy equivalence')
  await insert(page)
  const formula = body(page).locator('img[data-studio-science="math"]')
  await expect(formula).toHaveAttribute('data-studio-source', 'E = mc^2')
  await expect(formula).toHaveAttribute('src', /^data:image\/png;base64,/)
  await formula.dblclick()
  await expect(page.getByLabel('LaTeX equation')).toHaveValue('E = mc^2')
  await page.getByLabel('LaTeX equation').fill('a^2 + b^2 = c^2')
  await expect(dialog(page).locator('.science-preview img')).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Update', exact: true }).click()
  await expect(formula).toHaveCount(1)
  await expect(formula).toHaveAttribute('data-studio-source', 'a^2 + b^2 = c^2')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(formula).toHaveAttribute('data-studio-source', 'E = mc^2')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(page.locator('.save-state')).toHaveText('All changes saved')
  await page.reload()
  await expect(formula).toHaveAttribute('data-studio-source', 'a^2 + b^2 = c^2')
  await expect(formula).toHaveAttribute('alt', 'Mass-energy equivalence')
  await formula.dblclick()
  await expect(page.getByLabel('LaTeX equation')).toHaveValue('a^2 + b^2 = c^2')
  expect(errors).toEqual([])
})

test('chemistry handles reactions and triple bonds; invalid TeX cannot be inserted', async ({
  page,
}) => {
  await open(page)
  await page.getByLabel('LaTeX equation').fill('\\unknowncommand{broken}')
  await expect(dialog(page).getByRole('alert')).toContainText('Could not create')
  await expect(dialog(page).getByRole('button', { name: 'Insert', exact: true })).toBeDisabled()
  await dialog(page).getByRole('button', { name: 'Chemical formula', exact: true }).click()
  await page.getByLabel('Chemical expression').fill('HC#CH + 2H2 -> CH3-CH3')
  await insert(page)
  const formula = body(page).locator('img[data-studio-science="chemistry"]')
  await expect(formula).toHaveAttribute('data-studio-source', 'HC#CH + 2H2 -> CH3-CH3')
  await formula.dblclick()
  await expect(page.getByLabel('Chemical expression')).toHaveValue('HC#CH + 2H2 -> CH3-CH3')
})

test('molecule sketcher draws atoms and bonds, changes bond order, deletes and undoes', async ({
  page,
}) => {
  await open(page)
  await dialog(page).getByRole('button', { name: 'Molecule drawing', exact: true }).click()
  await dialog(page).getByRole('button', { name: 'Clear', exact: true }).click()
  const canvas = dialog(page).locator('.molecule-canvas')
  await canvas.click({ position: { x: 130, y: 140 } })
  await canvas.click({ position: { x: 240, y: 140 } })
  await dialog(page).getByRole('button', { name: 'Draw bond', exact: true }).click()
  await page.getByLabel('Bond order').selectOption('2')
  await canvas.getByRole('button', { name: 'Atom 1: C', exact: true }).click()
  await canvas.getByRole('button', { name: 'Atom 2: C', exact: true }).click()
  await expect(canvas.locator('g').filter({ has: page.locator('line') })).toHaveCount(1)
  await canvas.getByRole('button', { name: 'Atom 2: C', exact: true }).click()
  await page.getByLabel('Atom element', { exact: true }).selectOption('O')
  await dialog(page).getByRole('button', { name: 'Delete atom', exact: true }).click()
  await expect(canvas.getByRole('button', { name: 'Atom 2: O', exact: true })).toHaveCount(0)
  await dialog(page).getByRole('button', { name: 'Undo drawing', exact: true }).click()
  await expect(canvas.getByRole('button', { name: 'Atom 2: O', exact: true })).toBeVisible()
  await insert(page)
  const molecule = body(page).locator('img[data-studio-science="molecule"]')
  const graph = JSON.parse(await molecule.getAttribute('data-studio-source'))
  expect(graph.atoms.map((a) => a.element)).toEqual(['C', 'O'])
  expect(graph.bonds).toEqual([{ a: 0, b: 1, order: 2 }])
  await molecule.dblclick()
  await expect(canvas.getByRole('button', { name: 'Atom 2: O', exact: true })).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Benzene', exact: true }).click()
  await expect(canvas.getByRole('button', { name: /^Atom \d:/ })).toHaveCount(6)
})

test('Turkish science dialog fits on mobile and cancel leaves the document untouched', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?lang=tr')
  await expect(body(page)).toContainText('İyi fikirler')
  const before = await body(page).innerHTML()
  await page.getByRole('button', { name: 'Matematik ve kimya', exact: true }).click()
  const panel = page.getByRole('dialog')
  await expect(page.getByLabel('LaTeX denklemi')).toBeVisible()
  await panel.getByRole('button', { name: 'Molekül çizimi', exact: true }).click()
  await expect(panel.locator('.science-preview img')).toBeVisible()
  expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await panel.getByRole('button', { name: 'İptal', exact: true }).click()
  expect(await body(page).innerHTML()).toBe(before)
})

test('HTML, print preview and DOCX retain science graphics', async ({ page }) => {
  await open(page)
  await page.getByLabel('LaTeX equation').fill('E = mc^2')
  await page.getByLabel('Accessible description').fill('Energy equation')
  await insert(page)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const html = await readFile(await (await download).path(), 'utf8')
  expect(html).toContain('data-studio-science="math"')
  expect(html).toContain('data-studio-source="E = mc^2"')
  expect(html).toContain('data:image/png;base64,')
  await page.locator('.native-menubar').getByRole('button', { name: 'File', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Page layout and export', exact: true }).click()
  const preview = page
    .frameLocator('iframe[title="Print preview"]')
    .locator('img[data-studio-science="math"]')
  await expect(preview).toBeVisible()
  expect(await preview.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
  const docxDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download DOCX', exact: true }).click()
  const zip = unzipSync(new Uint8Array(await readFile(await (await docxDownload).path())))
  expect(zip['word/media/image1.png']).toBeTruthy()
  expect(strFromU8(zip['word/document.xml'])).toContain('Energy equation')
})

test('an intervening document edit prevents a stale science insertion', async ({ page }) => {
  await open(page)
  await expect(dialog(page).locator('.science-preview img')).toBeVisible()
  await body(page).evaluate((root) => {
    root.innerHTML = '<p>A newer document revision</p>'
    root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  })
  await dialog(page).getByRole('button', { name: 'Insert', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toContainText('The document changed')
  await expect(body(page)).toHaveText('A newer document revision')
  await expect(body(page).locator('img')).toHaveCount(0)
})
