import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
test('DOCX contains real merged tables, numbering, images and page headers', async ({ page }) => {
  await page.goto('/')
  await expect(body(page)).toBeVisible()
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 20
    c.height = 10
    c.getContext('2d').fillRect(0, 0, 20, 10)
    return c.toDataURL()
  })
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'HTML kaynak kodu' })
    .fill(
      `<h1>Türkçe başlık</h1><p><strong>Kalın</strong> <a href="https://example.com">Bağlantı</a></p><ul><li>Bir</li><li>İki</li></ul><table><tbody><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table><p><img src="${image}" alt="Bir"><img src="${image}" alt="İki"></p>`,
    )
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await page.locator('.native-menubar').getByRole('button', { name: 'Dosya', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Sayfa düzeni ve dışa aktarım', exact: true }).click()
  await page.getByLabel('Üstbilgi', { exact: true }).fill('Studio raporu')
  await page.getByLabel('Altbilgi', { exact: true }).fill('İç kullanım')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'DOCX indir', exact: true }).click()
  const entries = unzipSync(new Uint8Array(await readFile(await (await downloaded).path())))
  const document = strFromU8(entries['word/document.xml'])
  expect(document).toContain('Türkçe başlık')
  expect(document).toContain('<w:vMerge w:val="restart"/>')
  expect(document).toContain('<w:vMerge/>')
  expect(document).toContain('<w:numPr>')
  expect(entries['word/media/image1.png']).toBeTruthy()
  expect(entries['word/media/image2.png']).toBeTruthy()
  expect(strFromU8(entries['word/header.xml'])).toContain('Studio raporu')
  expect(strFromU8(entries['word/footer.xml'])).toContain('İç kullanım')
  for (const [name, bytes] of Object.entries(entries))
    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      const valid = await page.evaluate(
        (xml) =>
          !new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror'),
        strFromU8(bytes),
      )
      expect(valid, name).toBe(true)
    }
  await expect(page.frameLocator('iframe[title="Yazdırma önizlemesi"]').locator('h1')).toHaveText(
    'Türkçe başlık',
  )
})
