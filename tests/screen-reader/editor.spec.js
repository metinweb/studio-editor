import { screenReaderTest as test } from '@guidepup/playwright'
import { expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

// NVDA (Windows) or VoiceOver (macOS) reads the editor while keys go through the operating
// system. Assertions check what the screen reader spoke and, for VoiceOver, the text of the item
// under its cursor (VoiceOver keeps only its last phrase, often a usage hint). Each test writes
// the transcript to its output folder.
test.use({ screenReaderStartOptions: { capture: true } })

const mac = process.platform === 'darwin'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
const heard = async (screenReader) =>
  [...(await screenReader.spokenPhraseLog()), ...(await screenReader.itemTextLog())].join('\n')
const activeLabel = (page) =>
  page.evaluate(() => {
    const element = document.activeElement
    return element.dataset.label || element.getAttribute('aria-label') || element.textContent.trim()
  })
// Selects the element's contents, or puts the caret at its end.
const select = (locator, collapse = false) =>
  locator.evaluate((element, collapse) => {
    const range = element.ownerDocument.createRange()
    range.selectNodeContents(element)
    if (collapse) range.collapse(false)
    element.ownerDocument.getSelection().removeAllRanges()
    element.ownerDocument.getSelection().addRange(range)
  }, collapse)
async function spoken(screenReader, action) {
  const { spokenPhrase, itemText } = await screenReader.capture(action)
  return `${spokenPhrase}\n${itemText}`
}
// Screen readers may keep the first Escape to leave their focus/interaction mode.
async function escape(screenReader, closed) {
  for (let attempt = 0; attempt < 3 && !(await closed()); attempt++)
    await screenReader.press('Escape')
}
async function open(page, screenReader) {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  // Records the key and input events the editor receives, to show they come from the system.
  await body(page).evaluate((editor) => {
    const events = (window.top.__studioInput = [])
    for (const type of ['keydown', 'beforeinput'])
      editor.ownerDocument.addEventListener(
        type,
        (event) =>
          events.push(
            `${type} ${event.key || event.inputType} ${event.data ?? ''} trusted=${event.isTrusted}`,
          ),
        true,
      )
  })
  await screenReader.navigateToWebContent()
}

test.afterEach(async ({ page, screenReader }, testInfo) => {
  const path = testInfo.outputPath('transcript.txt')
  const spokenLog = (await screenReader.spokenPhraseLog()).join('\n')
  const itemLog = (await screenReader.itemTextLog()).join('\n')
  const inputLog = (await page.evaluate(() => window.__studioInput || []).catch(() => [])).join(
    '\n',
  )
  await writeFile(
    path,
    `Spoken:\n${spokenLog}\n\nItem text:\n${itemLog}\n\nEditor input events:\n${inputLog}\n`,
  )
  await testInfo.attach('screen-reader-transcript', { path, contentType: 'text/plain' })
})

test('the document, typing and the bold toggle are announced', async ({ page, screenReader }) => {
  await open(page, screenReader)
  const document = await spoken(screenReader, () => body(page).locator('h1').click())
  // NVDA reads the frame and editor labels; VoiceOver reads the line and the text area role.
  expect(document).toMatch(mac ? /text area/ : /Belge (içeriği|düzenleme alanı)/)
  // VoiceOver uses Home/End to move its own cursor (and keyboard focus) through the page, so on
  // macOS the caret and selection are set by script. Enter, typing and Space are real keys.
  if (mac) await select(body(page).locator('h1'), true)
  else await screenReader.press('End')
  await screenReader.press('Enter')
  await screenReader.type('ekran okuyucu')
  const typed = body(page).locator('p', { hasText: 'ekran okuyucu' })
  await expect(typed).toHaveCount(1)
  // Autosave after each character must not be read aloud.
  expect(await heard(screenReader)).not.toMatch(/Kaydediliyor|Kaydedilmeyi bekliyor/)
  if (mac) await select(typed)
  else await screenReader.press('Shift+Home')
  const bold = page.getByRole('button', { name: 'Kalın', exact: true })
  expect(await spoken(screenReader, () => bold.focus())).toContain('Kalın')
  await screenReader.press('Space')
  await expect(body(page).locator('strong', { hasText: 'ekran okuyucu' })).toHaveCount(1)
  await expect(bold).toHaveAttribute('aria-pressed', 'true')
})

test('menus open, move and close with announced items', async ({ page, screenReader }) => {
  await open(page, screenReader)
  const insert = page.locator('.native-menubar').getByRole('button', { name: 'Ekle', exact: true })
  expect(await spoken(screenReader, () => insert.focus())).toContain('Ekle')
  await screenReader.press('Enter')
  await expect(page.getByRole('menu')).toBeVisible()
  const labels = await page
    .getByRole('menu')
    .locator('[role=menuitem]')
    .evaluateAll((items) => items.map((item) => item.dataset.label))
  expect(labels).toContain(await activeLabel(page))
  expect(await heard(screenReader)).toContain(await activeLabel(page))
  await screenReader.press('ArrowDown')
  expect(await heard(screenReader)).toContain(labels[1])
  await escape(screenReader, async () => !(await page.getByRole('menu').count()))
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(insert).toBeFocused()
})

test('dialogs announce their name and return focus', async ({ page, screenReader }) => {
  await open(page, screenReader)
  await body(page).locator('h1').click()
  const linkButton = page.getByRole('button', { name: 'Bağlantı ekle', exact: true })
  const announced = await spoken(screenReader, () => linkButton.click())
  const dialog = page.getByRole('dialog', { name: 'Bağlantı' })
  await expect(dialog).toBeVisible()
  expect(announced).toContain('Bağlantı')
  expect(announced).toContain(await activeLabel(page))
  await escape(screenReader, async () => !(await dialog.isVisible()))
  await expect(dialog).toBeHidden()
  // Real Ctrl/⌘+F opens the find panel and the screen reader reads its search field.
  await body(page).locator('h1').click()
  await screenReader.press(mac ? 'Command+f' : 'Control+f')
  const search = page.getByRole('textbox', { name: 'Aranacak metin' })
  await expect(search).toBeFocused()
  expect(await heard(screenReader)).toContain('Aranacak metin')
})
