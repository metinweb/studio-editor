import { test, expect } from '@playwright/test'
test.use({ storageState: { cookies: [], origins: [] } })
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function start(page) {
  await page.goto('/')
  await expect(body(page)).toBeVisible()
  await page.getByRole('button', { name: 'Math & chemistry', exact: true }).click()
  await page.getByRole('button', { name: 'Molecule drawing', exact: true }).click()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.getByRole('button', { name: 'Draw bond', exact: true }).click()
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

async function dragTray(page, canvas, name, x, y) {
  const button = page.getByRole('button', { name, exact: true })
  await button.scrollIntoViewIfNeeded()
  const box = await button.boundingBox(),
    target = await position(canvas, x, y)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 12 })
  await page.mouse.up()
}

test('palette and ring drag-and-drop, default atom movement and whole molecule movement', async ({
  page,
}) => {
  const canvas = await start(page)
  await dragTray(page, canvas, 'Benzene ring', 300, 180)
  await expect(canvas.locator('.molecule-atom')).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // A bond moves its entire connected component, retaining all relative coordinates.
  await drag(page, canvas, [323.383, 139.5], [353.383, 159.5])
  await expect(canvas.locator('.molecule-atom').first().locator('circle').first()).toHaveAttribute(
    'cx',
    /329|330/,
  )
  await dragTray(page, canvas, 'Element O', 140, 240)
  await expect(canvas.locator('.molecule-atom')).toHaveCount(7)
  await drag(page, canvas, [140, 240], [180, 260])
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('180')
  const graph = await save(page)
  expect(graph.atoms[6].element).toBe('O')
  expect(graph.atoms[6].x).toBeCloseTo(180, 0)
  for (let i = 0; i < 6; i++)
    expect(
      Math.hypot(
        graph.atoms[i].x - graph.atoms[(i + 1) % 6].x,
        graph.atoms[i].y - graph.atoms[(i + 1) % 6].y,
      ),
    ).toBeCloseTo(54)
})

test('drag cancellation and outside drops leave the graph unchanged; branch handle extends a moved atom', async ({
  page,
}) => {
  const canvas = await start(page)
  await dragTray(page, canvas, 'Element N', 250, 180)
  const button = page.getByRole('button', { name: 'Six-membered ring', exact: true })
  let box = await button.boundingBox(),
    target = await position(canvas, 400, 180)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 8 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(1)
  box = await button.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(10, 10, { steps: 8 })
  await page.mouse.up()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(1)
  await drag(page, canvas, [250, 180], [280, 200])
  const handle = canvas.getByRole('button', { name: 'Draw bond from selected atom' })
  box = await handle.boundingBox()
  target = await position(canvas, 334, 200)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 8 })
  await page.mouse.up()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(2)
  await expect(canvas.locator('.molecule-bond')).toHaveCount(1)
  await page.getByRole('button', { name: 'Undo drawing', exact: true }).click()
  await expect(canvas.locator('.molecule-atom')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Element O', exact: true })).toBeVisible()
  await page.mouse.click(10, 10)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('real touch pointer drags an atom from palette then moves it on the canvas', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP touch input is Chromium-specific')
  await page.setViewportSize({ width: 390, height: 844 })
  const canvas = await start(page)
  const session = await page.context().newCDPSession(page)
  async function touchDrag(from, to) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: from.x, y: from.y }],
    })
    for (let i = 1; i <= 10; i++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 },
        ],
      })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const box = await page.getByRole('button', { name: 'Element O', exact: true }).boundingBox()
  await touchDrag(
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    await position(canvas, 220, 180),
  )
  await expect(canvas.locator('.molecule-atom')).toHaveCount(1)
  await touchDrag(await position(canvas, 220, 180), await position(canvas, 300, 220))
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('300')
  await expect(page.getByLabel('Y', { exact: true })).toHaveValue('220')
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  )
})

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
