import { createServer } from 'node:http'
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const limit = 12 * 1024 * 1024
const equal = (a, b) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b))
function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString())) return 'image/gif'
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp'
  return null
}
export async function createMediaServer({
  directory,
  token,
  origin = 'http://127.0.0.1:4174',
  publicUrl,
} = {}) {
  if (typeof token !== 'string' || token.length < 32)
    throw new Error('STUDIO_MEDIA_TOKEN en az 32 karakter olmalıdır.')
  const folder = resolve(directory || '.media-data')
  await mkdir(folder, { recursive: true })
  let records = []
  try {
    records = JSON.parse(await readFile(join(folder, 'index.json'), 'utf8'))
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  let queue = Promise.resolve()
  const sign = (value) => createHmac('sha256', token).update(value).digest('hex')
  const asset = (item) => {
    const expires = Date.now() + 15 * 60 * 1000
    return {
      ...item,
      url: `${publicUrl || `http://127.0.0.1:${server.address().port}`}/api/media/${item.id}/content?expires=${expires}&signature=${sign(`${item.id}:${expires}`)}`,
    }
  }
  async function persist(next) {
    await writeFile(join(folder, 'index.next.json'), JSON.stringify(next))
    await rename(join(folder, 'index.next.json'), join(folder, 'index.json'))
    records = next
  }
  const server = createServer(async (req, res) => {
    const headers = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    }
    if (req.headers.origin === origin)
      Object.assign(headers, {
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      })
    const send = (status, body) => {
      if (!res.headersSent) {
        res.writeHead(status, headers)
        res.end(JSON.stringify(body))
      }
    }
    try {
      if (req.method === 'OPTIONS') {
        send(req.headers.origin === origin ? 204 : 403, {})
        return
      }
      const url = new URL(req.url, 'http://localhost'),
        match = /^\/api\/media(?:\/([a-f0-9-]{36})(\/content)?)?$/.exec(url.pathname)
      if (!match) {
        send(404, { error: 'Not found' })
        return
      }
      const id = match[1],
        item = id ? records.find((r) => r.id === id) : null
      if (match[2] && req.method === 'GET') {
        const expires = Number(url.searchParams.get('expires')),
          signature = url.searchParams.get('signature')
        if (
          !item ||
          !Number.isSafeInteger(expires) ||
          expires < Date.now() ||
          expires > Date.now() + 16 * 60 * 1000 ||
          !equal(signature, sign(`${id}:${expires}`))
        ) {
          send(403, { error: 'Expired or invalid URL' })
          return
        }
        const bytes = await readFile(join(folder, `${id}.bin`))
        res.writeHead(200, {
          'Content-Type': item.type,
          'Content-Length': bytes.length,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Cache-Control': 'private, max-age=60',
          'Access-Control-Allow-Origin': origin,
        })
        res.end(bytes)
        return
      }
      if (!equal(req.headers.authorization, `Bearer ${token}`)) {
        send(401, { error: 'Unauthorized' })
        return
      }
      if (req.method === 'GET') {
        await queue
        send(
          id ? (item ? 200 : 404) : 200,
          id ? (item ? asset(item) : { error: 'Not found' }) : records.map(asset),
        )
        return
      }
      const chunks = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 17 * 1024 * 1024) {
          send(413, { error: 'Too large' })
          return
        }
        chunks.push(chunk)
      }
      let data = {}
      if (size)
        try {
          data = JSON.parse(Buffer.concat(chunks).toString())
        } catch {
          send(400, { error: 'Invalid JSON' })
          return
        }
      const mutate = async () => {
        if (req.method === 'POST' && !id) {
          if (
            typeof data.name !== 'string' ||
            data.name.length > 255 ||
            typeof data.base64 !== 'string' ||
            !/^[a-z0-9+/]*={0,2}$/i.test(data.base64) ||
            data.base64.length % 4
          ) {
            send(400, { error: 'Invalid file' })
            return
          }
          const bytes = Buffer.from(data.base64, 'base64'),
            type = imageType(bytes)
          if (!type || !bytes.length || bytes.length > limit || data.type !== type) {
            send(415, { error: 'Only PNG, JPEG, GIF and WebP images up to 12 MB are supported' })
            return
          }
          const next = {
            id: randomUUID(),
            name: data.name,
            type,
            size: bytes.length,
            alt: String(data.alt || '').slice(0, 4000),
            createdAt: Date.now(),
          }
          await writeFile(join(folder, `${next.id}.bin`), bytes, { flag: 'wx' })
          try {
            await persist([...records, next])
          } catch (e) {
            await unlink(join(folder, `${next.id}.bin`))
            throw e
          }
          send(201, asset(next))
          return
        }
        const current = records.find((r) => r.id === id)
        if (!current) {
          send(404, { error: 'Not found' })
          return
        }
        if (req.method === 'PATCH') {
          const next = { ...current, alt: String(data.alt || '').slice(0, 4000) }
          await persist(records.map((r) => (r.id === id ? next : r)))
          send(200, asset(next))
          return
        }
        if (req.method === 'DELETE') {
          await persist(records.filter((r) => r.id !== id))
          await unlink(join(folder, `${id}.bin`)).catch(() => {})
          send(200, { removed: true })
          return
        }
        send(405, { error: 'Method not allowed' })
      }
      const operation = queue.then(mutate)
      queue = operation.catch(() => {})
      await operation
    } catch {
      send(500, { error: 'Storage operation failed' })
    }
  })
  return server
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = await createMediaServer({
    token: process.env.STUDIO_MEDIA_TOKEN,
    directory: process.env.STUDIO_MEDIA_DIRECTORY,
    origin: process.env.STUDIO_MEDIA_ORIGIN,
    publicUrl: process.env.STUDIO_MEDIA_PUBLIC_URL,
  })
  server.listen(Number(process.env.STUDIO_MEDIA_PORT) || 8787, '127.0.0.1', () =>
    console.log('Studio media API: http://127.0.0.1:8787'),
  )
}
