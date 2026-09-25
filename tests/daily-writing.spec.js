import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function setup(page, html = '<p><br></p>') {
  await page.goto('/')
  await expect(body(page)).toBeVisible()
  await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
  await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
  await expect(page.locator('dialog')).toHaveCount(0)
  await body(page).locator('p').last().click()
  await body(page).press('End')
}
async function paste(page, html, text = '') {
  await body(page).evaluate(
    (root, { html, text }) => {
      const data = new DataTransfer()
      data.setData('text/html', html)
      data.setData('text/plain', text)
      const event = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: data })
      root.dispatchEvent(event)
    },
    { html, text },
  )
}

test('live outline follows heading edits, navigation and undo without adding document IDs', async ({
  page,
}) => {
  await setup(page, '<h1>Başlangıç</h1><h2>Detaylar</h2><p>Metin</p>')
  await page.getByRole('button', { name: 'Belge başlıkları', exact: true }).click()
  const outline = page.getByRole('complementary', { name: 'Belge başlıkları' })
  await expect(outline.getByRole('button', { name: 'H2 Detaylar' })).toBeVisible()
  await outline.getByRole('button', { name: 'H2 Detaylar' }).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' 2026')
  await expect(outline).toContainText('Detaylar 2026')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(outline).not.toContainText('2026')
  await expect(body(page).locator('h1[id],h2[id]')).toHaveCount(0)
  await body(page).locator('p').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/h3')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Son bölüm')
  await expect(outline).toContainText('Son bölüm')
})

test('task list checks, keyboard toggle, enter continuation and empty item exit persist with undo', async ({
  page,
}) => {
  await setup(page, '<p>İlk görev</p>')
  await page.getByRole('button', { name: 'Görev listesi', exact: true }).click()
  const checkbox = body(page).getByRole('checkbox').first()
  await expect(checkbox).toHaveAttribute('aria-checked', 'false')
  await checkbox.click()
  await expect(checkbox).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(checkbox).toHaveAttribute('aria-checked', 'false')
  await body(page).locator('li').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Control+Enter')
  await expect(checkbox).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Enter')
  await page.keyboard.type('İkinci görev')
  await expect(body(page).locator('li')).toHaveCount(2)
  await expect(body(page).getByRole('checkbox').nth(1)).toHaveAttribute('aria-checked', 'false')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Liste sonrası')
  await expect(body(page).locator('p')).toHaveText('Liste sonrası')
  await expect(body(page).locator('li')).toHaveCount(2)
  await expect(page.locator('.save-state')).toHaveText('Tüm değişiklikler kaydedildi')
  await page.reload()
  await expect(body(page).getByRole('checkbox').first()).toHaveAttribute('aria-checked', 'true')
})

test('task and mention metadata survive rich clipboard and malformed mention markup is normalized', async ({
  page,
}) => {
  await setup(page)
  await paste(
    page,
    '<ul data-studio-task-list="true"><li data-studio-checked="true">Hazır</li></ul><p><span data-studio-mention="u-1" data-studio-mention-label="Ayşe"><img src=x onerror="alert(1)">Yanlış</span></p>',
  )
  await expect(body(page).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
  await expect(body(page).locator('[data-studio-mention]')).toHaveText('@Ayşe')
  await expect(body(page).locator('[data-studio-mention] img')).toHaveCount(0)
  const html = await body(page).innerHTML()
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).getByRole('checkbox')).toHaveCount(0)
  await paste(page, html)
  await expect(body(page).getByRole('checkbox')).toHaveCount(1)
  await expect(body(page).locator('[data-studio-mention]')).toHaveAttribute(
    'data-studio-mention',
    'u-1',
  )
})

