import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createMediaServer } from '../../examples/media-server.mjs'
test('HTTP provider authenticates, persists uploads, signs URLs and rejects spoofed content', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-media-test-')),
    token = 'studio-test-token-with-at-least-32-characters'
  const server = await createMediaServer({ directory, token })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}`,
    headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  try {
    assert.equal((await fetch(`${base}/api/media`)).status, 401)
    const response = await fetch(`${base}/api/media`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'a.png',
        type: 'image/png',
        base64:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=',
        alt: 'pixel',
      }),
    })
    assert.equal(response.status, 201)
    const asset = await response.json()
    assert.equal((await fetch(asset.url)).status, 200)
    assert.equal((await fetch(asset.url.replace(/signature=.*/, 'signature=invalid'))).status, 403)
    assert.equal((await fetch(`${base}/api/media`, { headers })).status, 200)
    const bad = await fetch(`${base}/api/media`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'fake.png',
        type: 'image/png',
        base64: Buffer.from('<script>bad</script>').toString('base64'),
      }),
    })
    assert.equal(bad.status, 415)
    assert.equal(
      (await fetch(`${base}/api/media/${asset.id}`, { method: 'DELETE', headers })).status,
      200,
    )
    assert.equal((await fetch(asset.url)).status, 403)
  } finally {
    await new Promise((r) => server.close(r))
    if (
      resolve(directory).startsWith(resolve(tmpdir()) + '\\') ||
      resolve(directory).startsWith(resolve(tmpdir()) + '/')
    )
      await rm(directory, { recursive: true, force: true })
  }
})
