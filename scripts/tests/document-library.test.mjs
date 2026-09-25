import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDocumentFilter, normalizeTags } from '../../src/lib/document-library.js'

test('English search folds ASCII I correctly and invalidates cached text when the locale changes', () => {
  const filter = createDocumentFilter((text) => text)
  const documents = [{ id: '1', title: 'Notes', content: 'IDEAS', tags: [] }]
  assert.equal(filter(documents, { query: 'ideas', locale: 'en' }).length, 1)
  assert.equal(filter(documents, { query: 'ideas', locale: 'tr' }).length, 0)
  assert.equal(filter(documents, { query: 'ideas', locale: 'en' }).length, 1)
})

test('Turkish search combines title, content, tags and filters without mutating documents', () => {
  const documents = [
    {
      id: '1',
      title: 'İzmir 10',
      content: 'Yazı içeriği',
      tags: ['İŞ'],
      favorite: true,
      updatedAt: 20,
    },
    { id: '2', title: 'İzmir 2', content: 'Başka yazı', tags: ['Kişisel'], updatedAt: 10 },
    { id: '3', title: 'Ankara', content: 'İçerik', updatedAt: 30 },
  ]
  const filter = createDocumentFilter((text) => text)
  assert.deepEqual(
    filter(documents, { query: 'izmir İÇERİĞİ iş', favorite: true, tag: 'iş' }).map((d) => d.id),
    ['1'],
  )
  assert.deepEqual(
    filter(documents, { query: 'yazı', tag: 'kişisel' }).map((d) => d.id),
    ['2'],
  )
  assert.deepEqual(
    filter(documents, { sort: 'title' }).map((d) => d.id),
    ['3', '2', '1'],
  )
  assert.deepEqual(
    filter(documents, { sort: 'title-desc' }).map((d) => d.id),
    ['1', '2', '3'],
  )
  assert.deepEqual(
    filter(documents).map((d) => d.id),
    ['3', '1', '2'],
  )
  assert.deepEqual(
    filter(documents, { sort: 'oldest' }).map((d) => d.id),
    ['2', '1', '3'],
  )
  assert.deepEqual(
    documents.map((d) => d.id),
    ['1', '2', '3'],
  )
})

test('search caches parsed content but reflects live edits and avoids parsing without a query', () => {
  let parses = 0
  const filter = createDocumentFilter((text) => {
    parses++
    return text
  })
  const documents = [{ id: 'a', title: 'Başlık', content: 'ilk' }]
  filter(documents)
  filter(documents, { query: 'başlık' })
  assert.equal(parses, 0)
  assert.equal(filter(documents, { query: 'ilk' }).length, 1)
  filter(documents, { query: 'başka' })
  assert.equal(parses, 1)
  documents[0].content = 'son'
  assert.equal(filter(documents, { query: 'ilk' }).length, 0)
  assert.equal(filter(documents, { query: 'son' }).length, 1)
  assert.equal(parses, 2)
})

test('tags normalize Unicode, Turkish case and whitespace, with bounded metadata', () => {
  assert.deepEqual(normalizeTags([' İŞ ', 'iş', 'IŞIK', 'ışık', 'iki   kelime', '', null]), [
    'İŞ',
    'IŞIK',
    'iki kelime',
  ])
  assert.equal(normalizeTags(Array.from({ length: 20 }, (_, i) => `${i}`)).length, 10)
  assert.equal(normalizeTags(['a'.repeat(50)])[0].length, 32)
  assert.deepEqual(normalizeTags(undefined), [])
})
