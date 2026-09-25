import { reactive } from 'vue'
import { escapeHtml } from './content'
import { acceptedTypes, safeMediaUrl } from './media-url'

export const mediaServiceKey = Symbol('studio-media-service')
export const assetUrl = (item) => item.url || item.dataUrl || ''
export function mediaMarkup(item) {
  const url = assetUrl(item)
  if (!safeMediaUrl(url)) throw new Error('Medya adresi güvenli değil.')
  const src = escapeHtml(url),
    identity = item.id ? ` data-studio-asset="${escapeHtml(item.id)}"` : '',
    alt = escapeHtml(item.alt || ''),
    name = escapeHtml(item.name || '')
  if (item.type.startsWith('image/'))
    return `<img${identity} src="${src}" alt="${alt}" style="max-width:100%;height:auto;" />`
  if (item.type.startsWith('video/'))
    return `<video${identity} controls="controls" src="${src}" style="max-width:100%;"></video><p></p>`
  if (item.type.startsWith('audio/'))
    return `<audio${identity} controls="controls" src="${src}"></audio><p></p>`
  return `<a${identity} href="${src}" download="${name}">${name}</a>`
}
function validateAsset(item) {
  if (
    !item ||
    typeof item.id !== 'string' ||
    !item.id ||
    !acceptedTypes.includes(item.type) ||
    !safeMediaUrl(assetUrl(item)) ||
    typeof item.name !== 'string' ||
    !Number.isFinite(item.size) ||
    item.size < 0
  )
    throw new Error('Medya sağlayıcısı geçersiz bir dosya döndürdü.')
  return { ...item, alt: String(item.alt || ''), createdAt: Number(item.createdAt) || Date.now() }
}

// Each injected adapter has its own state, requests and cancellation lifetime.
export function createMediaService(adapter) {
  for (const method of ['list', 'upload', 'update', 'remove'])
    if (typeof adapter?.[method] !== 'function')
      throw new Error(`Medya adaptöründe ${method} eksik.`)
  let controller = null,
    alive = true,
    epoch = 0,
    failures = [],
    metadata = {}
  const state = reactive({
    items: [],
    busy: false,
    error: '',
    progress: 0,
    retryCount: 0,
    locationLabel: adapter.label || 'Medya sağlayıcısı',
    async initialize() {
      if (!alive || state.busy) return
      const request = ++epoch
      try {
        const items = (await adapter.list()).map(validateAsset)
        if (alive && request === epoch && !state.busy) {
          state.items = items.sort((a, b) => b.createdAt - a.createdAt)
          state.error = ''
        }
      } catch (cause) {
        if (alive && request === epoch)
          state.error = cause.message || 'Medya kütüphanesi açılamadı.'
      }
    },
    async upload(files, options = {}) {
      if (state.busy || !alive) return []
      const uploadEpoch = ++epoch
      state.busy = true
      state.error = ''
      state.progress = 0
      controller = new AbortController()
      const signal = controller.signal
      const added = [],
        messages = []
      failures = []
      metadata = options
      state.retryCount = 0
      try {
        for (let index = 0; index < files.length; index++) {
          const file = files[index]
          if (signal.aborted) break
          if (!acceptedTypes.includes(file.type) || file.size > 12 * 1024 * 1024) {
            messages.push(
              `${file.name}: ${!acceptedTypes.includes(file.type) ? 'desteklenmeyen dosya türü.' : 'en fazla 12 MB yüklenebilir.'}`,
            )
            continue
          }
          try {
            const item = validateAsset(
              await adapter.upload(file, {
                signal,
                alt: options.alt || '',
                onProgress(value) {
                  if (
                    alive &&
                    state.busy &&
                    uploadEpoch === epoch &&
                    !signal.aborted &&
                    Number.isFinite(value)
                  )
                    state.progress = Math.round(
                      (100 * (index + Math.max(0, Math.min(1, value)))) / files.length,
                    )
                },
              }),
            )
            if (!alive || signal.aborted) break
            const existing = state.items.findIndex((entry) => entry.id === item.id)
            if (existing >= 0) state.items.splice(existing, 1, item)
            else state.items.unshift(item)
            added.push(item)
          } catch (cause) {
            if (!alive || signal.aborted) break
            failures.push(file)
            messages.push(`${file.name}: ${cause.message || 'yüklenemedi.'}`)
          }
          state.progress = Math.round((100 * (index + 1)) / files.length)
        }
      } finally {
        if (alive) {
          state.busy = false
          state.retryCount = failures.length
          state.error = signal.aborted ? 'Yükleme iptal edildi.' : messages.join(' ')
        }
        controller = null
      }
      return added
    },
    retry() {
      return state.upload([...failures], metadata)
    },
    cancel() {
      controller?.abort()
    },
    dispose() {
      alive = false
      ++epoch
      controller?.abort()
      failures = []
    },
    async update(item, changes) {
      const updated = validateAsset(
        await adapter.update({ ...item, alt: String(changes.alt ?? item.alt) }),
      )
      if (alive) Object.assign(item, updated)
    },
    async remove(id) {
      await adapter.remove(id)
      if (alive) state.items = state.items.filter((item) => item.id !== id)
    },
    markup: mediaMarkup,
  })
  return state
}
