import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTsv, clipboardFragment, clipboardSource } from '../../src/editor/clipboard-text.js'

test('quoted TSV preserves tabs, newlines, quotes and empty trailing columns', () => {
  assert.deepEqual(parseTsv('"a\tb"\t"one\ntwo"\t\r\n"say ""hi"""\t0\t\r\n'), [
    ['a\tb', 'one\ntwo', ''],
    ['say "hi"', '0', ''],
  ])
})
test('ambiguous text and incomplete quoted rows stay text', () => {
  for (const value of ['hello', 'a\tb\nc', '"a\tb']) assert.equal(parseTsv(value), null)
})
test('TSV limits reject oversized dimensions and cell counts', () => {
  assert.throws(() => parseTsv('a\tb', { maxCells: 1 }))
  assert.throws(() => parseTsv('a\tb', { maxColumns: 1 }))
  assert.throws(() => parseTsv('a\tb\nc\td', { maxRows: 1 }))
})
test('HTML clipboard boundaries and source classification', () => {
  assert.equal(
    clipboardFragment('outside<!--StartFragment--><p>inside</p><!--EndFragment-->outside'),
    '<p>inside</p>',
  )
  assert.equal(clipboardSource('<p style="mso-list:l0 level1 lfo1">'), 'word')
  assert.equal(clipboardSource('<meta content="Microsoft Excel">'), 'excel')
  assert.equal(clipboardSource('<b id="docs-internal-guid-123">'), 'google-docs')
  assert.equal(clipboardSource('', 'a\tb'), 'tsv')
})
