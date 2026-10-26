import test from 'node:test'
import assert from 'node:assert/strict'
import { pageAt, pageBox, pageBreaks } from '../../src/lib/page-layout.js'

test('page boxes follow paper size, orientation and bounded margins', () => {
  assert.deepEqual(pageBox({ size: 'A4', margin: 20 }), { width: 794, height: 1123, margin: 76 })
  const landscape = pageBox({ size: 'Letter', landscape: true, margin: 10 })
  assert.ok(landscape.width > landscape.height)
  assert.equal(pageBox({ margin: 500 }).margin, pageBox({ margin: 40 }).margin)
})

test('blocks move whole to the next page, tall blocks split and forced breaks start pages', () => {
  const blocks = [
    { top: 0, bottom: 400 },
    { top: 410, bottom: 700 },
    { top: 710, bottom: 1300 },
    { top: 1310, bottom: 1320, forced: true },
    { top: 1330, bottom: 3000 },
  ]
  // Page height 1000: block 3 (710–1300) moves to page 2 at 710; the forced break starts
  // page 3 at 1320; the tall last block is split every 1000px.
  assert.deepEqual(pageBreaks(blocks, 1000), [710, 1320, 2320])
  assert.equal(pageAt([710, 1320, 2320], 0), 1)
  assert.equal(pageAt([710, 1320, 2320], 800), 2)
  assert.equal(pageAt([710, 1320, 2320], 2500), 4)
  assert.deepEqual(pageBreaks([{ top: 0, bottom: 10 }], 0), [])
})
