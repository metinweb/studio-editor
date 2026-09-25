import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4175', '--strictPort'],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
)
let log = ''
server.stdout.on('data', (data) => {
  log += data
})
server.stderr.on('data', (data) => {
  log += data
})
let browser
try {
  for (let attempt = 0; ; attempt++) {
    if (server.exitCode !== null) throw Error(log)
    try {
      if ((await fetch('http://127.0.0.1:4175/benchmarks/')).ok) break
    } catch {}
    if (attempt > 100) throw Error('Benchmark preview did not start: ' + log)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  browser = await chromium.launch()
  const results = []
  for (const name of ['1000 paragraphs', '10000 paragraphs', '100x20 table', '50 images']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto('http://127.0.0.1:4175/benchmarks/')
    await page.waitForFunction(() => window.benchmark?.ready)
    const html = await page.evaluate((name) => {
      if (name.endsWith('paragraphs'))
        return '<p>Örnek paragraf ve içerik.</p>'.repeat(parseInt(name)) + '<p>Son</p>'
      if (name.includes('table'))
        return (
          '<table>' +
          ('<tr>' + '<td>Hücre</td>'.repeat(20) + '</tr>').repeat(100) +
          '</table><p>Son</p>'
        )
      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 180
      const ctx = canvas.getContext('2d')
      const pixels = ctx.createImageData(320, 180)
      let seed = 42
      for (let i = 0; i < pixels.data.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0
        pixels.data[i] = i % 4 === 3 ? 255 : seed >>> 24
      }
      ctx.putImageData(pixels, 0, 0)
      return (
        `<p><img src="${canvas.toDataURL('image/jpeg', 0.75)}" width="320" height="180"></p>`.repeat(
          50,
        ) + '<p>Son</p>'
      )
    }, name)
    const loadMs = await page.evaluate((html) => benchmark.load(html), html)
    const selectionMs = []
    for (let i = 0; i < 10; i++) selectionMs.push(await page.evaluate(() => benchmark.select()))
    for (let i = 0; i < 23; i++) {
      await page.keyboard.insertText('x')
      await page.waitForFunction((count) => benchmark.samples.length >= count, i + 1)
    }
    const samples = (await page.evaluate(() => benchmark.samples)).slice(3)
    const undoMs = await page.evaluate(() => benchmark.undo())
    const session = await page.context().newCDPSession(page)
    await session.send('HeapProfiler.collectGarbage')
    const heap = await session.send('Runtime.getHeapUsage')
    const summary = (values) => {
      const sorted = [...values].sort((a, b) => a - b)
      return {
        p50: +sorted[Math.floor(sorted.length * 0.5)].toFixed(2),
        p95: +sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(2),
      }
    }
    results.push({
      name,
      htmlBytes: html.length * 2,
      loadMs: +loadMs.toFixed(2),
      inputToPaintOpportunityMs: summary(samples),
      selectionToPaintOpportunityMs: summary(selectionMs),
      undoMs: +undoMs.toFixed(2),
      usedHeapBytes: heap.usedSize,
      history: await page.evaluate(() => benchmark.stats()),
    })
    console.log(JSON.stringify(results.at(-1)))
    await page.close()
  }
  const report = {
    date: new Date().toISOString(),
    browser: browser.version(),
    node: process.version,
    platform: process.platform,
    cpu: os.cpus()[0]?.model,
    scope:
      'Built Vue library in a local Vite harness, headless Chromium, 1280x900. No workspace autosave/counting. Input: beforeinput through two animation frames (paint opportunity, not physical display latency), 3 warmups + 20 samples. Selection: programmatic caret + 2 frames, 10 samples. Open and undo: one sample. Heap: CDP Runtime.getHeapUsage after GC, whole page/runtime; not process RAM. Not a competitor comparison.',
    results,
  }
  const output = process.argv.includes('--baseline')
    ? 'browser-benchmark-baseline.json'
    : 'browser-benchmark.json'
  await writeFile(path.join(root, 'docs', output), JSON.stringify(report, null, 2) + '\n')
} finally {
  await browser?.close()
  server.kill()
}
