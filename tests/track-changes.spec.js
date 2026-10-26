import { test, expect } from '@playwright/test'

const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function load(page, html) {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
}
async function menu(page, name, item) {
  await page.locator('.native-menubar').getByRole('button', { name, exact: true }).click()
  await page.getByRole('menuitem', { name: item }).click()
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
async function caretAfter(page, text) {
  await select(page, text)
  await body(page).evaluate((root) => root.ownerDocument.getSelection().collapseToEnd())
}

test('typing, deleting and replacing become suggestions; own insertions delete for real', async ({
  page,
}) => {
  await load(page, '<p>Kırmızı elma tatlıdır.</p>')
  await menu(page, 'Araçlar', 'Değişiklikleri izle')
  await expect(page.locator('.native-statusbar')).toContainText('Değişiklikler izleniyor')
  await caretAfter(page, 'elma')
  await page.keyboard.type(' ve armut')
  const inserted = body(page).locator('ins[data-studio-change="insert"]')
  await expect(inserted).toHaveText(' ve armut')
  await expect(inserted).toHaveAttribute('data-studio-author', 'local')
  // Deleting your own suggestion removes it.
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await expect(inserted).toHaveText(' ve arm')
  await expect(body(page).locator('del')).toHaveCount(0)
  // Deleting original text marks it.
  await select(page, 'Kırmızı ')
  await page.keyboard.press('Backspace')
  const deleted = body(page).locator('del[data-studio-change="delete"]')
  await expect(deleted).toHaveText('Kırmızı ')
  await expect(body(page).locator('p')).toHaveText('Kırmızı elma ve arm tatlıdır.')
  // Typing over a selection is one replacement change.
  await select(page, 'tatlıdır')
  await page.keyboard.type('ekşidir')
  const replacement = body(page).locator('ins', { hasText: 'ekşidir' })
  await expect(replacement).toHaveCount(1)
  const id = await replacement.getAttribute('data-studio-change-id')
  await expect(body(page).locator(`del[data-studio-change-id="${id}"]`)).toHaveText('tatlıdır')
  // Formatting is refused while tracking.
  await select(page, 'elma')
  await page.keyboard.press('Control+b')
  await expect(body(page).locator('strong')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'yalnızca metin ekleme' })).toBeVisible()

  await page.getByRole('button', { name: 'Değişiklikler', exact: false }).first().click()
  const panel = page.getByRole('complementary', { name: 'Belge inceleme' })
  await expect(panel.locator('.change-card')).toHaveCount(3)
  await expect(panel.locator('.change-card[data-change-type="replace"]')).toContainText('ekşidir')
  // Accept the insertion, reject the deletion.
  await panel
    .locator('.change-card[data-change-type="insert"]')
    .getByRole('button', { name: 'Kabul et' })
    .click()
  await expect(body(page).locator('ins', { hasText: 've arm' })).toHaveCount(0)
  await panel
    .locator('.change-card[data-change-type="delete"]')
    .getByRole('button', { name: 'Reddet' })
    .click()
  await expect(body(page).locator('del', { hasText: 'Kırmızı' })).toHaveCount(0)
  await expect(body(page).locator('p')).toHaveText('Kırmızı elma ve arm tatlıdırekşidir.')
  await panel.getByRole('button', { name: 'Tümünü kabul et' }).click()
  await expect(body(page).locator('p')).toHaveText('Kırmızı elma ve arm ekşidir.')
  await expect(body(page).locator('[data-studio-change]')).toHaveCount(0)
  // Resolution is undoable.
  await body(page).locator('p').click()
  await page.keyboard.press('Control+z')
  await expect(body(page).locator('del', { hasText: 'tatlıdır' })).toHaveCount(1)
})

test('paragraph breaks and joins are suggestions; paste and replace are tracked', async ({
  page,
}) => {
  await load(page, '<p>Birinci cümle. İkinci cümle.</p><p>Son paragraf.</p>')
  await menu(page, 'Araçlar', 'Değişiklikleri izle')
  await caretAfter(page, 'Birinci cümle.')
  await page.keyboard.press('Enter')
  const split = body(page).locator('p[data-studio-change="split"]')
  await expect(split).toHaveText(' İkinci cümle.')
  // Backspace at the start of your own new paragraph removes the suggestion.
  await page.keyboard.press('Backspace')
  await expect(split).toHaveCount(0)
  await expect(body(page).locator('p').first()).toHaveText('Birinci cümle. İkinci cümle.')
  // Joining original paragraphs is a suggestion.
  await body(page).locator('p').nth(1).click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Backspace')
  await expect(body(page).locator('p[data-studio-change="join"]')).toHaveText('Son paragraf.')
  await expect(body(page).locator('p')).toHaveCount(2)
  // Plain-text paste becomes an insertion.
  await caretAfter(page, 'Son paragraf.')
  await body(page).evaluate((root) => {
    const data = new DataTransfer()
    data.setData('text/html', '<h1>Kalın başlık</h1>')
    data.setData('text/plain', ' Yapıştırılan')
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: data })
    root.dispatchEvent(event)
  })
  await expect(body(page).locator('h1')).toHaveCount(0)
  await expect(body(page).locator('ins', { hasText: 'Yapıştırılan' })).toHaveCount(1)
  // Find and replace suggests each replacement.
  await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'Aranacak metin' }).fill('cümle')
  await page.getByRole('textbox', { name: 'Yerine yazılacak metin' }).fill('ifade')
  await page.getByRole('button', { name: 'Tümünü değiştir' }).click()
  await expect(body(page).locator('del', { hasText: 'cümle' })).toHaveCount(2)
  await expect(body(page).locator('ins', { hasText: 'ifade' })).toHaveCount(2)
  await menu(page, 'Araçlar', 'Tüm değişiklikleri reddet')
  await expect(body(page).locator('[data-studio-change]')).toHaveCount(0)
  await expect(body(page).locator('p')).toHaveText([
    'Birinci cümle. İkinci cümle.',
    'Son paragraf.',
  ])
  // Turning tracking off restores normal editing.
  await menu(page, 'Araçlar', 'Değişiklikleri izle')
  await caretAfter(page, 'Son paragraf.')
  await page.keyboard.type('!')
  await expect(body(page).locator('ins')).toHaveCount(0)
  await expect(body(page).locator('p').last()).toHaveText('Son paragraf.!')
})

test('cut and IME composition are tracked', async ({ page, browserName }) => {
  await load(page, '<p>Bir iki üç</p>')
  await menu(page, 'Araçlar', 'Değişiklikleri izle')
  await select(page, 'iki ')
  await page.keyboard.press('Control+x')
  await expect(body(page).locator('del[data-studio-change="delete"]')).toHaveText('iki ')
  await expect(body(page).locator('p')).toHaveText('Bir iki üç')
  test.skip(browserName !== 'chromium', 'IME composition is driven through the Chromium protocol')
  await caretAfter(page, 'üç')
  const session = await page.context().newCDPSession(page)
  await session.send('Input.imeSetComposition', { text: ' dö', selectionStart: 3, selectionEnd: 3 })
  await session.send('Input.imeSetComposition', {
    text: ' dört',
    selectionStart: 5,
    selectionEnd: 5,
  })
  await session.send('Input.insertText', { text: ' dört' })
  await expect(body(page).locator('ins[data-studio-change="insert"]')).toHaveText(' dört')
  await expect(body(page).locator('p')).toHaveText('Bir iki üç dört')
})