test('mention creation, reuse, escape and email/code exclusions', async ({ page }) => {
  await setup(page)
  await page.keyboard.insertText('@Ayşe')
  await expect(page.getByRole('listbox', { name: 'Bahsetme önerileri' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(body(page).locator('[data-studio-mention]')).toHaveText('@Ayşe')
  const id = await body(page).locator('[data-studio-mention]').getAttribute('data-studio-mention')
  await page.keyboard.insertText('@Ay')
  await page.getByRole('option', { name: 'Ayşe', exact: true }).click()
  await expect(body(page).locator('[data-studio-mention]')).toHaveCount(2)
  expect(
    await body(page).locator('[data-studio-mention]').nth(1).getAttribute('data-studio-mention'),
  ).toBe(id)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('[data-studio-mention]')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await setup(page, '<p>mail</p>')
  await page.keyboard.type('@example.com')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await setup(page, '<pre>code</pre><p>Son</p>')
  await body(page).locator('pre').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' @Ada')
  await expect(page.getByRole('listbox')).toHaveCount(0)
})

test('task keyboard focus, nesting, conversion and Markdown shortcut preserve content', async ({
  page,
}) => {
  await setup(page)
  await page.keyboard.type('[ ] ')
  await page.keyboard.type('Birinci')
  await page.keyboard.press('Enter')
  await page.keyboard.type('İkinci')
  await page.getByRole('button', { name: 'Girintiyi artır', exact: true }).click()
  await expect(
    body(page).locator('ul[data-studio-task-list] ul[data-studio-task-list]'),
  ).toHaveCount(1)
  const checkbox = body(page).getByRole('checkbox').last()
  await checkbox.focus()
  await page.keyboard.press('Space')
  await expect(checkbox).toHaveAttribute('aria-checked', 'true')
  await expect(checkbox).toBeFocused()
  await page.keyboard.press('Space')
  await expect(checkbox).toHaveAttribute('aria-checked', 'false')
  await body(page).locator('li').last().click()
  await page.keyboard.press('End')
  await page.getByRole('button', { name: 'Görev listesi', exact: true }).click()
  await expect(body(page).getByRole('checkbox')).toHaveCount(1)
  await expect(body(page).locator('ul ul li')).toHaveText('İkinci')
})

test('named styles reflect selection, reset and undo without losing inline formatting', async ({
  page,
}) => {
  await setup(page, '<p><strong>Önemli</strong> bilgi</p><p>Normal</p>')
  await body(page).locator('p').first().click()
  await page.getByRole('button', { name: 'İçerik stilleri', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Uyarı kutusu', exact: true }).click()
  await expect(body(page).locator('p').first()).toHaveAttribute('data-studio-style', 'warning')
  await expect(body(page).locator('strong')).toHaveText('Önemli')
  await page.getByRole('button', { name: 'İçerik stilleri', exact: true }).click()
  await expect(page.getByRole('menuitemradio', { name: 'Uyarı kutusu' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.getByRole('menuitemradio', { name: 'Normal metin', exact: true }).click()
  await expect(body(page).locator('[data-studio-style]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page).locator('[data-studio-style]')).toHaveCount(1)
})

test('extended slash inserts tasks and styles; table insertion and cancelled dialogs preserve undo', async ({
  page,
}) => {
  await setup(page)
  await page.keyboard.type('/task')
  await page.keyboard.press('Enter')
  await expect(body(page).getByRole('checkbox')).toHaveCount(1)
  await page.keyboard.type('Görev')
  await expect(body(page).locator('li')).toHaveText('Görev')
  await setup(page)
  await page.keyboard.type('/style:info')
  await page.keyboard.press('Enter')
  await expect(body(page).locator('p')).toHaveAttribute('data-studio-style', 'info')
  await setup(page)
  await page.keyboard.type('/table')
  await page.keyboard.press('Enter')
  await expect(body(page).locator('table')).toHaveCount(1)
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(body(page)).toContainText('/table')
  await setup(page)
  await page.keyboard.type('/embed')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'İptal', exact: true }).click()
  await expect(body(page)).toContainText('/embed')
})

test('mobile outline drawer and mention menu stay within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page, '<h1>Başlık</h1><p><br></p>')
  await page.getByRole('button', { name: 'Görünüm', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Belge başlıkları', exact: true }).click()
  const outline = await page.getByRole('complementary', { name: 'Belge başlıkları' }).boundingBox()
  expect(outline.x).toBeGreaterThanOrEqual(0)
  expect(outline.x + outline.width).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Başlık gezginini kapat' }).click()
  await body(page).locator('p').click()
  await page.keyboard.type('@Ada')
  const menu = await page.getByRole('listbox').boundingBox()
  expect(menu.x).toBeGreaterThanOrEqual(0)
  expect(menu.x + menu.width).toBeLessThanOrEqual(390)
})
