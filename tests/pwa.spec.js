import { test, expect } from '@playwright/test'

const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')

test('the workspace installs for offline use and reloads without a network', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Offline service worker emulation is verified in Chromium')
  // Automated browsers skip the worker unless ?pwa is present.
  await page.goto('/?pwa')
  await expect(body(page)).toContainText('İyi fikirler')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // Large optional chunks are cached in the background after activation.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const keys = await (await caches.open('studio-runtime')).keys()
          return keys.some((request) => /SourceEditor-/.test(request.url))
        }),
      { timeout: 45000 },
    )
    .toBe(true)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await body(page).locator('h1').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' çevrimdışı')
  await expect(
    page.getByRole('status').filter({ hasText: 'Tüm değişiklikler kaydedildi' }),
  ).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByRole('status').filter({ hasText: 'Çevrimdışı' })).toBeVisible()
  await page.reload()
  await expect(body(page).locator('h1')).toContainText('çevrimdışı')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'HTML kaynak kodu' })).toBeVisible()
  await context.setOffline(false)
})

test('manifest and icons describe an installable application', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(new URL(href, page.url()).href)).json()
  expect(manifest).toMatchObject({ display: 'standalone', start_url: './', scope: './' })
  const sizes = manifest.icons.map((icon) => icon.sizes)
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  for (const icon of manifest.icons) {
    const response = await request.get(new URL(icon.src, new URL(href, page.url())).href)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain(icon.type)
  }
  const worker = await request.get(new URL('sw.js', page.url()).href)
  expect(worker.ok()).toBe(true)
  expect(await worker.text()).not.toContain('__STUDIO_SW_')
})
