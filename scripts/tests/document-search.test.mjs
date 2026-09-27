import { test } from 'node:test'
import assert from 'node:assert/strict'
import { textMatches } from '../../src/editor/document-search.js'

test('search follows locale and keeps original Unicode grapheme offsets', () => {
  assert.deepEqual(textMatches('TITLE title', 'title', { locale: 'en' }), [
    { start: 0, end: 5 },
    { start: 6, end: 11 },
  ])
  assert.deepEqual(textMatches('I ı İ i', 'i', { locale: 'tr' }), [
    { start: 4, end: 5 },
    { start: 6, end: 7 },
  ])
  const text = '😀 cafe\u0301 CAFÉ cafe'
  const matches = textMatches(text, 'cafe', { ignoreAccents: true })
  assert.deepEqual(
    matches.map((m) => text.slice(m.start, m.end)),
    ['cafe\u0301', 'CAFÉ', 'cafe'],
  )
  assert.equal(textMatches('İ', 'i').length, 0)
  assert.equal(textMatches('İ', 'i', { ignoreAccents: true }).length, 1)
})
test('whole words, literal metacharacters and bounded results', () => {
  assert.equal(
    textMatches('cat scatter cat2 cat_cat (cat) 猫cat', 'cat', { wholeWord: true }).length,
    2,
  )
  assert.equal(textMatches('a+b aab', 'a+b').length, 1)
  assert.equal(textMatches('Alpha alpha', 'alpha', { sensitive: true }).length, 1)
  assert.equal(textMatches('x'.repeat(20001), 'x').length, 10000)
  assert.deepEqual(textMatches('text', ''), [])
  assert.deepEqual(textMatches('text', 'x'.repeat(2001)), [])
})
