import { ref } from 'vue'
import { defineStore } from 'pinia'
import { repository } from '../lib/database'
import { cleanHtml, publicHtml } from '../lib/content'

export const useTemplates = defineStore('studio-templates', () => {
  const items = ref([])
  const error = ref('')
  const busy = ref(false)
  async function load() {
    try {
      items.value = (await repository.all('templates')).sort((a, b) => b.createdAt - a.createdAt)
    } catch {
      error.value = 'Şablonlar okunamadı. Tarayıcı depolamasını kontrol edin.'
    }
  }
  async function save(name, html) {
    if (!name.trim() || busy.value) return false
    busy.value = true
    error.value = ''
    try {
      const item = {
        id: crypto.randomUUID(),
        name: name.trim().slice(0, 80),
        html: publicHtml(cleanHtml(html)),
        createdAt: Date.now(),
      }
      await repository.put('templates', item)
      items.value.unshift(item)
      return true
    } catch {
      error.value = 'Şablon kaydedilemedi. Depolama alanını kontrol edin.'
      return false
    } finally {
      busy.value = false
    }
  }
  async function remove(id) {
    try {
      await repository.remove('templates', id)
      items.value = items.value.filter((item) => item.id !== id)
    } catch {
      error.value = 'Şablon silinemedi.'
    }
  }
  return { items, error, busy, load, save, remove }
})
