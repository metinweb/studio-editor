import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeArchive, decodeArchive, validateArchive } from '../../src/lib/archive-format.js'
const data = () => ({
  documents: [
    {
      id: 'a',
      title: 'Başlık',
      content: '<p data-studio-thread="yorum">Merhaba</p>',
      updatedAt: 1,
    },
  ],
  media: [],
  templates: [],
  versions: [
    {
      id: 'v',
      documentId: 'a',
      title: 'Başlık',
      content: '<p>Önce</p>',
      createdAt: 1,
      reason: 'Elle',
    },
  ],
})
test('archive round trip retains comments and history', async () => {
  const input = data()
  assert.deepEqual(await decodeArchive(await encodeArchive(input)), input)
})

test('document organization is optional for old archives and validated for new archives', async () => {
  const input = data()
  input.documents[0].favorite = true
  input.documents[0].tags = ['İş', 'Toplantı']
  assert.deepEqual(await decodeArchive(await encodeArchive(input)), input)
  for (const patch of [
    { favorite: 'true' },
    { tags: 'iş' },
    { tags: [' '] },
    { tags: [1] },
    { tags: ['a'.repeat(33)] },
    { tags: Array(11).fill('iş') },
  ]) {
    const invalid = data()
    Object.assign(invalid.documents[0], patch)
    assert.throws(() => validateArchive(invalid))
  }
})
test('corruption, unknown schema and invalid references are rejected', async () => {
  const encoded = await encodeArchive(data())
  await assert.rejects(decodeArchive(encoded.replace('Merhaba', 'Bozuldu')))
  await assert.rejects(decodeArchive(encoded.replace('"schemaVersion":1', '"schemaVersion":2')))
  const invalid = data()
  invalid.versions[0].documentId = 'missing'
  assert.throws(() => validateArchive(invalid))
  const duplicate = data()
  duplicate.documents.push(duplicate.documents[0])
  assert.throws(() => validateArchive(duplicate))
})
test('media rejects executable types, malformed bytes and false size', () => {
  const item = {
    id: 'm',
    name: 'photo',
    type: 'image/png',
    size: 3,
    dataUrl: 'data:image/png;base64,YWJj',
    alt: '',
    createdAt: 1,
  }
  const input = data()
  input.media.push(item)
  assert.doesNotThrow(() => validateArchive(input))
  item.size = 5
  assert.throws(() => validateArchive(input))
  item.size = 3
  item.type = 'image/svg+xml'
  assert.throws(() => validateArchive(input))
})
