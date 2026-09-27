import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyModelOperations,
  renderModel,
  validateModel,
} from '../../src/editor/document-model.js'
const fixture = () => ({
  schemaVersion: 2,
  revision: 4,
  blocks: [
    {
      id: 'a',
      node: {
        type: 'element',
        tag: 'p',
        attrs: {},
        children: [{ type: 'text', text: 'Merhaba dünya' }],
      },
    },
    {
      id: 'b',
      node: { type: 'element', tag: 'p', attrs: {}, children: [{ type: 'text', text: 'Son' }] },
    },
  ],
})

test('styled reversed lists round trip through the JSON schema and attribute operations', () => {
  const model = fixture()
  model.blocks[0].node = {
    type: 'element',
    tag: 'ol',
    attrs: { start: '0', reversed: '', style: 'list-style-type:upper-roman', dir: 'rtl' },
    children: [
      { type: 'element', tag: 'li', attrs: {}, children: [{ type: 'text', text: 'Item' }] },
    ],
  }
  assert.equal(validateModel(model), model)
  assert.match(
    renderModel(model),
    /<ol start="0" reversed="" style="list-style-type:upper-roman" dir="rtl">/,
  )
  const next = applyModelOperations(model, {
    baseRevision: 4,
    operations: [
      { type: 'setAttributes', blockId: 'a', path: [], attrs: { start: '5', reversed: '' } },
    ],
  })
  assert.match(renderModel(next), /start="5" reversed=""/)
})
test('semantic text, move, attribute and block operations are immutable and revision checked', () => {
  const model = fixture()
  const next = applyModelOperations(model, {
    baseRevision: 4,
    operations: [
      {
        type: 'replaceText',
        blockId: 'a',
        path: [0],
        from: 8,
        removed: 'dünya',
        inserted: 'Studio',
      },
      { type: 'setAttributes', blockId: 'a', path: [], attrs: { dir: 'rtl' } },
      { type: 'moveBlock', blockId: 'a', index: 1 },
    ],
  })
  assert.equal(next.revision, 5)
  assert.equal(renderModel(next), '<p>Son</p><p dir="rtl">Merhaba Studio</p>')
  assert.equal(model.blocks[0].node.children[0].text, 'Merhaba dünya')
  assert.throws(() => applyModelOperations(next, { baseRevision: 4, operations: [] }))
  const removed = applyModelOperations(next, {
    baseRevision: 5,
    operations: [{ type: 'removeBlock', blockId: 'b' }],
  })
  assert.equal(removed.blocks.length, 1)
})
test('invalid later operation rolls back the entire pure transaction', () => {
  const model = fixture(),
    original = JSON.stringify(model)
  assert.throws(() =>
    applyModelOperations(model, {
      baseRevision: 4,
      operations: [
        { type: 'removeBlock', blockId: 'a' },
        { type: 'removeBlock', blockId: 'missing' },
      ],
    }),
  )
  assert.equal(JSON.stringify(model), original)
})
test('schema bounds, duplicate IDs and executable markup are rejected', () => {
  const model = fixture()
  model.blocks.push(model.blocks[0])
  assert.throws(() => validateModel(model))
  for (const attrs of [
    { onclick: 'alert(1)' },
    { href: 'java\nscript:alert(1)' },
    { src: 'data:image/svg+xml,<svg/>' },
    { style: 'background:url(https://example.com)' },
  ]) {
    const value = fixture()
    value.blocks[0].node.attrs = attrs
    assert.throws(() => renderModel(value))
  }
  const value = fixture()
  value.blocks[0].node.children[0].text = '<script>&"'
  assert.ok(renderModel(value).includes('&lt;script&gt;&amp;&quot;'))
})
