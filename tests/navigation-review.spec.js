import { test, expect } from '@playwright/test'
import { unzipSync, strFromU8 } from 'fflate'
import { readFile } from 'node:fs/promises'
const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function setup(page, html) {
  await page.addInitScript(() => localStorage.setItem('studio-locale', 'en'))
  await page.goto('/')
  await expect(body(page)).toBeVisible()
  await page.getByRole('button', { name: 'Source code', exact: true }).click()
  await page.getByRole('textbox', { name: 'HTML source code' }).fill(html)
  await page.getByRole('button', { name: 'Apply changes' }).click()
}
async function search(page, query) {
  await page.getByRole('button', { name: 'Find and replace', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search text' }).fill(query)
}

test('Unicode search previews preserve formatting, skip protected fields and undo replacement', async ({
  page,
}) => {
  await setup(
    page,
    '<p>TITLE <strong>ti</strong>tle titles</p><p>café CAFÉ cafe</p><p><span data-studio-field="title">{{title}}</span> title</p>',
  )
  await search(page, 'title')
  await expect(page.locator('.find-count')).toHaveText('0 / 4')
  await page.getByRole('checkbox', { name: 'Whole word' }).check()
  await expect(page.locator('.find-count')).toHaveText('0 / 3')
  await page.locator('.search-previews summary').click()
  await expect(page.locator('.search-preview-list button')).toHaveCount(3)
  await page.locator('.search-preview-list button').nth(1).click()
  expect(await body(page).evaluate((root) => root.ownerDocument.getSelection().toString())).toBe(
    'title',
  )
  await page.getByRole('textbox', { name: 'Replacement text', exact: true }).fill('Document')
  await page.getByRole('button', { name: 'Replace all', exact: true }).click()
  await expect(body(page).locator('[data-studio-field]')).toHaveText('{{title}}')
  await expect(body(page).locator('p').first()).toHaveText('Document Document titles')
  await expect(page.locator('.search-feedback')).toHaveText('3 matches replaced.')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(body(page).locator('strong')).toHaveText('ti')
  await page.getByRole('textbox', { name: 'Search text' }).fill('cafe')
  await page.getByRole('checkbox', { name: 'Ignore accents' }).check()
  await expect(page.locator('.find-count')).toHaveText('0 / 3')
  await page.getByRole('textbox', { name: 'Replacement text', exact: true }).fill('coffee')
  await page.getByRole('button', { name: 'Replace all', exact: true }).click()
  await expect(body(page).locator('p').nth(1)).toHaveText('coffee coffee coffee')
  expect(await body(page).innerHTML()).not.toContain('studio-search')
})

test('search never spans a protected widget, line break or adjacent table cells and previous starts last', async ({
  page,
}) => {
  await setup(
    page,
    '<p>ab<span data-studio-field="X">{{X}}</span>cd</p><p>ab<br>cd</p><table><tr><td>ab</td><td>cd</td></tr></table><p>ab cd</p>',
  )
  await search(page, 'abcd')
  await expect(page.locator('.find-count')).toHaveText('No results')
  await page.getByRole('textbox', { name: 'Search text' }).fill('ab')
  await page.getByRole('button', { name: 'Previous match' }).click()
  await expect(page.locator('.find-count')).toHaveText('4 / 4')
  await page.getByRole('textbox', { name: 'Search text' }).focus()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('search')).toHaveCount(0)
  expect(
    await body(page).evaluate(
      (root) => root.ownerDocument.defaultView.CSS.highlights?.has('studio-search') || false,
    ),
  ).toBe(false)
})

test('outline moves complete sections, changes descendant levels, filters and collapses with undo and persistence', async ({
  page,
}) => {
  await setup(
    page,
    '<h1>Guide</h1><h2 id="alpha">Alpha</h2><p>Alpha text</p><h3>Detail</h3><p>Detail text</p><h2>Beta</h2><p>Beta text</p>',
  )
  await page.getByRole('button', { name: 'Document outline', exact: true }).click()
  const outline = page.getByRole('complementary', { name: 'Document outline' })
  await outline.getByRole('button', { name: 'H2 Alpha', exact: true }).click()
  await outline.getByRole('button', { name: 'Move section down' }).click()
  await expect(body(page).locator('h2')).toHaveText(['Beta', 'Alpha'])
  await expect(body(page).locator('h2').last()).toHaveAttribute('id', 'alpha')
  await expect(body(page).locator('p')).toHaveText(['Beta text', 'Alpha text', 'Detail text'])
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(body(page).locator('h2')).toHaveText(['Alpha', 'Beta'])
  await outline.getByRole('button', { name: 'H2 Alpha', exact: true }).click()
  await outline.getByRole('button', { name: 'Demote heading level' }).click()
  await expect(body(page).locator('h3')).toHaveText('Alpha')
  await expect(body(page).locator('h4')).toHaveText('Detail')
  await outline.getByRole('button', { name: 'Toggle subheadings: Alpha', exact: true }).click()
  await expect(outline.getByRole('button', { name: 'H4 Detail', exact: true })).toHaveCount(0)
  await outline.getByRole('textbox', { name: 'Search headings' }).fill('Detail')
  await expect(outline.getByRole('button', { name: 'H4 Detail', exact: true })).toBeVisible()
  await expect(page.locator('.save-state')).toHaveText('All changes saved')
  await page.reload()
  await expect(body(page).locator('h4')).toHaveText('Detail')
})

test('review categories fix captions and heading gaps, detect broken links and export a current report', async ({
  page,
}) => {
  await setup(
    page,
    '<h1>Guide</h1><h3 id="details">Details</h3><p><a href="#missing">Missing</a> <a href="#details">Working</a></p><table><tr><th>Price</th></tr><tr><td>10</td></tr></table>',
  )
  await page.getByRole('button', { name: 'Content check', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Document review' })
  await expect(panel.locator('.check-card')).toHaveCount(3)
  await panel.getByRole('combobox', { name: 'Check category' }).selectOption('tables')
  await panel.getByRole('textbox', { name: 'Table caption' }).fill('Quarterly prices')
  await panel.getByRole('button', { name: 'Apply fix', exact: true }).click()
  await expect(body(page).locator('caption')).toHaveText('Quarterly prices')
  await panel.getByRole('combobox', { name: 'Check category' }).selectOption('headings')
  await panel.getByRole('button', { name: 'Change to H2' }).click()
  await expect(body(page).locator('h2')).toHaveAttribute('id', 'details')
  const download = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Download review report' }).click()
  const stream = await (await download).createReadStream(),
    chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const report = JSON.parse(Buffer.concat(chunks).toString())
  expect(report.issues).toHaveLength(1)
  expect(report.issues[0]).toMatchObject({
    type: 'anchor',
    title: 'Internal link target is missing',
    excerpt: 'Missing',
  })
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(body(page).locator('h3')).toHaveText('Details')
})

test('search and outline tools fit a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page, '<h1>Guide</h1><h2>Alpha</h2><p>Alpha text</p><h2>Beta</h2><p>Beta text</p>')
  await search(page, 'text')
  await page.getByRole('checkbox', { name: 'Whole word' }).check()
  await page.locator('.search-previews summary').click()
  await page.locator('.search-preview-list button').first().click()
  await page.getByRole('button', { name: 'Close search' }).click()
  await page.getByRole('button', { name: 'Document outline', exact: true }).click()
  const outline = page.getByRole('complementary', { name: 'Document outline' })
  await outline.getByRole('button', { name: 'H2 Alpha', exact: true }).click()
  await outline.getByRole('button', { name: 'Move section down' }).click()
  await expect(body(page).locator('h2')).toHaveText(['Beta', 'Alpha'])
  const bounds = await outline.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391)
})

test('table captions survive Markdown and DOCX export and contents include all heading levels', async ({
  page,
}) => {
  await setup(
    page,
    '<h1>Guide</h1><h6>Deep detail</h6><table><caption>Quarterly prices</caption><tr><th>Price</th></tr><tr><td>10</td></tr></table><p>End</p>',
  )
  async function menu(name, item) {
    await page.locator('.native-menubar').getByRole('button', { name, exact: true }).click()
    await page.getByRole('menuitem', { name: item, exact: true }).click()
  }
  await menu('File', 'Export Markdown')
  await expect(page.getByRole('textbox', { name: 'Markdown text' })).toHaveValue(
    /<caption>Quarterly prices<\/caption>/,
  )
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await menu('File', 'Page layout and export')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download DOCX', exact: true }).click()
  const entries = unzipSync(new Uint8Array(await readFile(await (await downloading).path())))
  expect(strFromU8(entries['word/document.xml'])).toContain('Quarterly prices')
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await body(page).locator('p').last().click()
  await menu('Insert', 'Insert / update contents')
  await expect(body(page).locator('[data-studio-toc] a')).toHaveText(['Guide', 'Deep detail'])
  await expect(body(page).locator('[data-studio-toc] strong')).toHaveText('Contents')
})

test('review search filters comments while exported reports retain resolved and hidden discussions', async ({
  page,
}) => {
  await setup(page, '<p>Launch plan</p><p>Research plan</p>')
  for (const [index, message] of ['Confirm owners', 'Add sources'].entries()) {
    await body(page).locator('p').nth(index).selectText()
    await page
      .locator('.native-menubar')
      .getByRole('button', { name: 'Insert', exact: true })
      .click()
    await page.getByRole('menuitem', { name: 'Add comment', exact: true }).click()
    await page.getByRole('textbox', { name: 'New comment', exact: true }).fill(message)
    await page.getByRole('button', { name: 'Add comment', exact: true }).click()
    if (index === 0) await page.getByRole('button', { name: 'Close review panel' }).click()
  }
  await page.getByRole('textbox', { name: 'Search comments and suggestions' }).fill('owners')
  await expect(page.locator('.comment-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Resolved', exact: true }).click()
  await expect(page.locator('.comment-card')).toHaveCount(0)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download review report' }).click()
  const report = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  expect(report.comments).toHaveLength(2)
  expect(report.comments.find((item) => item.resolved).messages[0].text).toBe('Confirm owners')
  expect(report.comments.find((item) => !item.resolved).messages[0].text).toBe('Add sources')
})
