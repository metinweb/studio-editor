export function createHttpMediaAdapter({ baseUrl, getToken }) {
  const base = baseUrl.replace(/\/$/, '')
  async function request(path = '', options = {}) {
    const response = await fetch(`${base}/api/media${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getToken()}`,
        ...options.headers,
      },
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    return response.json()
  }
  return {
    label: 'HTTP media',
    list: () => request(),
    resolve: (id) => request(`/${encodeURIComponent(id)}`),
    async upload(file, { signal, alt, onProgress }) {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      onProgress(0)
      const asset = await request('', {
        method: 'POST',
        signal,
        body: JSON.stringify({ name: file.name, type: file.type, base64, alt }),
      })
      onProgress(1)
      return asset
    },
    update: (asset) =>
      request(`/${encodeURIComponent(asset.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ alt: asset.alt }),
      }),
    remove: (id) => request(`/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }
}
