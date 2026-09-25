import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSharedDocument } from '../../src/editor/shared-document.js'
const initial = {
  schemaVersion: 2,
  revision: 0,
  blocks: [
    {
      id: 'p1',
      node: { type: 'element', tag: 'p', attrs: {}, children: [{ type: 'text', text: 'Merhaba' }] },
    },
  ],
}
test('two offline clients merge concurrent text and local undo preserves remote edits', () => {
  const seed = createSharedDocument({ initial }),
    a = createSharedDocument({ update: seed.encode() }),
    b = createSharedDocument({ update: seed.encode() })
  try {
    const am = a.getModel(),
      bm = b.getModel()
    am.blocks[0].node.children[0].text = 'A Merhaba'
    bm.blocks[0].node.children[0].text = 'Merhaba B'
    a.setModel(am)
    b.setModel(bm)
    const au = a.encode(),
      bu = b.encode()
    a.applyUpdate(bu)
    b.applyUpdate(au)
    assert.deepEqual(a.getModel(), b.getModel())
    assert.equal(a.getModel().blocks[0].node.children[0].text, 'A Merhaba B')
    a.undo()
    b.applyUpdate(a.encode())
    assert.equal(a.getModel().blocks[0].node.children[0].text, 'Merhaba B')
    assert.deepEqual(a.getModel(), b.getModel())
    a.redo()
    assert.equal(a.getModel().blocks[0].node.children[0].text, 'A Merhaba B')
  } finally {
    seed.destroy()
    a.destroy()
    b.destroy()
  }
})
test('shared state reloads from binary persistence and rejects malformed updates atomically', () => {
  const a = createSharedDocument({ initial }),
    b = createSharedDocument({ update: a.encode() })
  try {
    assert.deepEqual(a.getModel(), b.getModel())
    assert.throws(() => b.applyUpdate(new Uint8Array([1, 2, 3])))
    assert.deepEqual(a.getModel(), b.getModel())
  } finally {
    a.destroy()
    b.destroy()
  }
})
