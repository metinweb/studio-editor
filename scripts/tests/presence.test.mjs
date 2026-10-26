import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createCollaborationServer } from '../../examples/collaboration-server.mjs'
import { createSharedDocument } from '../../src/editor/shared-document.js'
import { openSharedRoom, connectSharedRoom } from '../../src/lib/shared-transport.js'

test('sync requests share each user caret and the server rejects malformed selections', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-presence-'))
  const accounts = {
    'token-a': { id: 'a', name: 'Ayşe', role: 'editor' },
    'token-b': { id: 'b', name: 'Barış', role: 'viewer' },
  }
  const server = await createCollaborationServer({
    directory,
    authorize: (token) => accounts[token] || null,
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  const initial = {
    schemaVersion: 2,
    revision: 0,
    blocks: [
      {
        id: 'p1',
        node: { type: 'element', tag: 'p', attrs: {}, children: [{ type: 'text', text: 'Hi' }] },
      },
    ],
  }
  const clients = []
  try {
    const open = (token, extra) =>
      openSharedRoom({ url, room: 'r', getToken: () => token, createSharedDocument, ...extra })
    const a = (await open('token-a', { initial })).shared
    const b = (await open('token-b')).shared
    let seenByB = [],
      seenByA = []
    const selectionA = { start: { block: 'p1', offset: 1 }, end: { block: 'p1', offset: 2 } }
    let selectionB = { start: { block: 'p1', offset: -5 }, end: { block: 'p1', offset: 0 } }
    const connect = (shared, token, getSelection, onPresence) =>
      connectSharedRoom({
        url,
        room: 'r',
        getToken: () => token,
        shared,
        binding: { receive: (bytes) => shared.applyUpdate(bytes) },
        getSelection,
        onPresence,
      })
    clients.push(
      connect(
        a,
        'token-a',
        () => selectionA,
        (users) => (seenByA = users),
      ),
    )
    clients.push(
      connect(
        b,
        'token-b',
        () => selectionB,
        (users) => (seenByB = users),
      ),
    )
    const until = async (condition) => {
      const deadline = Date.now() + 7000
      while (!condition()) {
        assert.ok(Date.now() < deadline, 'Timed out waiting for presence')
        await delay(25)
      }
    }
    await until(() => seenByB.find((user) => user.id === 'a')?.selection)
    assert.deepEqual(seenByB.find((user) => user.id === 'a').selection, selectionA)
    assert.equal(seenByB.find((user) => user.id === 'a').name, 'Ayşe')
    // A negative offset is not a valid selection; viewers still share valid carets.
    await until(() => seenByA.some((user) => user.id === 'b'))
    assert.equal(seenByA.find((user) => user.id === 'b').selection, null)
    selectionB = { start: { block: 'p1', offset: 0 }, end: { block: 'p1', offset: 0 } }
    await until(() => seenByA.find((user) => user.id === 'b')?.selection)
    assert.deepEqual(seenByA.find((user) => user.id === 'b').selection, selectionB)
    const response = await fetch(`${url}/rooms/r`, {
      headers: { Authorization: 'Bearer token-a', 'X-Studio-Selection': '%7Bbroken' },
    })
    assert.equal(response.status, 200)
  } finally {
    for (const client of clients) client.dispose()
    await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})
