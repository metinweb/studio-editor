import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createCollaborationServer } from '../../examples/collaboration-server.mjs'
import { createSharedDocument } from '../../src/editor/shared-document.js'
test('collaboration enforces read/write roles and revocation, persists state and reports authenticated presence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-collab-test-'))
  let revoked = false
  const server = await createCollaborationServer({
    directory,
    authorize: (token) =>
      !revoked && token === 'edit'
        ? { id: 'e', name: 'Editor', role: 'editor' }
        : token === 'view'
          ? { id: 'v', name: 'Viewer', role: 'viewer' }
          : null,
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}/rooms/example`
  const headers = (token) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  })
  const shared = createSharedDocument({
    initial: {
      schemaVersion: 2,
      revision: 0,
      blocks: [
        {
          id: 'a',
          node: {
            type: 'element',
            tag: 'p',
            attrs: {},
            children: [{ type: 'text', text: 'Shared' }],
          },
        },
      ],
    },
  })
  const body = JSON.stringify({ update: Buffer.from(shared.encode()).toString('base64') })
  try {
    assert.equal((await fetch(url)).status, 401)
    assert.equal((await fetch(url, { method: 'PUT', headers: headers('edit'), body })).status, 200)
    const view = await fetch(url, { headers: headers('view') })
    assert.equal(view.status, 200)
    const data = await view.json()
    assert.equal(data.role, 'viewer')
    assert.equal(data.users.length, 2)
    assert.equal((await fetch(url, { method: 'POST', headers: headers('view'), body })).status, 403)
    revoked = true
    assert.equal((await fetch(url, { method: 'POST', headers: headers('edit'), body })).status, 401)
  } finally {
    shared.destroy()
    await new Promise((r) => server.close(r))
    if (
      resolve(directory).startsWith(resolve(tmpdir()) + '\\') ||
      resolve(directory).startsWith(resolve(tmpdir()) + '/')
    )
      await rm(directory, { recursive: true, force: true })
  }
})
