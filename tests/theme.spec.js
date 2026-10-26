import { test, expect } from '@playwright/test'

const luminance = (color) => {
  const [r, g, b] = color
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map((value) => {
      const channel = Number(value) / 255
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const colors = (locator) =>
  locator.evaluate((node) => {
    const style = getComputedStyle(node)
    return { background: style.backgroundColor, color: style.color }
  })

test('workspace theme switches interface surfaces, persists and keeps the document page', async ({
  page,
}) => {
  await page.goto('/')
  const frame = page.frameLocator('.studio-editor-frame')
  await expect(frame.locator('body')).toContainText('İyi fikirler')
  const editor = page.locator('.native-editor')
  expect(luminance((await colors(editor)).background)).toBeGreaterThan(0.9)
  await page.getByRole('combobox', { name: 'Görünüm teması' }).selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-studio-theme', 'dark')
  await expect.poll(async () => luminance((await colors(editor)).background)).toBeLessThan(0.05)
  const menu = page.locator('.native-menubar button').first()
  // Interface colors may animate between themes.
  await expect.poll(async () => luminance((await colors(menu)).color)).toBeGreaterThan(0.5)
  await menu.click()
  const popover = page.locator('.editor-popover')
  await expect.poll(async () => luminance((await colors(popover)).background)).toBeLessThan(0.05)
  await page.keyboard.press('Escape')
  // The document keeps its own colors: dark text on a white sheet painted by the frame itself.
  const paper = await frame.locator('body').evaluate((body) => ({
    color: getComputedStyle(body).color,
    background: getComputedStyle(body.ownerDocument.documentElement).backgroundColor,
    scheme: getComputedStyle(body.ownerDocument.documentElement).colorScheme,
  }))
  expect(luminance(paper.color)).toBeLessThan(0.2)
  expect(paper.background).toBe('rgb(255, 255, 255)')
  expect(paper.scheme).toBe('light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-studio-theme', 'dark')
  await page.getByRole('combobox', { name: 'Görünüm teması' }).selectOption('light')
  await expect(page.locator('html')).toHaveAttribute('data-studio-theme', 'light')
  await expect.poll(async () => luminance((await colors(editor)).background)).toBeGreaterThan(0.9)
})

test('automatic theme follows the system color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.getByRole('combobox', { name: 'Görünüm teması' })).toHaveValue('auto')
  await expect(page.locator('html')).toHaveAttribute('data-studio-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-studio-theme', 'light')
})
