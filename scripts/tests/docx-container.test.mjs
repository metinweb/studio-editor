import test from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { validateDocxArchive } from '../../src/lib/docx-container.js'
const archive = () => zipSync({ 'word/document.xml': strToU8('<document/>') })
const buffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
test('DOCX archive preflight accepts a document and rejects non-DOCX or truncated archives', () => {
  const bytes = archive()
  assert.doesNotThrow(() => validateDocxArchive(buffer(bytes)))
  assert.throws(() => validateDocxArchive(new ArrayBuffer(8)))
  assert.throws(() => validateDocxArchive(buffer(bytes.slice(0, -4))))
  assert.throws(() => validateDocxArchive(buffer(zipSync({ 'file.txt': strToU8('not Word') }))))
})
test('DOCX archive preflight rejects encryption, excessive expansion and entry counts before parsing XML', () => {
  for (const change of ['encrypted', 'expanded', 'count']) {
    const bytes = archive(),
      view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const end = bytes.length - 22,
      central = view.getUint32(end + 16, true)
    if (change === 'encrypted') view.setUint16(central + 8, 1, true)
    if (change === 'expanded') view.setUint32(central + 24, 100 * 1024 * 1024, true)
    if (change === 'count') view.setUint16(end + 10, 1001, true)
    assert.throws(() => validateDocxArchive(buffer(bytes)), change)
  }
})
