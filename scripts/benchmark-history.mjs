import { performance } from 'node:perf_hooks'
import { writeFile } from 'node:fs/promises'
import { History } from '../src/editor/history.js'

const scenarios = {
  '1000 paragraphs': '<p>Örnek paragraf ve içerik.</p>'.repeat(1000),
  '10000 paragraphs': '<p>Örnek paragraf ve içerik.</p>'.repeat(10000),
  '100x20 table':
    '<table>' + ('<tr>' + '<td>Hücre</td>'.repeat(20) + '</tr>').repeat(100) + '</table>',
  '50 embedded image URLs': (
    '<p><img src="data:image/png;base64,' +
    'A'.repeat(40000) +
    '"></p>'
  ).repeat(50),
}
const results = []
for (const [name, html] of Object.entries(scenarios)) {
  const initial = html + '<p>0</p>'
  const blockIds = Array.from(
    {
      length: name.startsWith('10000')
        ? 10001
        : name.startsWith('1000')
          ? 1001
          : name.startsWith('50')
            ? 51
            : 2,
    },
    () => crypto.randomUUID(),
  )
  const history = new History({ html: initial, selection: null, blockIds })
  const durations = []
  for (let i = 1; i <= 79; i++) {
    const start = performance.now()
    history.commit({ html: html + `<p>${i}</p>`, selection: null, blockIds })
    durations.push(performance.now() - start)
  }
  durations.sort((a, b) => a - b)
  results.push({
    name,
    ...history.stats,
    snapshotReferenceBytes: initial.length * 2 * 80,
    commitP50Ms: +durations[39].toFixed(3),
    commitP95Ms: +durations[75].toFixed(3),
  })
}
const report = {
  node: process.version,
  platform: process.platform,
  scope:
    'Pure history commits; no DOM, layout, input-to-paint, actual heap or competing editor measurement. Snapshot reference is an uncapped 80-copy estimate; the previous implementation trimmed at 16 MiB.',
  results,
}
await writeFile(
  new URL('../docs/history-benchmark.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
)
console.log(JSON.stringify(report, null, 2))
