/** Connect an existing CMS; authentication and atomic version checks belong on its server. */
export function createHttpDocumentAdapter({
  baseUrl,
  getToken = () => '',
  fetch: request = globalThis.fetch,
  timeout = 20000,
}) {
  const base = new URL(baseUrl)
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 120000)
    throw new TypeError('Invalid document request timeout.')
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new TypeError('Invalid document API URL.')
  const root = base.href.replace(/\/$/, '')
  async function call(path, method = 'GET', body, version) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const token = await getToken()
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const response = await request(root + path, {
        method,
        signal: controller.signal,
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(version !== undefined ? { 'If-Match': JSON.stringify(version) } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (!response.ok) {
        const error = new Error(
          response.status === 409 || response.status === 412
            ? 'This document changed on the server. Your local edits are preserved.'
            : `Document service returned HTTP ${response.status}.`,
        )
        error.status = response.status
        throw error
      }
      const text = await response.text()
      if (text.length > 30 * 1024 * 1024) throw new Error('Document response is too large.')
      return JSON.parse(text)
    } finally {
      clearTimeout(timer)
    }
  }
  const path = (id) => `/documents/${encodeURIComponent(id)}`
  return {
    load: (id) => call(path(id)),
    save: (record, { expectedVersion }) => call(path(record.id), 'PUT', record, expectedVersion),
    listVersions: (id) => call(path(id) + '/versions'),
    loadVersion: (id, version) => call(path(id) + '/versions/' + encodeURIComponent(version)),
  }
}
