import { ref } from 'vue'
import { defineStore } from 'pinia'
import { repository } from '../lib/database'
import { mediaMarkup } from '../lib/media-service'

export const acceptedTypes = [
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
export const formatSize = (size) =>
  size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`

export const useMedia = defineStore('studio-media', () => {
  const items = ref([])
  const busy = ref(false)
  const error = ref('')

  async function initialize() {
    try {
      items.value = (await repository.all('media')).sort((a, b) => b.createdAt - a.createdAt)
    } catch {
      error.value = 'Medya kütüphanesi açılamadı. Tarayıcı depolamasını kontrol edin.'
    }
  }

  async function upload(files, metadata = {}) {
    busy.value = true
    error.value = ''
    const added = []
    const failures = []
    try {
      for (const file of files) {
        if (!acceptedTypes.includes(file.type)) {
          failures.push(`${file.name}: desteklenmeyen dosya türü.`)
          continue
        }
        if (file.size > 12 * 1024 * 1024) {
          failures.push(`${file.name}: en fazla 12 MB yüklenebilir.`)
          continue
        }
        try {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
          // Reuse an existing asset when the same bytes are uploaded again.
          const existing = items.value.find((item) => item.dataUrl === dataUrl)
          if (existing) {
            added.push(existing)
            continue
          }
          const item = {
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl,
            alt: metadata.alt || '',
            createdAt: Date.now(),
          }
          await repository.put('media', item)
          items.value.unshift(item)
          added.push(item)
        } catch {
          failures.push(`${file.name}: yüklenemedi. Depolama alanını kontrol edin.`)
        }
      }
    } finally {
      busy.value = false
      error.value = failures.join(' ')
    }
    return added
  }

  async function update(item, changes) {
    const updated = { ...item, ...changes }
    await repository.put('media', updated)
    Object.assign(item, changes)
  }

  async function remove(id) {
    await repository.remove('media', id)
    items.value = items.value.filter((item) => item.id !== id)
  }

  function markup(item) {
    return mediaMarkup(item)
  }

  return { items, busy, error, initialize, upload, update, remove, markup }
})
