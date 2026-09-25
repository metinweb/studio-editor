import { test, expect } from '@playwright/test'

const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const rows = (page) => page.locator('.document-select')
async function start(page) {
  await page.goto('/')
  await expect(body(page)).toBeVisible()
}
async function addTag(page, tag) {
  await page.getByRole('textbox', { name: 'Yeni etiket' }).fill(tag)
  await page.getByRole('dialog').getByRole('button', { name: 'Ekle', exact: true }).click()
}
async function saved(page) {
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
}

test('favorites and tags persist; duplicate tags, removal and empty favorites work', async ({
  page,
}) => {
  await start(page)
  await page.getByLabel('Belge başlığı', { exact: true }).fill('Çalışma notları')
  await page.getByRole('button', { name: 'Favorilere ekle', exact: true }).click()
  await page.getByRole('button', { name: 'Belge etiketlerini düzenle' }).click()
  await addTag(page, 'İŞ')
  await addTag(page, 'iş')
  await expect(page.getByRole('status').filter({ hasText: 'Bu etiket zaten ekli.' })).toBeVisible()
  await expect(page.locator('.document-tag')).toHaveCount(1)
  await addTag(page, 'Toplantı')
  await page.getByRole('button', { name: 'Tamam', exact: true }).click()
  await saved(page)
  await page.reload()
  await expect(body(page)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Favorilerden çıkar', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /^Favoriler\s/ }).click()
  await expect(rows(page)).toHaveCount(1)
  await page.getByLabel('Etikete göre filtrele').selectOption('iş')
  await expect(rows(page)).toHaveCount(1)
  await page.getByRole('button', { name: 'Belge etiketlerini düzenle' }).click()
  await expect(page.locator('.document-tag')).toHaveText(['İŞ', 'Toplantı'])
  await page.getByRole('button', { name: 'İŞ etiketini kaldır' }).click()
  await page.getByRole('button', { name: 'Tamam', exact: true }).click()
  await expect(page.getByLabel('Etikete göre filtrele')).toHaveValue('')
  await page.getByRole('button', { name: 'Favorilerden çıkar', exact: true }).click()
  await expect(rows(page)).toHaveCount(0)
  await expect(page.getByText('Belge bulunamadı.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Temizle', exact: true }).click()
  await expect(rows(page)).toHaveCount(1)
  await saved(page)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Favorilere ekle', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Belge etiketlerini düzenle' }).click()
  await expect(page.locator('.document-tag')).toHaveText(['Toplantı'])
})

test('search combines visible content, title and tag; sorting and creation clear filters', async ({
  page,
}) => {
  await start(page)
  await page.getByLabel('Belge başlığı', { exact: true }).fill('İzmir 10')
  await body(page).fill('IŞIK ve İÇERİK araştırması')
  await page.getByRole('button', { name: 'Belge etiketlerini düzenle' }).click()
  await addTag(page, 'Proje')
  await page.getByRole('button', { name: 'Tamam', exact: true }).click()
  await page.getByRole('button', { name: 'Yeni belge +', exact: true }).click()
  await expect(page.getByLabel('Belge başlığı', { exact: true })).toHaveValue('Başlıksız belge')
  await page.getByLabel('Belge başlığı', { exact: true }).fill('İzmir 2')
  await body(page).fill('Diğer belge')
  await page.getByLabel('Belge ara', { exact: true }).fill('izmir ışık içerik proje')
  await expect(rows(page)).toHaveText(['İzmir 10'])
  await rows(page).first().click()
  await expect(page.getByLabel('Belge başlığı', { exact: true })).toHaveValue('İzmir 10')
  await expect(body(page)).toContainText('IŞIK ve İÇERİK araştırması')
  await body(page).fill('Değişen metin')
  await expect(rows(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Temizle', exact: true }).click()
  await page.getByLabel('Belgeleri sırala').selectOption('title')
  await expect(rows(page)).toHaveText(['İzmir 2', 'İzmir 10'])
  await page.getByLabel('Belgeleri sırala').selectOption('title-desc')
  await expect(rows(page)).toHaveText(['İzmir 10', 'İzmir 2'])
  await page.getByLabel('Etikete göre filtrele').selectOption('proje')
  await expect(rows(page)).toHaveText(['İzmir 10'])
  await page.getByLabel('Belge ara', { exact: true }).fill('bulunamayan')
  await page.getByRole('button', { name: 'Yeni belge +', exact: true }).click()
  await expect(page.getByLabel('Belge başlığı', { exact: true })).toHaveValue('Başlıksız belge')
  await expect(page.getByLabel('Belge ara', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Etikete göre filtrele')).toHaveValue('')
  await expect(rows(page)).toHaveCount(3)
})

test('mobile users can organize and filter documents without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 667 })
  await start(page)
  await page.getByRole('button', { name: 'Favorilere ekle', exact: true }).click()
  await page.getByRole('button', { name: 'Belge etiketlerini düzenle' }).click()
  await addTag(page, 'Uzun bir proje etiketi denemesi')
  await expect(page.locator('dialog')).toBeVisible()
  expect(await page.locator('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.getByRole('button', { name: 'Tamam', exact: true }).click()
  await page.getByRole('button', { name: 'Menüyü aç', exact: true }).click()
  await page.getByRole('button', { name: /^Favoriler\s/ }).click()
  await page
    .getByLabel('Etikete göre filtrele')
    .selectOption({ label: 'Uzun bir proje etiketi denemesi' })
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toBeInViewport()
  await page.getByRole('button', { name: 'Yedekle / geri yükle' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: 'Yedekle / geri yükle' })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
