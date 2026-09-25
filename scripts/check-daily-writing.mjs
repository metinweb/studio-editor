// Run after npm run build:library. Uses the real Vue integration example.
import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium, expect } from '@playwright/test'
const root = path.resolve(import.meta.dirname, '..')
const server = await createServer({
  configFile: false,
  root: path.join(root, 'examples/vue'),
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: 'studio-editor/style.css',
        replacement: path.join(root, 'packages/editor/dist/studio-editor.css'),
      },
      {
        find: /^studio-editor$/,
        replacement: path.join(root, 'packages/editor/dist/studio-editor.js'),
      },
    ],
  },
  server: { host: '127.0.0.1', port: 4186, strictPort: true, fs: { allow: [root] } },
})
let browser
try {
  await server.listen()
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = []
  page.on('pageerror', (e) => {
    errors.push(e.message)
    console.log('Page error at', phase, e.message)
  })
  let phase = 'load'
  await page.goto('http://127.0.0.1:4186')
  const first = page.locator('.studio-editor-embed').first()
  const body = page.frameLocator('.studio-editor-frame').first().locator('body')
  await body.locator('p').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' @Ada')
  await page.getByRole('option', { name: 'Ada Lovelace', exact: true }).click()
  await expect(body.locator('[data-studio-mention]')).toHaveAttribute(
    'data-studio-mention',
    'demo-ada',
  )
  await page.keyboard.type('@Unknown')
  await expect(page.getByRole('listbox')).toContainText('Eşleşen kişi bulunamadı.')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(0)
  await page.keyboard.press('Escape')
  phase = 'task'
  await first.getByRole('button', { name: 'Görev listesi', exact: true }).click()
  await body.getByRole('checkbox').click()
  phase = 'style'
  await first.getByRole('button', { name: 'İçerik stilleri', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Bilgi kutusu', exact: true }).click()
  await page.getByRole('button', { name: 'Şemalı belgeyi oku' }).click()
  const model = JSON.parse(await page.locator('#schema-model').textContent())
  assert.ok(JSON.stringify(model).includes('demo-ada'))
  assert.ok(JSON.stringify(model).includes('data-studio-task-list'))
  assert.ok(!JSON.stringify(model).includes('data-studio-task-control'))
  assert.ok(!JSON.stringify(model).includes('contenteditable'))
  phase = 'shared'
  await page.getByRole('button', { name: 'İki editörü eşleştir' }).click()
  const second = page.frameLocator('.studio-editor-frame').nth(1).locator('body')
  await expect(second.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
  await expect(second.locator('[data-studio-mention]')).toHaveText('@Ada Lovelace')
  await expect(second.locator('li')).toHaveAttribute('data-studio-style', 'info')
  await page.getByLabel('Salt okunur örnek').check()
  await body.getByRole('checkbox').click()
  await expect(body.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
  await page.getByLabel('Salt okunur örnek').uncheck()
  await body.getByRole('checkbox').click()
  await expect(second.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: 'Şemalı belgeyi oku' }).click()
  const after = JSON.parse(await page.locator('#schema-model').textContent())
  assert.equal(after.blocks[0].id, model.blocks[0].id)
  await page.getByRole('button', { name: 'API ile değiştir', exact: true }).click()
  await body.locator('p').click()
  await page.keyboard.press('End')
  await page.getByRole('button', { name: 'Örnek eklentiyi çalıştır' }).click()
  phase = 'plugin'
  await body.locator('p').filter({ hasText: 'Eklenti metni' }).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/Hello')
  await expect(page.getByRole('menuitem', { name: 'Hello' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(body).not.toContainText('/Hello')
  await expect(body.locator('p').filter({ hasText: 'Eklenti metni' })).toHaveCount(2)
  assert.deepEqual(errors, [])
  console.log(
    'Built Vue: configured mentions, no implicit creation, semantic shared round-trip, stable IDs, readonly, plugin slash passed.',
  )
} finally {
  await browser?.close()
  await server.close()
}
