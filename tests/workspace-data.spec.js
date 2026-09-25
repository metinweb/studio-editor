import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { encodeArchive } from '../src/lib/archive-format.js'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function content(page, html) {
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
test('versions persist, compare, restore and retain previous document', async ({ page }) => {
  await page.goto('/')
  await expect(body(page)).toBeVisible()
  await content(page, '<p>Birinci içerik</p>')
  await page.getByRole('button', { name: 'Sürümler', exact: true }).click()
  await page.getByRole('button', { name: 'Şimdi sürüm kaydet' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Güncel sürüm' })).toBeVisible()
  await page.getByRole('button', { name: 'Kapat', exact: true }).click()
  await content(page, '<p>İkinci içerik</p>')
  await page.getByRole('button', { name: 'Sürümler', exact: true }).click()
  await page.getByRole('button', { name: 'Şimdi sürüm kaydet' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Güncel sürüm' })).toBeVisible()
  await page.reload()
  await expect(body(page)).toContainText('İkinci içerik')
  await page.getByRole('button', { name: 'Sürümler', exact: true }).click()
  await page.locator('.version-item').nth(1).click()
  await expect(page.frameLocator('iframe[title="Sürüm önizlemesi"]').locator('body')).toContainText(
    'Birinci içerik',
  )
  await page.getByText('Metin farkını göster', { exact: true }).click()
  await expect(page.locator('.version-diff')).toContainText('Birinci')
  await page.getByRole('button', { name: 'Bu sürümü geri yükle' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Sürüm geri yüklendi' })).toBeVisible()
  await page.getByRole('button', { name: 'Kapat', exact: true }).click()
  await expect(body(page)).toContainText('Birinci içerik')
  await page.reload()
  await expect(body(page)).toContainText('Birinci içerik')
})
test('full archive imports every store, round trips and rejects corruption without writes', async ({
  page,
}) => {
  await page.goto('/')
  await expect(body(page)).toBeVisible()
  const data = {
    documents: [
      {
        id: 'd',
        title: 'Yedek belgesi',
        content: '<p data-studio-thread="test">Yorumlu</p>',
        updatedAt: 1,
        favorite: true,
        tags: ['İş', 'Toplantı'],
      },
    ],
    media: [
      {
        id: 'm',
        name: 'sample.png',
        type: 'image/png',
        size: 3,
        dataUrl: 'data:image/png;base64,YWJj',
        alt: 'a',
        createdAt: 1,
      },
    ],
    templates: [{ id: 't', name: 'Yedek şablonu', html: '<p>Şablon</p>', createdAt: 1 }],
    versions: [
      {
        id: 'v',
        documentId: 'd',
        title: 'Yedek belgesi',
        content: '<p>Eski</p>',
        createdAt: 1,
        reason: 'Elle',
      },
    ],
  }
  await page.getByRole('button', { name: 'Yedekle / geri yükle' }).click()
  const input = page.getByLabel('Yedek dosyası seç')
  await input.setInputFiles({
    name: 'backup.studio.json',
    mimeType: 'application/json',
    buffer: Buffer.from(await encodeArchive(data)),
  })
  await expect(page.locator('.backup-summary')).toContainText(
    '1 belge · 1 medya · 1 şablon · 1 sürüm',
  )
  await page.getByRole('button', { name: 'Yedeği geri yükle' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'yeni kopyalar' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Tam yedeği indir' }).click()
  const exported = JSON.parse(
    JSON.parse(await readFile(await (await download).path(), 'utf8')).payload,
  )
  expect(exported.documents).toHaveLength(2)
  expect(exported.templates[0].name).toBe('Yedek şablonu')
  expect(exported.media[0].dataUrl).toBe(data.media[0].dataUrl)
  const doc = exported.documents.find((d) => d.title === 'Yedek belgesi')
  expect(doc.content).toContain('data-studio-thread="test"')
  expect(doc.favorite).toBe(true)
  expect(doc.tags).toEqual(['İş', 'Toplantı'])
  expect(exported.versions.find((v) => v.documentId === doc.id).content).toBe('<p>Eski</p>')
  await input.setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from((await encodeArchive(data)).replace('Yorumlu', 'Bozuk')),
  })
  await expect(page.getByRole('alert')).toContainText('geçersiz')
  await expect(page.getByRole('button', { name: 'Yedeği geri yükle' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Kapat', exact: true }).click()
  await expect(page.locator('.document-row')).toHaveCount(2)
})
test('legacy template database is migrated once without losing records', async ({ page }) => {
  await page.route('http://127.0.0.1:4173/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Migration fixture</p>' }),
  )
  await page.goto('/')
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('studio-content-tools', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('templates', { keyPath: 'id' })
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const tx = db.transaction('templates', 'readwrite')
    tx.objectStore('templates').put({
      id: 'legacy',
      name: 'Önceki şablon',
      html: '<p>Korundu</p>',
      createdAt: 1,
    })
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = reject
    })
    db.close()
  })
  await page.unroute('http://127.0.0.1:4173/')
  await page.reload()
  await expect(body(page)).toBeVisible()
  const check = () =>
    page.evaluate(async () => {
      const db = await new Promise((resolve) => {
        const r = indexedDB.open('tinymce-studio')
        r.onsuccess = () => resolve(r.result)
      })
      const values = await new Promise((resolve) => {
        const r = db.transaction('templates').objectStore('templates').getAll()
        r.onsuccess = () => resolve(r.result)
      })
      db.close()
      return values
    })
  expect(await check()).toHaveLength(1)
  await page.reload()
  await expect(body(page)).toBeVisible()
  expect(await check()).toHaveLength(1)
})
