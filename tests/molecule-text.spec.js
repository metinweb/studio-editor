import { test, expect } from '@playwright/test'
test.use({ storageState: { cookies: [], origins: [] } })
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function open(page) {
  await page.goto('/')
  await expect(body(page)).toBeVisible()
  await page.getByRole('button', { name: 'Math & chemistry', exact: true }).click()
  await page.getByRole('button', { name: 'Molecule drawing', exact: true }).click()
  return page.locator('.molecule-canvas')
}
async function positions(canvas) {
  return canvas
    .locator('.molecule-atom-hit')
    .evaluateAll((nodes) =>
      nodes.map((n) => ({ x: Number(n.getAttribute('cx')), y: Number(n.getAttribute('cy')) })),
    )
}
async function point(canvas, p) {
  return canvas.evaluate((el, p) => {
    const v = new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM())
    return { x: v.x, y: v.y }
  }, p)
}
async function drag(page, canvas, from, to) {
  const a = await point(canvas, from),
    b = await point(canvas, to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
}
function rigid(before, after) {
  for (let i = 0; i < before.length; i++)
    for (let j = i + 1; j < before.length; j++)
      expect(Math.hypot(after[i].x - after[j].x, after[i].y - after[j].y)).toBeCloseTo(
        Math.hypot(before[i].x - before[j].x, before[i].y - before[j].y),
        6,
      )
}

test('ring corners stay rigid through dragging, keyboard, numeric edits and reopened saved diagrams', async ({
  page,
}) => {
  const canvas = await open(page),
    before = await positions(canvas)
  await drag(page, canvas, before[0], { x: before[0].x + 30, y: before[0].y + 20 })
  rigid(before, await positions(canvas))
  await expect(page.getByText('Ring shape is protected.', { exact: false })).toBeVisible()
  await canvas.press('Shift+ArrowRight')
  rigid(before, await positions(canvas))
  await page.getByLabel('X', { exact: true }).fill('580')
  await page.getByLabel('X', { exact: true }).press('Tab')
  rigid(before, await positions(canvas))
  await page.getByRole('dialog').getByRole('button', { name: 'Insert', exact: true }).click()
  const image = body(page).locator('img[data-studio-science="molecule"]')
  await image.dblclick()
  const reopened = await positions(canvas)
  await drag(page, canvas, reopened[2], { x: reopened[2].x - 60, y: reopened[2].y - 40 })
  rigid(reopened, await positions(canvas))
})

test('formula choices create different structures; text generation is lazy and undoable', async ({
  page,
}) => {
  const requests = []
  page.on('request', (r) => requests.push(r.url()))
  const canvas = await open(page)
  expect(requests.some((url) => url.includes('molecule-text-'))).toBe(false)
  await page.getByRole('button', { name: 'From text', exact: true }).click()
  await page.getByLabel('Formula, molecule name or SMILES').fill('C₂H₆O')
  await page.getByRole('button', { name: 'Draw structure', exact: true }).click()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(6)
  await page.getByRole('button', { name: 'Dimethyl ether COC', exact: true }).click()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(3)
  expect(requests.some((url) => url.includes('molecule-text-'))).toBe(true)
  await page.getByRole('button', { name: 'Undo drawing', exact: true }).click()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(6)
  await page.getByLabel('Formula, molecule name or SMILES').fill('CH₃CH₂OH')
  await page.getByRole('button', { name: 'Draw structure', exact: true }).click()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(4)
  await page.getByRole('dialog').getByRole('button', { name: 'Insert', exact: true }).click()
  const graph = JSON.parse(
    await body(page)
      .locator('img[data-studio-science="molecule"]')
      .getAttribute('data-studio-source'),
  )
  expect(graph.atoms.map((a) => a.element).sort()).toEqual(['C', 'C', 'H', 'O'])
})

test('SMILES and tidy tools preserve rings, invalid input cannot overwrite a drawing', async ({
  page,
}) => {
  const canvas = await open(page)
  await page.getByRole('button', { name: 'From text', exact: true }).click()
  await page.getByLabel('Text format').selectOption('smiles')
  const source = page.getByLabel('Formula, molecule name or SMILES')
  await source.fill('CC(=O)O')
  await page.getByRole('button', { name: 'Draw structure', exact: true }).click()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(5)
  for (const bad of ['C1CC', '[NH4+]']) {
    await source.fill(bad)
    await page.getByRole('button', { name: 'Draw structure', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(canvas.locator('.molecule-atom')).toHaveCount(5)
  }
  await source.fill('c1ccccc1')
  await page.getByRole('button', { name: 'Draw structure', exact: true }).click()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(6)
  await page.getByRole('button', { name: 'From text', exact: true }).click()
  await page.getByRole('button', { name: 'Tidy structure', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tidy structure', exact: true })).toBeEnabled()
  const coords = await positions(canvas)
  for (let i = 0; i < 6; i++)
    expect(
      Math.hypot(coords[i].x - coords[(i + 1) % 6].x, coords[i].y - coords[(i + 1) % 6].y),
    ).toBeCloseTo(54, 5)
})
