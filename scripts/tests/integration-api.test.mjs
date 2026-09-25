import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCommandRegistry } from '../../src/lib/command-registry.js'
import { createDocumentSession } from '../../src/lib/document-storage.js'
test('plugins are namespaced, validated atomically and disabled/disposed safely', () => {
  let writable = true,
    calls = 0
  const registry = createCommandRegistry({}, () => writable)
  const remove = registry.register({
    id: 'demo',
    commands: [
      {
        id: 'run',
        title: 'Run',
        execute() {
          calls++
        },
      },
    ],
  })
  assert.equal(registry.execute('demo/run'), true)
  assert.equal(calls, 1)
  writable = false
  assert.equal(registry.execute('demo/run'), false)
  assert.equal(registry.list()[0].enabled, false)
  writable = true
  remove()
  assert.equal(registry.execute('demo/run'), false)
  assert.throws(() =>
    registry.register({
      id: 'bad',
      commands: [
        { id: 'ok', title: 'OK', execute() {} },
        { id: 'invalid id', title: 'Bad', execute() {} },
      ],
    }),
  )
  assert.equal(registry.list().length, 0)
  registry.dispose()
  assert.throws(() => registry.register({ id: 'late', commands: [] }))
})
test('document session retains edits made during save and leaves conflicts dirty', async () => {
  let finish
  const adapter = {
    load: async () => ({ id: 'a', title: 'A', html: 'one', blockIds: [], version: '1' }),
    save: async (value, { expectedVersion }) => {
      assert.equal(expectedVersion, '1')
      await new Promise((r) => (finish = r))
      return { ...value, version: '2' }
    },
  }
  const session = createDocumentSession(adapter)
  await session.load('a')
  session.update({ html: 'two' })
  const saving = session.save()
  await Promise.resolve()
  session.update({ html: 'three' })
  finish()
  await saving
  assert.equal(session.record.html, 'three')
  assert.equal(session.record.version, '2')
  assert.equal(session.dirty, true)
  adapter.save = async () => {
    throw new Error('Conflict')
  }
  await assert.rejects(session.save(), /Conflict/)
  assert.equal(session.record.html, 'three')
  assert.equal(session.dirty, true)
  await assert.rejects(session.load('b'), /Kaydedilmemiş/)
  session.dispose()
})

test('a delayed document load cannot overwrite edits made while switching documents', async () => {
  let finish
  const first = { id: 'a', title: 'A', html: 'one', blockIds: [], version: '1' }
  const session = createDocumentSession({
    load: (id) =>
      id === 'a'
        ? Promise.resolve(first)
        : new Promise((resolve) => (finish = () => resolve({ ...first, id }))),
    save: async (record) => ({ ...record, version: '2' }),
  })
  await session.load('a')
  const loading = session.load('b')
  session.update({ html: 'Keep this draft' })
  await session.save()
  finish()
  assert.equal(await loading, false)
  assert.equal(session.record.id, 'a')
  assert.equal(session.record.html, 'Keep this draft')
  session.dispose()
})
