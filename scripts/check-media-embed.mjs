// Run after npm run build:library. Exercises the built Vue bundle and model bridge.
import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from '@playwright/test'
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
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/https:\/\/www\.youtube-nocookie\.com\//, (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<body style="background:#111b2d;color:white;font:24px system-ui;display:grid;place-items:center">YouTube · Test player</body>',
    }),
  )
  await page.goto('http://127.0.0.1:4186')
  const first = page.locator('.studio-editor-embed').first()
  const body = page.frameLocator('.studio-editor-frame').first().locator('body')
  await body.locator('p').click()
  await first.getByRole('button', { name: 'Bağlantıdan medya ekle', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Medya bağlantısı', exact: true })
    .fill('https://youtu.be/M7lc1UVf-VE')
  await page.getByRole('button', { name: 'Medyayı ekle', exact: true }).click()
  await page.getByRole('button', { name: 'Şemalı belgeyi oku' }).click()
  const model = JSON.parse(await page.locator('#schema-model').textContent())
  const media = model.blocks.find((b) => b.node.tag === 'figure')
  assert.ok(media)
  assert.ok(!JSON.stringify(model).includes('"iframe"'))
  assert.ok(!JSON.stringify(model).includes('"contenteditable"'))
  await page.getByRole('button', { name: 'İki editörü eşleştir' }).click()
  const second = page.frameLocator('.studio-editor-frame').nth(1).locator('body')
  await second.locator('figure iframe').waitFor()
  assert.equal(
    await second.locator('figure iframe').getAttribute('src'),
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
  )
  await page.getByLabel('Salt okunur örnek').check()
  assert.equal(await body.getAttribute('contenteditable'), 'false')
  assert.equal(
    await first.getByRole('button', { name: 'Bağlantıdan medya ekle', exact: true }).count(),
    0,
  )
  await page.getByLabel('Salt okunur örnek').uncheck()
  await body.locator('figcaption').click()
  await first.getByRole('button', { name: 'Medya genişliği 50%' }).click()
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.studio-editor-frame')[1].contentDocument.querySelector('figure')
        ?.dataset.studioEmbedWidth === '50',
  )
  await page.getByRole('button', { name: 'Şemalı belgeyi oku' }).click()
  const after = JSON.parse(await page.locator('#schema-model').textContent())
  assert.equal(after.blocks.find((b) => b.node.tag === 'figure').id, media.id)
  assert.deepEqual(errors, [])
  console.log(
    'Built Vue bundle: semantic model, shared round-trip, stable identity and readonly passed.',
  )
} finally {
  await browser?.close()
  await server.close()
}
