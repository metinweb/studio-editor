import test from 'node:test'
import assert from 'node:assert/strict'
import {
  newUiElement,
  normalizeUiElement,
  uiElementHtml,
  uiUrl,
  uiFieldTypes,
} from '../../src/lib/ui-elements.js'

test('form definitions bound fields and reject duplicate names, bad endpoints and invalid options', () => {
  const original = newUiElement('form')
  const change = (patch) => ({ ...structuredClone(original), ...patch })
  for (const action of [
    'javascript:alert(1)',
    'data:text/html,test',
    '//example.com',
    '/\\example.com',
    'https://user:secret@example.com',
    '/api\ncontact',
  ])
    assert.throws(() => normalizeUiElement(change({ action })))
  assert.equal(uiUrl('/api/contact'), '/api/contact')
  assert.throws(() =>
    normalizeUiElement(change({ fields: [original.fields[0], original.fields[0]] })),
  )
  assert.throws(() => normalizeUiElement(change({ fields: [] })))
  assert.throws(() => normalizeUiElement(change({ fields: Array(41).fill(original.fields[0]) })))
  for (const options of [[], [''], ['one', 'one'], Array(31).fill('x')])
    assert.throws(() =>
      normalizeUiElement(
        change({ fields: [{ type: 'select', name: 'choice', label: 'Choice', options }] }),
      ),
    )
})
test('all form field types generate named native controls; editor and portable output cannot submit', () => {
  const form = newUiElement('form')
  form.action = '/contact'
  form.fields = uiFieldTypes.map((type) => ({
    type,
    name: `field_${type}`,
    label: type,
    required: true,
    options: ['Yes', 'No'],
    min: 0,
    max: 10,
    step: 1,
  }))
  const html = uiElementHtml(form, 'public')
  for (const type of uiFieldTypes) assert.match(html, new RegExp(`name="field_${type}"`))
  assert.match(html, /method="post"/)
  assert.doesNotMatch(uiElementHtml(form), /<(?:form|input|select|textarea|button)\b/)
  assert.doesNotMatch(uiElementHtml(form, 'editor'), /<(?:form|input|select|textarea|button)\b/)
  form.action = ''
  assert.match(uiElementHtml(form, 'public'), /<fieldset disabled/)
})
test('unsafe content is escaped and only canonical attributes and styles are generated', () => {
  const form = newUiElement('form')
  form.title = '<script>alert(1)</script>'
  form.accent = 'red; background:url(https://evil.example)'
  form.fields[0].label = '"><img onerror=alert(1)>'
  const html = uiElementHtml(form, 'public')
  assert.doesNotMatch(html, /<script|<img|background:url/)
  assert.match(html, /&lt;script&gt;/)
  assert.equal(normalizeUiElement(form).accent, '#2563eb')
  for (const type of ['file', 'password', 'hidden', 'submit'])
    assert.throws(() => normalizeUiElement({ ...form, fields: [{ type, name: 'x', label: 'x' }] }))
})
test('slider links/images reject executable URLs, require alt and allow only bounded settings', () => {
  const slider = newUiElement('slider')
  slider.items[0].image = 'https://example.com/image.jpg'
  assert.throws(() => normalizeUiElement(slider), /alternative/)
  slider.items[0].alt = 'Landscape'
  slider.items[0].link = 'javascript:alert(1)'
  assert.throws(() => normalizeUiElement(slider), /HTTPS/)
  slider.items[0].link = '/products'
  slider.cards = 999
  slider.ratio = 'url(x)'
  const normalized = normalizeUiElement(slider)
  assert.equal(normalized.cards, 1)
  assert.equal(normalized.ratio, '16/9')
  assert.match(uiElementHtml(normalized, 'public'), /scroll-snap-type:x mandatory/)
  assert.doesNotMatch(uiElementHtml(normalized, 'public'), /<script/)
})
test('range constraints and accordion text are canonical and versioned', () => {
  const form = newUiElement('form')
  form.fields = [{ type: 'range', label: 'Budget', name: 'budget', min: 100, max: 10 }]
  assert.throws(() => normalizeUiElement(form))
  const accordion = newUiElement('accordion', 'tr')
  assert.match(uiElementHtml(accordion, 'public'), /<details open/)
  assert.doesNotMatch(uiElementHtml(accordion), /<details/)
  assert.throws(() => normalizeUiElement({ ...accordion, version: 2 }))
})
