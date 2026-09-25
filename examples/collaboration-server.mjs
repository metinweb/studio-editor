import { createServer } from 'node:http'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createSharedDocument } from '../src/editor/shared-document.js'

export async function createCollaborationServer({
  directory,
  authorize,
  origin = 'http://127.0.0.1:4174',
}) {
  const folder = resolve(directory)
  await mkdir(folder, { recursive: true })
  let queue = Promise.resolve()
  const presence = new Map()
  const server = createServer(async (req, res) => {
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }
    if (req.headers.origin === origin)
      Object.assign(headers, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
        Vary: 'Origin',
      })
    const send = (code, data) => {
      if (!res.headersSent) {
        res.writeHead(code, headers)
        res.end(JSON.stringify(data))
      }
    }
    try {
      if (req.method === 'OPTIONS') {
        send(req.headers.origin === origin ? 204 : 403, {})
        return
      }
      const room = /^\/rooms\/([a-zA-Z0-9_-]{1,80})$/.exec(
        new URL(req.url, 'http://localhost').pathname,
      )?.[1]
      if (!room) {
        send(404, { error: 'Not found' })
        return
      }
      const token = req.headers.authorization?.replace(/^Bearer /, ''),
        account = await authorize(token, room)
      if (!account || !['editor', 'viewer'].includes(account.role)) {
        send(401, { error: 'Unauthorized' })
        return
      }
      const path = join(folder, `${room}.bin`)
      let input = {}
      const chunks = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 6 * 1024 * 1024) {
          send(413, { error: 'Update too large' })
          return
        }
        chunks.push(chunk)
      }
      if (size)
        try {
          input = JSON.parse(Buffer.concat(chunks).toString())
        } catch {
          send(400, { error: 'Invalid JSON' })
          return
        }
      async function run() {
        // Authorization is rechecked after queueing, including revocation while a request waits.
        const current = await authorize(token, room)
        if (!current || !['editor', 'viewer'].includes(current.role)) {
          send(401, { error: 'Unauthorized' })
          return
        }
        let update
        try {
          update = new Uint8Array(await readFile(path))
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
        const now = Date.now(),
          users = presence.get(room) || new Map()
        presence.set(room, users)
        for (const [id, user] of users) if (now - user.lastSeen > 15000) users.delete(id)
        users.set(current.id, {
          id: current.id,
          name: current.name,
          role: current.role,
          lastSeen: now,
        })
        const response = (bytes) => ({
          update: Buffer.from(bytes).toString('base64'),
          role: current.role,
          users: [...users.values()],
        })
        if (req.method === 'GET') {
          if (!update) {
            send(404, { error: 'Room not found' })
            return
          }
          send(200, response(update))
          return
        }
        if (current.role !== 'editor') {
          send(403, { error: 'Read only' })
          return
        }
        if (!['PUT', 'POST'].includes(req.method)) {
          send(405, { error: 'Method not allowed' })
          return
        }
        if (req.method === 'PUT' && update) {
          send(200, response(update))
          return
        }
        if (typeof input.update !== 'string' || !/^[a-z0-9+/]*={0,2}$/i.test(input.update)) {
          send(400, { error: 'Invalid update' })
          return
        }
        const shared = createSharedDocument(update ? { update } : {})
        let next
        try {
          shared.applyUpdate(new Uint8Array(Buffer.from(input.update, 'base64')))
          next = shared.encode()
        } catch {
          send(409, { error: 'Update conflicts with document schema' })
          return
        } finally {
          shared.destroy()
        }
        if (next.length > 32 * 1024 * 1024) {
          send(413, { error: 'Document too large' })
          return
        }
        await writeFile(`${path}.next`, next)
        await rename(`${path}.next`, path)
        send(200, response(next))
      }
      const operation = queue.then(run)
      queue = operation.catch(() => {})
      await operation
    } catch {
      send(500, { error: 'Collaboration storage failed' })
    }
  })
  return server
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const accounts = JSON.parse(process.env.STUDIO_COLLAB_USERS || '[]')
  if (
    !accounts.length ||
    accounts.some((a) => !a.token || a.token.length < 32 || !Array.isArray(a.rooms))
  )
    throw new Error('STUDIO_COLLAB_USERS için token, id, name, role ve rooms tanımlayın.')
  const server = await createCollaborationServer({
    directory: process.env.STUDIO_COLLAB_DIRECTORY || '.collaboration-data',
    origin: process.env.STUDIO_COLLAB_ORIGIN,
    authorize: (token, room) => accounts.find((a) => a.token === token && a.rooms.includes(room)),
  })
  server.listen(Number(process.env.STUDIO_COLLAB_PORT) || 8788, '127.0.0.1', () =>
    console.log('Studio collaboration API: http://127.0.0.1:8788'),
  )
}
