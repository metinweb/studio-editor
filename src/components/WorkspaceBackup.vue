<script setup>
import { ref } from 'vue'
import AppDialog from './AppDialog.vue'
import { useWorkspace } from '../stores/workspace'
import { useMedia } from '../stores/media'
import { useTemplates } from '../stores/templates'
import { repository } from '../lib/database'
import { downloadBackup, prepareBackup } from '../lib/workspace-backup'
const emit = defineEmits(['close'])
const workspace = useWorkspace(),
  media = useMedia(),
  templates = useTemplates()
const busy = ref(false),
  error = ref(''),
  status = ref(''),
  draft = ref(null)
async function run(work) {
  busy.value = true
  error.value = ''
  status.value = ''
  try {
    await work()
  } catch (e) {
    error.value = e.message || 'İşlem tamamlanamadı.'
  } finally {
    busy.value = false
  }
}
async function flush() {
  await workspace.save()
  if (workspace.dirty) throw new Error('Önce açık belgeyi kaydedin.')
}
function download() {
  return run(async () => {
    await flush()
    await downloadBackup()
    status.value = 'Yedek dosyası hazırlandı.'
  })
}
function pick(event) {
  const file = event.target.files?.[0]
  draft.value = null
  if (file)
    return run(async () => {
      draft.value = await prepareBackup(file)
    })
}
function restore() {
  return run(async () => {
    await flush()
    await repository.importArchive(draft.value)
    draft.value = null
    await Promise.all([workspace.reload(), media.initialize(), templates.load()])
    status.value = 'Yedek yeni kopyalar olarak eklendi. Mevcut belgeleriniz korundu.'
  })
}
</script>
<template>
  <AppDialog title="Çalışma alanı yedeği" @close="!busy && emit('close')">
    <div class="workspace-data-panel">
      <p>Belgeler, yorumlar, medya, şablonlar ve sürüm geçmişini tek dosyada saklayın.</p>
      <button class="button primary" :disabled="busy" @click="download">Tam yedeği indir</button>
      <hr />
      <label
        >Yedek dosyası seç <input type="file" accept=".json" :disabled="busy" @change="pick"
      /></label>
      <p class="muted">En fazla 100 MB. Geri yüklenen öğeler yeni kopyalar olarak eklenir.</p>
      <div v-if="draft" class="backup-summary">
        <p>
          {{ draft.documents.length }} belge · {{ draft.media.length }} medya ·
          {{ draft.templates.length }} şablon · {{ draft.versions.length }} sürüm
        </p>
        <button class="button primary" :disabled="busy" @click="restore">Yedeği geri yükle</button>
      </div>
      <p v-if="busy" role="status">İşleniyor…</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="status" role="status">{{ status }}</p>
    </div>
  </AppDialog>
</template>
<style>
.workspace-data-panel {
  padding: 24px;
  display: grid;
  gap: 16px;
}
.workspace-data-panel p {
  margin: 0;
  line-height: 1.6;
}
.workspace-data-panel label {
  display: grid;
  gap: 12px;
}
.workspace-data-panel hr {
  width: 100%;
  border: 0;
  border-top: 1px solid #e2e8f0;
}
.workspace-data-panel [role='alert'] {
  color: #b91c1c;
}
.backup-summary {
  display: grid;
  gap: 12px;
}
</style>
