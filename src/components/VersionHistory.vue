<script setup>
import { computed, onMounted, ref } from 'vue'
import AppDialog from './AppDialog.vue'
import { useWorkspace } from '../stores/workspace'
import { repository } from '../lib/database'
import { plainText, renderDocument } from '../lib/content'
const emit = defineEmits(['close'])
const workspace = useWorkspace()
const items = ref([]),
  selected = ref(null),
  busy = ref(false),
  error = ref(''),
  status = ref('')
const changed = computed(
  () =>
    selected.value &&
    (selected.value.content !== workspace.active.content ||
      selected.value.title !== workspace.active.title),
)
const preview = computed(() => (selected.value ? renderDocument(selected.value) : ''))
const comparison = computed(() => {
  if (!selected.value) return null
  const before = plainText(selected.value.content).match(/\S+|\s+/gu) || [],
    after = plainText(workspace.active.content).match(/\S+|\s+/gu) || []
  let start = 0,
    end = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start++
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end++
  return {
    before: before.slice(start, before.length - end).join(''),
    after: after.slice(start, after.length - end).join(''),
  }
})
async function load() {
  items.value = (await repository.all('versions'))
    .filter((v) => v.documentId === workspace.activeId)
    .sort((a, b) => b.createdAt - a.createdAt)
}
async function run(work) {
  busy.value = true
  error.value = ''
  try {
    await work()
  } catch (e) {
    error.value = e.message || 'Sürümler okunamadı.'
  } finally {
    busy.value = false
  }
}
function checkpoint() {
  return run(async () => {
    await workspace.save(true, 'Elle kaydedildi')
    if (workspace.dirty) throw new Error('Belge kaydedilemedi.')
    await load()
    selected.value = items.value[0]
    status.value = 'Güncel sürüm kaydedildi.'
  })
}
function restore() {
  return run(async () => {
    await workspace.restoreVersion(selected.value)
    await load()
    status.value = 'Sürüm geri yüklendi. Önceki içerik de geçmişte saklandı.'
  })
}
onMounted(() =>
  run(async () => {
    await workspace.save()
    await load()
    selected.value = items.value[0]
  }),
)
</script>
<template>
  <AppDialog title="Sürüm geçmişi" wide @close="!busy && emit('close')">
    <div class="version-panel">
      <div class="version-list">
        <button class="button" :disabled="busy" @click="checkpoint">Şimdi sürüm kaydet</button>
        <p class="muted">
          Değişiklikler en az 30 saniye arayla sürümlenir. Belge başına son 30 sürüm / 20 MB
          saklanır; son sürüm daima korunur.
        </p>
        <button
          v-for="item in items"
          :key="item.id"
          class="version-item"
          :aria-pressed="selected?.id === item.id"
          @click="selected = item"
        >
          <strong>{{ new Date(item.createdAt).toLocaleString('tr-TR') }}</strong>
          <span>{{ item.reason }}</span
          ><small>{{ item.title }}</small>
        </button>
      </div>
      <div v-if="selected" class="version-detail">
        <p><strong>Seçili sürüm:</strong> {{ selected.title }}</p>
        <iframe title="Sürüm önizlemesi" sandbox="" :srcdoc="preview"></iframe>
        <details v-if="comparison" class="version-diff">
          <summary>Metin farkını göster</summary>
          <p>İlk ve son değişiklik arasındaki metin. Biçim farklarını önizlemeden inceleyin.</p>
          <div>
            <strong>Seçili sürüm</strong>
            <pre>{{ comparison.before || '(Metin farkı yok)' }}</pre>
          </div>
          <div>
            <strong>Şimdiki belge</strong>
            <pre>{{ comparison.after || '(Metin farkı yok)' }}</pre>
          </div>
        </details>
        <button class="button primary" :disabled="busy || !changed" @click="restore">
          Bu sürümü geri yükle
        </button>
      </div>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="status" role="status">{{ status }}</p>
    </div>
  </AppDialog>
</template>
<style scoped>
.version-panel {
  padding: 24px;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 24px;
}
.version-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 65vh;
  overflow: auto;
}
.version-list p {
  font-size: 12px;
  line-height: 1.5;
}
.version-item {
  display: grid;
  gap: 6px;
  padding: 12px;
  text-align: start;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
}
.version-item[aria-pressed='true'] {
  border-color: #6d4de3;
  background: #f4f0ff;
}
.version-detail {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.version-detail iframe {
  width: 100%;
  height: 260px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.version-diff pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 160px;
  overflow: auto;
  padding: 12px;
  background: #f8fafc;
}
.version-diff p {
  color: #64748b;
  font-size: 12px;
}
[role='alert'] {
  color: #b91c1c;
}
@media (max-width: 700px) {
  .version-panel {
    grid-template-columns: 1fr;
  }
  .version-list {
    max-height: 180px;
  }
}
</style>
