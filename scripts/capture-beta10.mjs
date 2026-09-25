import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const directory = new URL('../docs/screenshots/beta10/', import.meta.url)
await mkdir(directory, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1360, height: 960 } })
const shot = async (name) =>
  page.screenshot({
    path: new URL(name + '.png', directory).pathname.replace(/^\/(?=[A-Za-z]:)/, ''),
  })
try {
  await page.goto('http://127.0.0.1:4173')
  await page.frameLocator('.studio-editor-frame').locator('body').waitFor()
  await page.getByRole('button', { name: 'Sürümler', exact: true }).click()
  await page.frameLocator('iframe[title="Sürüm önizlemesi"]').locator('h1').waitFor()
  await shot('versions-desktop')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Yedekle / geri yükle', exact: true }).click()
  await page.getByRole('dialog', { name: 'Çalışma alanı yedeği' }).waitFor()
  await shot('backup-desktop')
  await page.keyboard.press('Escape')
  await page.locator('.native-menubar').getByRole('button', { name: 'Dosya', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Sayfa düzeni ve dışa aktarım', exact: true }).click()
  await page.frameLocator('iframe[title="Yazdırma önizlemesi"]').locator('h1').waitFor()
  await shot('print-desktop')
  const printHtml = await page.locator('iframe[title="Yazdırma önizlemesi"]').getAttribute('srcdoc')
  const printPage = await browser.newPage()
  await printPage.setContent(printHtml)
  await printPage.pdf({
    path: new URL('print-sample.pdf', directory).pathname.replace(/^\/(?=[A-Za-z]:)/, ''),
    preferCSSPageSize: true,
    printBackground: true,
  })
  await printPage.close()
  await page.setViewportSize({ width: 390, height: 844 })
  await shot('print-mobile')
  console.log(
    'Mobile document overflow:',
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  )
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1360, height: 960 })
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'HTML kaynak kodu' })
    .fill(
      '<h1>Yazıya odaklanın.</h1><p>Blokları taşıyın, değişiklikleri inceleyin ve belgenizi güvenle paylaşın.</p><p><br></p>',
    )
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  const body = page.frameLocator('.studio-editor-frame').locator('body')
  await body.locator('p').last().click()
  await body.press('End')
  await page.keyboard.type('/')
  await page.getByRole('menu', { name: 'Blok ekle' }).waitFor()
  await shot('writing-desktop')
} finally {
  await browser.close()
}
