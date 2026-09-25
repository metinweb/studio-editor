import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createCollaborationServer } from '../../examples/collaboration-server.mjs'
import { createSharedDocument } from '../../src/editor/shared-document.js'
import { openSharedRoom, connectSharedRoom } from '../../src/lib/shared-transport.js'

test('HTTP clients reconnect with offline edits, follow permission changes and reload disk state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-transport-'))
  let role = 'editor',
    revoked = false
  const authorize = (token) =>
    revoked ? null : token === 'test-token' ? { id: 'one', name: 'Test', role } : null
  let server = await createCollaborationServer({ directory, authorize })
  const listen = async () => {
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    return `http://127.0.0.1:${server.address().port}`
  }
  let url = await listen()
  const initial = {
    schemaVersion: 2,
    revision: 0,
    blocks: [
      {
        id: 'p',
        node: { type: 'element', tag: 'p', attrs: {}, children: [{ type: 'text', text: 'Hello' }] },
      },
    ],
  }
  const options = () => ({ url, room: 'test', getToken: () => 'test-token', createSharedDocument })
  const a = (await openSharedRoom({ ...options(), initial })).shared
  const b = (await openSharedRoom(options())).shared
  const text = (shared) => shared.getModel().blocks[0].node.children[0].text
  const edit = (shared, value) => {
    const model = shared.getModel()
    model.blocks[0].node.children[0].text = value
    shared.setModel(model)
  }
  const until = async (condition) => {
    const deadline = Date.now() + 7000
    while (!condition()) {
      assert.ok(Date.now() < deadline, 'Timed out waiting for transport')
      await delay(25)
    }
  }
  let ca,
    cb,
    status = '',
    seenRole = '',
    users = []
  const connect = (shared, extra = {}) =>
    connectSharedRoom({
      ...options(),
      shared,
      binding: { receive: (bytes) => shared.applyUpdate(bytes) },
      ...extra,
    })
  try {
    // Both changes predate transport subscription, as when reopening an IndexedDB draft.
    edit(a, 'A Hello')
    edit(b, 'Hello B')
    ca = connect(a, {
      onStatus: (value) => (status = value),
      onRole: (value) => (seenRole = value),
      onPresence: (value) => (users = value),
    })
    cb = connect(b)
    await until(() => text(a) === 'A Hello B' && text(b) === 'A Hello B')
    assert.equal(users[0].id, 'one')
    role = 'viewer'
    await until(() => seenRole === 'viewer')
    edit(a, 'Local A Hello B')
    await until(() => status === 'read-only-pending')
    assert.equal(text(b), 'A Hello B')
    role = 'editor'
    await until(() => text(b) === 'Local A Hello B')
    revoked = true
    await until(() => status === 'unauthorized')
    assert.equal(text(a), 'Local A Hello B')
    ca.dispose()
    cb.dispose()
    revoked = false
    await new Promise((r) => server.close(r))
    server = await createCollaborationServer({ directory, authorize })
    url = await listen()
    const restored = (await openSharedRoom(options())).shared
    try {
      assert.equal(text(restored), 'Local A Hello B')
    } finally {
      restored.destroy()
    }
  } finally {
    ca?.dispose()
    cb?.dispose()
    a.destroy()
    b.destroy()
    await new Promise((r) => server.close(r))
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep))
    await rm(directory, { recursive: true, force: true })
  }
})
