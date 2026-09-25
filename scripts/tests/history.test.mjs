import { test } from 'node:test'
import assert from 'node:assert/strict'
import { History } from '../../src/editor/history.js'
import {
  applyTextStep,
  diffText,
  mapOffset,
  mapSelection,
  selectionMap,
} from '../../src/editor/operations.js'

const snap = (html, offset = 0) => ({ html, selection: { offset }, blockIds: ['first'] })
test('patches round trip Unicode and reject mismatched bases', () => {
  for (const [before, after] of [
    ['', '<p>İstanbul 🧑‍💻</p>'],
    ['🧑', '👩'],
    ['abc', 'axbc'],
    ['abcdef', 'abef'],
    ['same', 'same'],
  ]) {
    const step = diffText(before, after)
    assert.equal(applyTextStep(before, step), after)
    assert.equal(applyTextStep(after, step, true), before)
  }
  assert.throws(() => applyTextStep('wrong', { from: 1, removed: 'x', inserted: 'y' }))
})
test('grouped typing, checkpoint selection, undo, redo and branching', () => {
  const history = new History(snap('a'))
  history.commit(snap('ab', 1), snap('a'), 'insertText')
  history.commit(snap('abc', 2), snap('ab', 1), 'insertText')
  assert.equal(history.stats.undo, 1)
  assert.equal(history.move(-1).html, 'a')
  assert.deepEqual(history.move(1), snap('abc', 2))
  history.checkpoint(snap('abc', 7))
  history.commit(snap('abcd', 8), snap('abc', 7))
  assert.equal(history.move(-1).selection.offset, 7)
  history.commit(snap('abc!', 8), snap('abc', 7))
  assert.equal(history.canRedo, false)
  assert.equal(history.move(-1).html, 'abc')
})
test('unchanged embedded media is stored once, with bounded history', () => {
  const image = `<img src="data:image/png;base64,${'A'.repeat(2_000_000)}">`
  const history = new History(snap(image + '<p>0</p>'))
  for (let i = 1; i <= 100; i++) history.commit(snap(image + `<p>${i}</p>`, i))
  assert.equal(history.stats.undo, 79)
  assert.ok(history.stats.patchBytes < 100_000)
  for (let i = 99; i >= 21; i--) assert.equal(history.move(-1).html, image + `<p>${i}</p>`)
  assert.equal(history.canUndo, false)
  for (let i = 22; i <= 100; i++) assert.equal(history.move(1).html, image + `<p>${i}</p>`)
})
test('budget trimming keeps at least one undo and accurate incremental accounting', () => {
  const history = new History(snap('a'), { maxBytes: 1000 })
  history.commit(snap('b'.repeat(2000)))
  assert.equal(history.stats.undo, 1)
  assert.equal(history.move(-1).html, 'a')
  history.commit(snap('c'))
  assert.equal(history.stats.patchBytes, JSON.stringify(history.entries[0]).length * 2)
  assert.equal(history.move(-1).html, 'a')
})
test('block identities are stored as structural changes, not full arrays per edit', () => {
  const ids = Array.from({ length: 10000 }, (_, i) => `block-${i}`)
  const initial = { ...snap('a'), blockIds: ids }
  const history = new History(initial)
  for (let i = 1; i <= 79; i++) history.commit({ ...snap(`a${i}`), blockIds: [...ids] })
  assert.equal(history.stats.undo, 79)
  assert.ok(history.stats.patchBytes < 100000)
  const changed = [...ids.slice(0, 4), 'inserted', ...ids.slice(4)]
  history.commit({ ...snap('new block'), blockIds: changed })
  assert.deepEqual(history.move(-1).blockIds, ids)
  assert.deepEqual(history.move(1).blockIds, changed)
})
test('stable selection mapping handles insertion, deletion and removed blocks', () => {
  const mapping = selectionMap([{ id: 'a', text: 'abc' }], [{ id: 'a', text: 'aXYZbc' }])
  const position = {
    startAnchor: { id: 'a', textOffset: 2 },
    endAnchor: { id: 'a', textOffset: 3 },
  }
  assert.equal(mapSelection(position, mapping).startAnchor.textOffset, 5)
  assert.equal(position.startAnchor.textOffset, 2)
  assert.equal(mapOffset(1, { from: 1, deleted: 0, inserted: 3 }, -1), 1)
  assert.equal(mapSelection(position, [{ blockId: 'a', deleted: true }]), null)
})
