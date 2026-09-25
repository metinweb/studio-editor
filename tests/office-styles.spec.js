import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function paste(page, html) {
  await page.goto('/')
  await expect(body(page)).toBeVisible()
  await body(page).evaluate((root) => {
    root.innerHTML = '<p><br></p>'
    root.focus()
    const range = root.ownerDocument.createRange()
    range.selectNodeContents(root.firstChild)
    range.collapse(true)
    root.ownerDocument.getSelection().removeAllRanges()
    root.ownerDocument.getSelection().addRange(range)
  })
  await body(page).evaluate((root, html) => {
    const data = new DataTransfer()
    data.setData('text/html', html)
    const e = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'clipboardData', { value: data })
    root.dispatchEvent(e)
  }, html)
}
test('stylesheet cascade and inherited cell typography become safe inline styles', async ({
  page,
}) => {
  await paste(
    page,
    '<style>.grid { color:#123456;font-family:Georgia } .cell { background-color:#dcfce7;padding:13px } td.cell { color:#654321 } .cell { color:#abcdef!important } .bad { background-image:url(https://example.com/tracker) }</style><table class="grid"><tr><td class="cell" style="color:#000000">A</td><td class="bad">B</td></tr></table>',
  )
  await expect(body(page).locator('td').first()).toHaveCSS('color', 'rgb(171, 205, 239)')
  await expect(body(page).locator('td').first()).toHaveCSS('padding-top', '13px')
  await expect(body(page).locator('td').last()).toHaveCSS('color', 'rgb(18, 52, 86)')
  await expect(body(page).locator('td').last()).toHaveCSS('font-family', 'Georgia')
  await expect(body(page).locator('td').last()).not.toHaveAttribute('style', /url/)
  await expect(body(page).locator('style,[class]')).toHaveCount(0)
})
test('Office alphabetic and Roman list markers preserve starts and inline class styling', async ({
  page,
}) => {
  await paste(
    page,
    '<style>p.MsoListParagraph { color:#123456;font-weight:bold }</style><p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">c. </span>Üçüncü</p><p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">d. </span>Dördüncü</p><p>Ara</p><p style="mso-list:l1 level1 lfo2"><span style="mso-list:Ignore">IV. </span>Dört</p>',
  )
  await expect(body(page).locator('ol').first()).toHaveAttribute('start', '3')
  await expect(body(page).locator('ol').first()).toHaveCSS('list-style-type', 'lower-alpha')
  await expect(body(page).locator('ol').last()).toHaveAttribute('start', '4')
  await expect(body(page).locator('ol').last()).toHaveCSS('list-style-type', 'upper-roman')
  await expect(body(page).locator('li').first()).toHaveCSS('color', 'rgb(18, 52, 86)')
  await expect(body(page).locator('li').first()).toHaveText('Üçüncü')
})
