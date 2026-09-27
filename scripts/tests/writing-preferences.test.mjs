import test from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultWritingPreferences,
  normalizeWritingPreferences,
  normalizePen,
} from '../../src/lib/writing-preferences.js'
test('writing rules enforce bounded unique literal shortcuts without changing defaults', () => {
  const prefs = normalizeWritingPreferences({
    enabled: true,
    smartSymbols: 'yes',
    rules: [
      { from: ';sig', to: '<img src=x>\nSignature' },
      { from: ';sig', to: 'Duplicate' },
      { from: 'two words', to: 'No' },
      { from: 'x', to: 'a'.repeat(1001) },
    ],
  })
  assert.deepEqual(prefs, {
    enabled: true,
    smartSymbols: false,
    rules: [{ from: ';sig', to: '<img src=x>\nSignature' }],
  })
  const first = defaultWritingPreferences()
  first.rules.pop()
  assert.equal(defaultWritingPreferences().rules.length, 5)
  assert.equal(
    normalizeWritingPreferences({
      rules: Array.from({ length: 150 }, (_, i) => ({ from: `r${i}`, to: 'value' })),
    }).rules.length,
    100,
  )
})
test('pen options accept only bounded CSS values and explicit booleans', () => {
  const pen = normalizePen({
    enabled: true,
    color: 'url(https://example.com)',
    backgroundColor: '#aabbcc',
    fontSize: Infinity,
    bold: 'true',
  })
  assert.equal(pen.color, '#2563eb')
  assert.equal(pen.backgroundColor, '#aabbcc')
  assert.equal(pen.fontSize, 200)
  assert.equal(pen.bold, false)
})
