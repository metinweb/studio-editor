import { test, expect } from '@playwright/test'

const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function load(page, html) {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function select(page, text) {
  await body(page).evaluate((root, text) => {
    const walker = root.ownerDocument.createTreeWalker(root, 4)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.textContent.indexOf(text)
      if (index < 0) continue
      const range = root.ownerDocument.createRange()
      range.setStart(node, index)
      range.setEnd(node, index + text.length)
      root.focus()
      root.ownerDocument.getSelection().removeAllRanges()
      root.ownerDocument.getSelection().addRange(range)
      return
    }
    throw new Error(`Missing text: ${text}`)
  }, text)
}
async function menu(page, name, item) {
  await page.locator('.native-menubar').getByRole('button', { name, exact: true }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('authors mark inline and block regions, then restricted mode locks everything else', async ({
  page,
}) => {
  await load(
    page,
    '<h2>Sözleşme</h2><p>Müşteri: Ad Soyad</p><p>Madde 1 sabittir.</p><p>Notlar başlangıcı</p><p>Notlar sonu</p>',
  )
  await select(page, 'Ad Soyad')
  await menu(page, 'Düzenle', 'Düzenlenebilir alan yap')
  const dialog = page.getByRole('dialog', { name: 'Düzenlenebilir alan yap' })
  await dialog.getByRole('textbox', { name: 'Alan adı (isteğe bağlı)' }).fill('9 hatalı')
  await dialog.getByRole('button', { name: 'Alanı oluştur' }).click()
  await expect(dialog.getByRole('alert')).toContainText('harfle başlamalı')
  await dialog.getByRole('textbox', { name: 'Alan adı (isteğe bağlı)' }).fill('musteri')
  await dialog.getByRole('button', { name: 'Alanı oluştur' }).click()
  await expect(body(page).locator('span[data-studio-editable="musteri"]')).toHaveText('Ad Soyad')
  // A selection across blocks becomes one block region.
  await body(page).evaluate((root) => {
    const [first, last] = [...root.querySelectorAll('p')].slice(2)
    const range = root.ownerDocument.createRange()
    range.setStart(first.firstChild, 0)
    range.setEnd(last.firstChild, 5)
    root.focus()
    root.ownerDocument.getSelection().removeAllRanges()
    root.ownerDocument.getSelection().addRange(range)
  })
  await menu(page, 'Düzenle', 'Düzenlenebilir alan yap')
  await page.getByRole('button', { name: 'Alanı oluştur' }).click()
  await expect(body(page).locator('div[data-studio-editable="true"] p')).toHaveCount(2)

  await menu(page, 'Düzenle', 'Kısıtlı düzenleme modu')
  await expect(body(page)).toHaveAttribute('data-restricted', 'true')
  // Regions carry no runtime attributes: saved HTML is the same in both modes.
  await expect(body(page).locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(page.locator('.native-statusbar')).toContainText('Kısıtlı düzenleme')
  await expect(page.getByRole('button', { name: 'Tablo ekle' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Kalın', exact: true })).toBeVisible()

  // Locked text ignores typing; the region accepts it.
  await body(page).locator('h2').click()
  await page.keyboard.type('XYZ')
  await expect(body(page).locator('h2')).toHaveText('Sözleşme')
  await body(page).locator('span[data-studio-editable]').click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type('Ayşe Yılmaz')
  await expect(body(page).locator('span[data-studio-editable]')).toHaveText('Ayşe Yılmaz')
  await expect(body(page).locator('p').first()).toHaveText('Müşteri: Ayşe Yılmaz')
  // Enter cannot split an inline region; Tab moves to the next region.
  await page.keyboard.press('Enter')
  await expect(body(page).locator('p').first()).toHaveText('Müşteri: Ayşe Yılmaz')
  await page.keyboard.press('Tab')
  await expect
    .poll(() =>
      body(page).evaluate((root) => {
        const node = root.ownerDocument.getSelection().anchorNode
        const element = node?.nodeType === 1 ? node : node?.parentElement
        return element?.closest('div[data-studio-editable]') ? 'block' : 'other'
      }),
    )
    .toBe('block')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Yeni not')
  await expect(body(page).locator('div[data-studio-editable] p')).toHaveCount(3)
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.type('Can')
  await expect(body(page).locator('span[data-studio-editable]')).toHaveText('Can')
  await expect(body(page).locator('p').nth(1)).toHaveText('Madde 1 sabittir.')
})

test('the guard reverts changes outside regions from paste, commands and undo', async ({
  page,
}) => {
  await load(
    page,
    '<p>Sabit metin <span data-studio-editable="ad">Değer</span> burada.</p><p>İkinci sabit paragraf.</p>',
  )
  await select(page, 'burada.')
  await body(page).evaluate((root) => root.ownerDocument.getSelection().collapseToEnd())
  await page.keyboard.type(' önce')
  await expect(body(page).locator('p').first()).toContainText('burada. önce')
  await menu(page, 'Düzenle', 'Kısıtlı düzenleme modu')
  // Paste outside a region is refused; inside an inline region it becomes plain text.
  await body(page).evaluate((root) => {
    const paste = (target, html) => {
      const range = root.ownerDocument.createRange()
      range.selectNodeContents(target)
      root.ownerDocument.getSelection().removeAllRanges()
      root.ownerDocument.getSelection().addRange(range)
      const data = new DataTransfer()
      data.setData('text/html', html)
      data.setData('text/plain', 'Düz metin')
      const event = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: data })
      target.dispatchEvent(event)
    }
    paste(root.querySelectorAll('p')[1], '<h1>Saldırı</h1>')
    paste(root.querySelector('[data-studio-editable]'), '<h1>Başlık</h1><p>Paragraf</p>')
  })
  await expect(body(page).locator('p').nth(1)).toHaveText('İkinci sabit paragraf.')
  await expect(body(page).locator('h1')).toHaveCount(0)
  await expect(body(page).locator('[data-studio-editable]')).toHaveText('Düz metin')
  // Undo stops before the pre-restriction edit to locked text.
  await page.keyboard.press('Control+z')
  await expect(body(page).locator('[data-studio-editable]')).toHaveText('Değer')
  await page.keyboard.press('Control+z')
  await expect(body(page).locator('p').first()).toContainText('burada. önce')
  await expect(page.getByRole('status').filter({ hasText: 'korunan içeriği' })).toBeVisible()
  await menu(page, 'Düzenle', 'Kısıtlı düzenleme modu')
  await expect(body(page)).not.toHaveAttribute('data-restricted', 'true')
  await body(page).locator('p').nth(1).click()
  await page.keyboard.press('Control+z')
  await expect(body(page).locator('p').first()).not.toContainText('önce')
})

test('removing a region unwraps its content', async ({ page }) => {
  await load(page, '<p>Önce <span data-studio-editable="true">alan</span> sonra</p>')
  await select(page, 'alan')
  await menu(page, 'Düzenle', 'Düzenlenebilir alanı kaldır')
  await expect(body(page).locator('[data-studio-editable]')).toHaveCount(0)
  await expect(body(page).locator('p')).toHaveText('Önce alan sonra')
})
