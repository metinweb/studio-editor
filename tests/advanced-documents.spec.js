import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const button = (page, name) => page.getByRole('button', { name, exact: true })
async function start(page, html) {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await button(page, 'Kaynak kodu').click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await button(page, 'Değişiklikleri uygula').click()
}
async function menu(page, name, item) {
  await page.locator('.native-menubar').getByRole('button', { name, exact: true }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}
const table =
  '<table><tbody><tr><td>10</td><td>20</td><td>0</td></tr><tr><td>3</td><td>5</td><td>0</td></tr></tbody></table><p>End</p>'
async function formula(page, index, expression) {
  await body(page).locator('td').nth(index).click()
  await menu(page, 'Tablo', 'Tablo formülü')
  await page.getByRole('textbox', { name: 'Formül', exact: true }).fill(expression)
  await button(page, 'Formülü uygula').click()
}
test('table formulas update dependencies, survive reload and support edit undo and freezing', async ({
  page,
}) => {
  await start(page, table)
  await formula(page, 2, '=SUM(A1:B1)')
  await expect(body(page).locator('[data-studio-formula]')).toHaveText('30')
  await formula(page, 5, '=C1*A2')
  await expect(body(page).locator('[data-studio-formula]')).toHaveText(['30', '90'])
  await body(page).focus()
  await body(page).locator('td').first().selectText()
  await page.keyboard.type('15')
  await expect(body(page).locator('[data-studio-formula]')).toHaveText(['35', '105'])
  await button(page, 'Geri al').click()
  await expect(body(page).locator('[data-studio-formula]')).toHaveText(['30', '90'])
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(body(page).locator('[data-studio-formula]')).toHaveText(['30', '90'])
  await body(page).locator('[data-studio-formula]').first().dblclick()
  await button(page, 'Sonucu sabit metne çevir').click()
  await expect(body(page).locator('[data-studio-formula]')).toHaveText('90')
  await button(page, 'Geri al').click()
  await expect(body(page).locator('[data-studio-formula]')).toHaveCount(2)
})
test('formula parser rejects cycles and executable text; structure edits demand review', async ({
  page,
}) => {
  await start(page, table)
  await formula(page, 2, '=A1+B1')
  await body(page).locator('[data-studio-formula]').dblclick()
  await page.getByRole('textbox', { name: 'Formül', exact: true }).fill('=C1+1')
  await expect(page.locator('.formula-result')).toContainText('#CYCLE!')
  await expect(button(page, 'Formülü uygula')).toBeDisabled()
  await page.getByRole('textbox', { name: 'Formül', exact: true }).fill('=alert(1)')
  await expect(page.locator('.formula-result')).toContainText('#FORMULA!')
  await button(page, 'Vazgeç').click()
  await body(page).locator('td').first().click()
  await menu(page, 'Tablo', 'Satır ekle')
  await expect(body(page).locator('[data-studio-formula]')).toHaveText('#REF!')
  await body(page).locator('[data-studio-formula]').dblclick()
  await button(page, 'Formülü uygula').click()
  await expect(body(page).locator('[data-studio-formula]')).toHaveText('30')
})
test('conditional fields edit in place and resolve literal branches through merge values with undo', async ({
  page,
}) => {
  await start(page, '<p>Customer: </p>')
  await body(page).locator('p').click()
  await page.keyboard.press('End')
  await menu(page, 'Ekle', 'Koşullu alan')
  await page.getByRole('textbox', { name: 'Koşul doğruysa' }).fill('<img src=x> Business')
  await page.getByRole('dialog').getByRole('button', { name: 'Ekle', exact: true }).click()
  await expect(body(page).locator('[data-studio-condition]')).toContainText('Customer.Type')
  await body(page).locator('[data-studio-condition]').dblclick()
  await page.getByRole('textbox', { name: 'Koşul yanlışsa' }).fill('Personal')
  await button(page, 'Güncelle').click()
  await button(page, 'Şablon değişkenleri').click()
  await page.getByRole('textbox', { name: 'Customer.Type', exact: true }).fill('business')
  await button(page, 'Değerleri belgeye uygula').click()
  await expect(body(page)).toContainText('<img src=x> Business')
  await expect(body(page).locator('img')).toHaveCount(0)
  await button(page, 'Geri al').click()
  await expect(body(page).locator('[data-studio-condition]')).toHaveCount(1)
  await button(page, 'Şablon değişkenleri').click()
  await page.getByRole('textbox', { name: 'Customer.Type', exact: true }).fill('private')
  await button(page, 'Değerleri belgeye uygula').click()
  await expect(body(page)).toContainText('Personal')
})
test('named writing profiles persist, load explicitly and export/import JSON', async ({ page }) => {
  await start(page, '<p><br></p>')
  await menu(page, 'Araçlar', 'Otomatik düzeltme ve metin kısayolları')
  await page.getByRole('checkbox', { name: 'Etkinleştir', exact: true }).check()
  await page.getByRole('textbox', { name: 'Kısayol', exact: true }).fill(';team')
  await page.getByRole('textbox', { name: 'Yerine yazılacak metin' }).fill('Studio team')
  await button(page, 'Kural ekle').click()
  await page.locator('.writing-profiles summary').click()
  await page.getByRole('textbox', { name: 'Profil adı' }).fill('Team profile')
  await button(page, 'Profili kaydet').click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('kaydedildi')
  const download = page.waitForEvent('download')
  await button(page, 'Profil JSON indir').click()
  const json = await readFile(await (await download).path(), 'utf8')
  expect(JSON.parse(json).name).toBe('Team profile')
  await button(page, 'Vazgeç').click()
  await page.reload()
  await body(page).waitFor()
  await menu(page, 'Araçlar', 'Otomatik düzeltme ve metin kısayolları')
  await expect(page.getByRole('checkbox', { name: 'Etkinleştir', exact: true })).not.toBeChecked()
  await page.locator('.writing-profiles summary').click()
  await page.getByRole('combobox', { name: 'Kayıtlı profiller' }).selectOption('Team profile')
  await button(page, 'Profili yükle').click()
  await expect(page.getByRole('checkbox', { name: 'Etkinleştir', exact: true })).toBeChecked()
  await button(page, 'Profili sil').click()
  await expect(
    page.getByRole('combobox', { name: 'Kayıtlı profiller' }).locator('option'),
  ).toHaveCount(1)
  await page.getByLabel('Profil JSON içe aktar', { exact: true }).setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":1,"kind":"unknown"}'),
  })
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Geçerli bir yazma profili',
  )
  await page.getByLabel('Profil JSON içe aktar', { exact: true }).setInputFiles({
    name: 'profile.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  })
  await expect(page.getByRole('textbox', { name: 'Profil adı' })).toHaveValue('Team profile')
  await button(page, 'Ayarları uygula').click()
  await body(page).locator('p').click()
  await page.keyboard.type(';team ')
  await expect(body(page)).toContainText('Studio team')
})
test('formula and condition dialogs fit small screens with visible primary actions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await start(page, table)
  await body(page).locator('td').nth(2).click()
  await menu(page, 'Tablo', 'Tablo formülü')
  let box = await button(page, 'Formülü uygula').boundingBox()
  expect(box.y + box.height).toBeLessThanOrEqual(844)
  await button(page, 'Vazgeç').click()
  await body(page).focus()
  await page.keyboard.press('Control+End')
  await menu(page, 'Ekle', 'Koşullu alan')
  box = await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Ekle', exact: true })
    .boundingBox()
  expect(box.y + box.height).toBeLessThanOrEqual(844)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
