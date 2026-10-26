import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Automated WCAG 2.1 A/AA checks of the interface in its main states. Automated rules catch
// a subset of problems; keyboard and screen reader sessions are still needed.
// Each axe run also scans the editing iframes, so these tests get more time.
test.describe.configure({ timeout: 120000 })
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function audit(page, include) {
  // Script-less sandboxed previews show the user's document and cannot run axe.
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('iframe[sandbox=""]')
  if (include) builder = builder.include(include)
  const { violations } = await builder.analyze()
  const serious = violations
    .filter((item) => ['serious', 'critical'].includes(item.impact))
    .map((item) => ({
      id: item.id,
      impact: item.impact,
      targets: item.nodes.slice(0, 5).map((node) => node.target.join(' ')),
      summary: item.nodes[0]?.failureSummary?.split('\n').slice(0, 3).join(' '),
    }))
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}

test('workspace, menus and review panel have no serious automated violations', async ({ page }) => {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await audit(page)
  await page.locator('.native-menubar').getByRole('button', { name: 'Ekle', exact: true }).click()
  await audit(page, '.editor-popover')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Yorumlar', exact: true }).click()
  await audit(page, '.review-panel')
  await page.getByRole('button', { name: 'Değişiklikler', exact: false }).first().click()
  await audit(page, '.review-panel')
})

test('dark theme and key dialogs have no serious automated violations', async ({ page }) => {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await page.getByRole('combobox', { name: 'Görünüm teması' }).selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-studio-theme', 'dark')
  // Theme colors animate briefly; audit the settled state.
  await page.waitForTimeout(400)
  await audit(page)
  await body(page).locator('h1').click()
  for (const [menu, item, name] of [
    ['Ekle', 'Bağlantı ekle', 'Bağlantı'],
    ['Ekle', 'Diyagram (Mermaid)', 'Diyagram (Mermaid)'],
    ['Düzenle', 'Düzenlenebilir alan yap', 'Düzenlenebilir alan yap'],
    ['Dosya', 'Sayfa düzeni ve dışa aktarım', 'Sayfa düzeni ve dışa aktarım'],
  ]) {
    await page.locator('.native-menubar').getByRole('button', { name: menu, exact: true }).click()
    await page.getByRole('menuitem', { name: item }).click()
    const dialog = page.getByRole('dialog', { name })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(300)
    await audit(page, 'dialog[open]')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  }
})
