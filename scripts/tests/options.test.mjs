import { test } from 'node:test'
import assert from 'node:assert/strict'
import { includesOption } from '../../src/lib/editor-options.js'
import { translateMessage } from '../../src/lib/locales.js'

test('localized placeholders preserve user text and ignore inherited values', () => {
  assert.equal(
    translateMessage('en', null, '{tag} etiketini kaldır', { tag: 'İş <b>' }),
    'Remove tag İş <b>',
  )
  assert.equal(translateMessage('tr', null, '{count} etiket', { count: 3 }), '3 etiket')
  assert.equal(
    translateMessage('en', null, '{count} etiket', Object.create({ count: 3 })),
    '{count} tags',
  )
})

test('editor options distinguish defaults, hidden UI and an empty selection', () => {
  assert.equal(includesOption(undefined, 'format'), true)
  assert.equal(includesOption(false, 'format'), false)
  assert.equal(includesOption([], 'format'), false)
  assert.equal(includesOption(['history'], 'format'), false)
  assert.equal(includesOption(['format'], 'format'), true)
})
test('locale fallback and instance messages are deterministic and ignore inherited overrides', () => {
  assert.equal(translateMessage('en', {}, 'Kalın'), 'Bold')
  assert.equal(translateMessage('tr', {}, 'Kalın'), 'Kalın')
  assert.equal(translateMessage('unknown', {}, 'Kalın'), 'Kalın')
  assert.equal(translateMessage('en', { Kalın: 'Strong' }, 'Kalın'), 'Strong')
  assert.equal(translateMessage('en', { Kalın: '' }, 'Kalın'), '')
  assert.equal(translateMessage('en', Object.create({ Kalın: 'Inherited' }), 'Kalın'), 'Bold')
  assert.equal(translateMessage('en', {}, 'Custom message'), 'Custom message')
})
