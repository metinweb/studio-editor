import { test, expect } from '@playwright/test'

const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
// Breaks selection handling in the current editing document only; a restarted editor gets a
// fresh iframe document, so the failure does not follow it.
const crash = (page) =>
  body(page).evaluate((root) => {
    root.ownerDocument.getSelection = () => {
      throw new Error('Simulated editor failure')
    }
    // Dispatch after evaluate returns: the restart detaches this frame.
    setTimeout(() => root.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true })))
  })

test('a failing editor listener restarts the editor with its latest content', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await body(page).locator('h1').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' korunan')
  await crash(page)
  const notice = page.getByRole('status').filter({ hasText: 'yeniden başlatıldı' })
  await expect(notice).toBeVisible()
  await expect(body(page).locator('h1')).toContainText('korunan')
  await body(page).locator('h1').click()
  await page.keyboard.press('End')
  await page.keyboard.type('!')
  await expect(body(page).locator('h1')).toContainText('korunan!')
  await notice.getByRole('button', { name: 'Bilgiyi kapat' }).click()
  await expect(notice).toHaveCount(0)
  expect(errors).toEqual([])
})

test('repeated failures stop the editor until the user restarts it', async ({ page }) => {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  for (let i = 0; i < 3; i++) {
    await crash(page)
    await expect(page.getByText('Editör bir hata nedeniyle yeniden başlatıldı')).toBeVisible()
    await expect(body(page)).toContainText('İyi fikirler')
  }
  await crash(page)
  const stopped = page.getByRole('alert').filter({ hasText: 'durduruldu' })
  await expect(stopped).toBeVisible()
  await expect(page.locator('.studio-editor-frame')).toHaveCount(0)
  await stopped.getByRole('button', { name: 'Editörü yeniden başlat' }).click()
  await expect(stopped).toHaveCount(0)
  await expect(body(page)).toContainText('İyi fikirler')
})
