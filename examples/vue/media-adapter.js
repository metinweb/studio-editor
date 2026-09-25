// Example contract: implement these endpoints in your own application backend.
// No credentials/API keys belong in this client file.
async function response(request) {
  const result = await request
  if (!result.ok) throw new Error(`Medya servisi hatası (${result.status})`)
  return result.status === 204 ? undefined : result.json()
}
export const mediaAdapter = {
  label: 'Uygulama sunucusu',
  list: () => response(fetch('/api/media', { credentials: 'same-origin' })),
  async upload(file, { signal, alt, onProgress }) {
    const body = new FormData()
    body.append('file', file)
    body.append('alt', alt)
    onProgress(0)
    const asset = await response(
      fetch('/api/media', { method: 'POST', body, signal, credentials: 'same-origin' }),
    )
    onProgress(1)
    return asset
  },
  update: (asset) =>
    response(
      fetch(`/api/media/${encodeURIComponent(asset.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt: asset.alt }),
        credentials: 'same-origin',
      }),
    ),
  remove: (id) =>
    response(
      fetch(`/api/media/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      }),
    ),
}
