import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeContentCss } from '../../src/lib/content-css.js'
test('content CSS resolves relative URLs in order, trims and deduplicates', () => {
  assert.deepEqual(
    normalizeContentCss(' /theme.css\n./article.css\n/theme.css\n', 'https://site.test/admin/'),
    ['https://site.test/theme.css', 'https://site.test/admin/article.css'],
  )
  assert.deepEqual(normalizeContentCss([], 'https://site.test/'), [])
})
test('content CSS rejects dangerous schemes, credentials, controls and excessive input', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/css,body{}',
    'file:///private.css',
    'blob:https://site.test/1',
    'https://user:secret@site.test/x.css',
    'https://site.test/a\u0000.css',
  ]) {
    assert.throws(() => normalizeContentCss([value], 'https://site.test/'))
  }
  assert.throws(() => normalizeContentCss(Array(11).fill('/a.css'), 'https://site.test/'))
  assert.throws(() => normalizeContentCss([42], 'https://site.test/'))
  assert.throws(() => normalizeContentCss(['/a'.repeat(2048)], 'https://site.test/'))
})
