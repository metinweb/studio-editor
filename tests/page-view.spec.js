import { test, expect } from '@playwright/test'

const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const frame = (page) => page.frameLocator('.studio-editor-frame')
async function load(page, html) {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function togglePageView(page) {
  await page
    .locator('.native-menubar')
    .getByRole('button', { name: 'Görünüm', exact: true })
    .click()
  await page.getByRole('menuitem', { name: 'Sayfa görünümü' }).click()
}

test('page view shows sheets with page boundaries without changing the document', async ({
  page,
}) => {
  const paragraphs = Array.from(
    { length: 60 },
    (_, index) => `<p>Paragraf ${index + 1}: ${'uzun metin '.repeat(12)}</p>`,
  ).join('')
  await load(page, `${paragraphs}<hr data-studio-page-break="true"><p>Son sayfa</p>`)
  const before = await body(page).evaluate((root) => root.innerHTML)
  await togglePageView(page)
  await expect(frame(page).locator('style[data-studio-page-view]')).toHaveCount(1)
  const width = await body(page).evaluate((root) => root.getBoundingClientRect().width)
  expect(Math.round(width)).toBe(794)
  const status = page.locator('.page-count')
  await expect(status).toHaveText(/^Sayfa \d+ \/ \d+$/)
  const total = Number((await status.textContent()).split('/')[1])
  expect(total).toBeGreaterThanOrEqual(3)
  const labels = frame(page).locator('html > div[aria-hidden="true"] span')
  await expect(labels).toHaveCount(total - 1)
  await expect(labels.first()).toHaveText('Sayfa 2')
  // The explicit page break starts the last page.
  const breakTop = await body(page).evaluate(
    (root) => root.querySelector('hr[data-studio-page-break]').getBoundingClientRect().bottom,
  )
  const lastLine = await labels
    .last()
    .evaluate((label) => label.parentElement.getBoundingClientRect().top)
  expect(Math.abs(lastLine - breakTop)).toBeLessThan(2)
  // The caret page is reported.
  await body(page).locator('p').last().click()
  await page.keyboard.press('Control+End')
  await expect(status).toHaveText(`Sayfa ${total} / ${total}`)
  await page.keyboard.press('Control+Home')
  await expect(status).toHaveText(`Sayfa 1 / ${total}`)
  expect(await body(page).evaluate((root) => root.innerHTML)).toBe(before)

  // Print settings drive the page size.
  await page.getByRole('button', { name: 'Yazdır / PDF' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Sayfa düzeni ve dışa aktarım' })
  await dialog.getByRole('checkbox', { name: 'Yatay sayfa' }).check()
  await dialog.getByRole('button', { name: 'Kapat' }).click()
  await expect
    .poll(() => body(page).evaluate((root) => Math.round(root.getBoundingClientRect().width)))
    .toBe(1123)

  await togglePageView(page)
  await expect(frame(page).locator('style[data-studio-page-view]')).toHaveCount(0)
  await expect(frame(page).locator('html > div[aria-hidden="true"] span')).toHaveCount(0)
  await expect(status).toHaveCount(0)
})
