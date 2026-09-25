import { chromium, firefox, webkit } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import os from 'node:os'

const results = []
for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await type.launch()
  try {
    for (const fixture of ['10000 paragraphs', '100x20 table']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
      await page.goto('http://127.0.0.1:4173/')
      const body = page.frameLocator('.studio-editor-frame').locator('body')
      await page.getByRole('button', { name: 'Kaynak kodu', exact: true }).click()
      const html = fixture.includes('paragraphs')
        ? '<p>Örnek paragraf metni.</p>'.repeat(10000)
        : '<table><tbody>' +
          ('<tr>' + '<td>Hücre metni.</td>'.repeat(20) + '</tr>').repeat(100) +
          '</tbody></table>'
      await page.getByRole('textbox', { name: 'HTML kaynak kodu' }).fill(html)
      await page.getByRole('button', { name: 'Değişiklikleri uygula' }).click()
      await body.evaluate((root) => {
        const win = root.ownerDocument.defaultView
        win.probe = { input: [], selection: [], rects: 0 }
        const rect = win.Element.prototype.getBoundingClientRect
        win.Element.prototype.getBoundingClientRect = function () {
          if (this.matches('td,th')) win.probe.rects++
          return rect.call(this)
        }
        const painted = () =>
          new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        root.addEventListener(
          'beforeinput',
          () => {
            win.probe.start = performance.now()
          },
          true,
        )
        root.addEventListener('input', async () => {
          const start = win.probe.start
          await painted()
          win.probe.input.push(performance.now() - start)
        })
        win.probe.select = async (index) => {
          const target = root.querySelector('table')
            ? root.querySelectorAll('td')[1999 - index]
            : root.children[9999 - index]
          const start = performance.now()
          root.focus()
          target.scrollIntoView({ block: 'center' })
          const range = root.ownerDocument.createRange()
          range.setStart(target.firstChild, 1)
          range.setEnd(target.firstChild, 4)
          const selection = root.ownerDocument.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
          await painted()
          win.probe.selection.push(performance.now() - start)
        }
      })
      for (let i = 0; i < 12; i++)
        await body.evaluate((root, i) => root.ownerDocument.defaultView.probe.select(i), i)
      for (let i = 0; i < 15; i++) {
        await page.keyboard.insertText('x')
        await body.evaluate(
          (root, count) =>
            new Promise((resolve) => {
              const check = () =>
                root.ownerDocument.defaultView.probe.input.length >= count
                  ? resolve()
                  : setTimeout(check, 5)
              check()
            }),
          i + 1,
        )
      }
      const values = await body.evaluate((root) => ({
        ...root.ownerDocument.defaultView.probe,
        select: undefined,
      }))
      const summary = (list) => {
        const sorted = list.slice(3).sort((a, b) => a - b)
        return {
          p50: sorted[Math.floor(sorted.length / 2)],
          p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
        }
      }
      results.push({
        browser: name,
        version: browser.version(),
        fixture,
        inputMs: summary(values.input),
        selectionMs: summary(values.selection),
        cellRectReads: values.rects,
      })
      console.log(JSON.stringify(results.at(-1)))
      await page.close()
    }
  } finally {
    await browser.close()
  }
}
const report = {
  date: new Date().toISOString(),
  cpu: os.cpus()[0]?.model,
  node: process.version,
  scope:
    'Production workspace at 4173 including autosave and counters. Input beforeinput to two animation frames, 3 warmups + 12 samples. Programmatic selection near document end, 3 warmups + 9 samples. Cell rect count covers all sampled selections and input. Headless desktop; not physical display latency or a competitor comparison.',
  results,
}
await writeFile(
  `docs/workspace-performance-${process.argv.includes('--baseline') ? 'before' : process.argv.includes('--final') ? 'beta10' : 'after'}.json`,
  JSON.stringify(report, null, 2) + '\n',
)
