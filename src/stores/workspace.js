import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { repository } from '../lib/database'
import { plainText, welcomeContent } from '../lib/content'
import { normalizeTags } from '../lib/document-library'

export const useWorkspace = defineStore('studio-workspace', () => {
  const documents = ref([])
  const activeId = ref(null)
  const ready = ref(false)
  const error = ref('')
  const saving = ref(false)
  const dirty = ref(false)
  const savedAt = ref(null)
  const active = computed(() => documents.value.find((item) => item.id === activeId.value))
  const text = computed(() => plainText(active.value?.content || ''))
  const words = computed(() => text.value.trim().split(/\s+/u).filter(Boolean).length)
  const characters = computed(() => text.value.length)
  const ordered = computed(() => [...documents.value].sort((a, b) => b.updatedAt - a.updatedAt))
  let timer
  let queue = Promise.resolve()
  let revision = 0

  async function initialize() {
    try {
      documents.value = await repository.all('documents')
      if (!documents.value.length) await create('Studio’ya hoş geldiniz', welcomeContent)
      else activeId.value = ordered.value[0].id
    } catch {
      error.value = 'Tarayıcı depolaması açılamadı. Değişikliklerinizi HTML olarak dışa aktarın.'
      if (!documents.value.length) {
        documents.value.push({
          id: crypto.randomUUID(),
          title: 'İlk belgem',
          content: welcomeContent,
          updatedAt: Date.now(),
        })
        activeId.value = documents.value[0].id
      }
    } finally {
      ready.value = true
    }
  }

  function save(force = false, reason) {
    clearTimeout(timer)
    if (!active.value) return queue
    const snapshot = JSON.parse(JSON.stringify(active.value))
    const currentRevision = revision
    saving.value = true
    queue = queue
      .then(() => repository.saveDocument(snapshot, force, reason))
      .then(() => {
        if (currentRevision === revision) {
          dirty.value = false
          savedAt.value = new Date()
          error.value = ''
        }
      })
      .catch(() => {
        error.value =
          'Belge kaydedilemedi. Depolama alanını kontrol edin veya HTML olarak dışa aktarın.'
        dirty.value = true
      })
      .finally(() => {
        saving.value = false
      })
    return queue
  }

  function update(changes) {
    if (!active.value) return
    if (
      Object.entries(changes).every(
        ([key, value]) =>
          active.value[key] === value ||
          (key === 'blockIds' &&
            Array.isArray(value) &&
            value.length === active.value.blockIds?.length &&
            value.every((id, index) => id === active.value.blockIds[index])),
      )
    )
      return
    Object.assign(active.value, changes, { updatedAt: Date.now() })
    revision++
    dirty.value = true
    clearTimeout(timer)
    timer = setTimeout(save, 650)
  }

  async function select(id) {
    if (dirty.value) await save()
    if (dirty.value) return
    activeId.value = id
  }

  async function create(title = 'Başlıksız belge', content = '<p></p>', metadata = {}) {
    if (dirty.value) await save()
    if (dirty.value) return
    const document = {
      id: crypto.randomUUID(),
      title,
      content,
      updatedAt: Date.now(),
      favorite: metadata.favorite === true,
      tags: normalizeTags(metadata.tags),
    }
    await repository.saveDocument(document, true, 'Belge oluşturuldu')
    documents.value.push(document)
    activeId.value = document.id
    savedAt.value = new Date()
  }

  async function remove(id) {
    await save()
    if (dirty.value) return
    if (documents.value.length === 1) await create()
    await repository.removeDocument(id)
    documents.value = documents.value.filter((item) => item.id !== id)
    if (activeId.value === id) activeId.value = ordered.value[0].id
  }

  async function reload() {
    documents.value = await repository.all('documents')
    if (!active.value) activeId.value = ordered.value[0]?.id
  }

  async function restoreVersion(version) {
    if (version.documentId !== activeId.value) throw new Error('Belge değişti.')
    await save(true, 'Geri yüklemeden önce')
    if (dirty.value) throw new Error('Mevcut belge kaydedilemedi.')
    update({ content: version.content, title: version.title, blockIds: version.blockIds || [] })
    await save(true, 'Sürüm geri yüklendi')
    if (dirty.value) throw new Error('Sürüm kaydedilemedi.')
  }

  return {
    reload,
    restoreVersion,
    documents,
    activeId,
    ready,
    error,
    saving,
    dirty,
    savedAt,
    active,
    ordered,
    words,
    characters,
    initialize,
    save,
    update,
    select,
    create,
    remove,
  }
})
