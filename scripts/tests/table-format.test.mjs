import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validCellFormat } from '../../src/editor/table-format.js'

test('cell formatting validates the complete draft and rejects CSS injection or invalid limits', () => {
  assert.equal(
    validCellFormat({
      'background-color': '#dcfce7',
      color: '#123456',
      padding: 48,
      'vertical-align': 'middle',
      'text-align': 'center',
      border: { mode: 'outer', color: '#123456', style: 'solid', width: 8 },
    }),
    true,
  )
  for (const patch of [
    null,
    { color: 'url(https://example.com)' },
    { color: '#fff;display:none' },
    { padding: -1 },
    { padding: 49 },
    { padding: 1.5 },
    { padding: NaN },
    { padding: '2' },
    { 'text-align': 'bad' },
    { reset: false },
    { position: 'fixed' },
    { border: null },
    { border: { mode: 'outer', color: '#ffffff', style: 'solid', width: 9 } },
    { color: '#ffffff', 'background-color': 'var(--host-color)' },
  ])
    assert.equal(validCellFormat(patch), false)
  assert.equal(validCellFormat({ reset: true, 'background-color': 'transparent' }), true)
})
