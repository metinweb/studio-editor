import { tagLength, tagLimit } from './document-library.js'

export const archiveLimit = 100 * 1024 * 1024
const fail = () => {
  throw new Error('Yedek dosyası geçersiz veya desteklenmeyen bir sürümde.')
}
const string = (value, max) => typeof value === 'string' && value.length <= max
const stamp = (value) => Number.isSafeInteger(value) && value >= 0
const types = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'application/pdf',
]

export function validateArchive(data) {
  if (!data || typeof data !== 'object') fail()
  for (const [store, limit] of Object.entries({
    documents: 2000,
    media: 500,
    templates: 500,
    versions: 60000,
  })) {
    if (!Array.isArray(data[store]) || data[store].length > limit) fail()
    const ids = new Set()
    for (const v of data[store]) {
      if (!v || !string(v.id, 120) || !v.id || ids.has(v.id)) fail()
      ids.add(v.id)
      if (store === 'documents') {
        if (v.favorite !== undefined && typeof v.favorite !== 'boolean') fail()
        if (
          v.tags !== undefined &&
          (!Array.isArray(v.tags) ||
            v.tags.length > tagLimit ||
            v.tags.some((tag) => !string(tag, tagLength) || !tag.trim()))
        )
          fail()
      }
      if (store === 'documents' || store === 'versions') {
        if (
          v.blockIds !== undefined &&
          (!Array.isArray(v.blockIds) ||
            v.blockIds.length > 20000 ||
            v.blockIds.some((id) => !string(id, 120)))
        )
          fail()
        if (!string(v.title, 1000) || !string(v.content, 30 * 1024 * 1024)) fail()
        if (!stamp(store === 'documents' ? v.updatedAt : v.createdAt)) fail()
      } else if (store === 'templates') {
        if (!string(v.name, 1000) || !string(v.html, 30 * 1024 * 1024) || !stamp(v.createdAt))
          fail()
      } else {
        if (
          !string(v.name, 1000) ||
          !string(v.alt, 10000) ||
          !types.includes(v.type) ||
          !stamp(v.createdAt) ||
          !stamp(v.size) ||
          v.size > 12 * 1024 * 1024
        )
          fail()
        if (!string(v.dataUrl, 17 * 1024 * 1024) || !v.dataUrl.startsWith(`data:${v.type};base64,`))
          fail()
        const bytes = v.dataUrl.slice(v.dataUrl.indexOf(',') + 1)
        if (bytes.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(bytes)) fail()
        if (
          (bytes.length / 4) * 3 - (bytes.endsWith('==') ? 2 : bytes.endsWith('=') ? 1 : 0) !==
          v.size
        )
          fail()
      }
    }
  }
  const ids = new Set(data.documents.map((d) => d.id))
  for (const v of data.versions) if (!ids.has(v.documentId) || !string(v.reason, 200)) fail()
  return data
}
export async function digest(text) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
export async function encodeArchive(data) {
  validateArchive(data)
  const payload = JSON.stringify(data)
  const result = JSON.stringify({
    format: 'studio-workspace',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    sha256: await digest(payload),
    payload,
  })
  if (new TextEncoder().encode(result).length > archiveLimit)
    throw new Error('Yedek 100 MB sınırını aşıyor.')
  return result
}
export async function decodeArchive(text) {
  if (new TextEncoder().encode(text).length > archiveLimit) fail()
  let envelope
  try {
    envelope = JSON.parse(text)
  } catch {
    fail()
  }
  if (
    envelope?.format !== 'studio-workspace' ||
    envelope.schemaVersion !== 1 ||
    typeof envelope.payload !== 'string' ||
    envelope.sha256 !== (await digest(envelope.payload))
  )
    fail()
  let data
  try {
    data = JSON.parse(envelope.payload)
  } catch {
    fail()
  }
  return validateArchive(data)
}
