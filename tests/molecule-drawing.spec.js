import { test, expect } from '@playwright/test'
test.use({ storageState: { cookies: [], origins: [] } })
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function start(page) {
  await page.goto('/')
  await expect(body(page)).toBeVisible()
  await page.getByRole('button', { name: 'Math & chemistry', exact: true }).click()
  await page.getByRole('button', { name: 'Molecule drawing', exact: true }).click()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  return page.locator('.molecule-canvas')
}
async function position(canvas, x, y) {
  return canvas.evaluate(
    (el, p) => {
      const v = new DOMPoint(...p).matrixTransform(el.getScreenCTM())
      return { x: v.x, y: v.y }
    },
    [x, y],
  )
}
async function drag(page, canvas, from, to) {
  const a = await position(canvas, ...from),
    b = await position(canvas, ...to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
}
async function save(page) {
  await expect(page.locator('.science-preview img')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Insert', exact: true }).click()
  return JSON.parse(
    await body(page)
      .locator('img[data-studio-science="molecule"]')
      .getAttribute('data-studio-source'),
  )
}

test('dragging creates snapped chains, connects existing atoms and commits one undo per gesture', async ({
  page,
}) => {
  const canvas = await start(page)
  await drag(page, canvas, [150, 180], [210, 180])
  await expect(canvas.locator('.molecule-atom')).toHaveCount(2)
  await expect(canvas.locator('.molecule-bond')).toHaveCount(1)
  await drag(page, canvas, [204, 180], [250, 150])
  await expect(canvas.locator('.molecule-atom')).toHaveCount(3)
  await page.getByRole('button', { name: 'Undo drawing', exact: true }).click()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(2)
  await page.getByRole('button', { name: 'Redo drawing', exact: true }).click()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(3)
  // Close the triangle onto an existing atom without creating a duplicate.
  await drag(page, canvas, [250.765, 153], [150, 180])
  await expect(canvas.locator('.molecule-atom')).toHaveCount(3)
  await expect(canvas.locator('.molecule-bond')).toHaveCount(3)
  const graph = await save(page)
  expect(graph.skeletal).toBe(true)
  expect(
    Math.hypot(graph.atoms[1].x - graph.atoms[0].x, graph.atoms[1].y - graph.atoms[0].y),
  ).toBeCloseTo(54)
  expect(graph.atoms[2].y - graph.atoms[1].y).toBeCloseTo(-27)
})

test('ring placement, skeletal labels and atom colors survive editing and export metadata', async ({
  page,
}) => {
  const canvas = await start(page)
  await page.getByRole('button', { name: 'Benzene ring', exact: true }).click()
  const p = await position(canvas, 300, 180)
  await page.mouse.click(p.x, p.y)
  await expect(canvas.locator('.molecule-atom')).toHaveCount(6)
  await expect(canvas.locator('.molecule-atom text')).toHaveCount(0)
  await page.getByLabel('Skeletal carbons').uncheck()
  await expect(canvas.locator('.molecule-atom text')).toHaveCount(6)
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await canvas.getByRole('button', { name: 'Atom 1: C', exact: true }).click()
  await page.getByRole('button', { name: 'Element N', exact: true }).click()
  await expect(canvas.locator('.molecule-atom text').first()).toHaveAttribute('fill', '#316ad5')
  const graph = await save(page)
  expect(graph.skeletal).toBe(false)
  expect(graph.atoms[0].element).toBe('N')
  expect(graph.bonds.filter((b) => b.order === 2)).toHaveLength(3)
  await body(page).locator('img[data-studio-science="molecule"]').dblclick()
  await expect(page.getByLabel('Skeletal carbons')).not.toBeChecked()
  await expect(canvas.getByRole('button', { name: 'Atom 1: N', exact: true })).toBeVisible()
})

test('move gesture can be cancelled and keyboard coordinates are undoable', async ({ page }) => {
  const canvas = await start(page)
  await drag(page, canvas, [150, 180], [210, 180])
  const originalX = await canvas
    .locator('.molecule-atom')
    .first()
    .locator('circle')
    .first()
    .getAttribute('cx')
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  const from = await position(canvas, 150, 180),
    to = await position(canvas, 200, 230)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await canvas.focus()
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('150')
  await canvas.press('ArrowRight')
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('152')
  await canvas.press('Control+z')
  await expect(canvas.locator('.molecule-atom').first().locator('circle').first()).toHaveAttribute(
    'cx',
    originalX,
  )
})

test.describe('touch drawing', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })
  test('atoms connect by touch on a narrow canvas without scrolling horizontally', async ({
    page,
  }) => {
    const canvas = await start(page)
    for (const [x, y] of [
      [180, 180],
      [360, 180],
    ]) {
      const p = await position(canvas, x, y)
      await page.touchscreen.tap(p.x, p.y)
    }
    await page.getByRole('button', { name: 'Double bond', exact: true }).tap()
    await canvas.getByRole('button', { name: 'Atom 1: C', exact: true }).tap()
    await canvas.getByRole('button', { name: 'Atom 2: C', exact: true }).tap()
    await expect(canvas.locator('.molecule-bond-ink')).toHaveCount(2)
    expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    )
    const graph = await save(page)
    expect(graph.bonds).toEqual([{ a: 0, b: 1, order: 2 }])
  })
})
