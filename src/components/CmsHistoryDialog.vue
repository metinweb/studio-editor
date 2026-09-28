<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import AppDialog from './AppDialog.vue'
import { renderDocument } from '../lib/content'
import { useEditorLocale } from '../lib/editor-locale'
const props = defineProps({ engine: Object, session: Object })
const emit = defineEmits(['close'])
const { locale } = useEditorLocale()
const c = (en, tr) => (locale.value === 'tr' ? tr : en)
const versions = ref([]),
  selected = ref(null),
  preview = ref(''),
  error = ref(''),
  busy = ref(false)
let epoch = 0,
  closed = false
const revision = props.engine.revision
onBeforeUnmount(() => {
  closed = true
  epoch++
})
onMounted(async () => {
  busy.value = true
  try {
    const values = await props.session.listVersions()
    if (!closed) versions.value = values
  } catch (failure) {
    if (!closed) error.value = failure.message
  } finally {
    if (!closed) busy.value = false
  }
})
async function select(version) {
  const request = ++epoch
  busy.value = true
  error.value = ''
  selected.value = null
  preview.value = ''
  try {
    const record = await props.session.loadVersion(version)
    if (closed || request !== epoch) return
    selected.value = record
    preview.value = renderDocument({
      title: record.title,
      content: record.html,
      locale: locale.value,
    })
  } catch (failure) {
    if (!closed && request === epoch) error.value = failure.message
  } finally {
    if (!closed && request === epoch) busy.value = false
  }
}
function restore() {
  if (!selected.value || !props.engine.editable) return
  if (props.engine.revision !== revision || selected.value.id !== props.session.state.record?.id) {
    error.value = c(
      'The document changed. Reopen history before restoring.',
      'Belge değişti. Geri yüklemeden önce geçmişi yeniden açın.',
    )
    return
  }
  props.engine.replace(selected.value.html)
  emit('close')
}
</script>
<template>
  <AppDialog :title="c('CMS version history', 'CMS sürüm geçmişi')" wide @close="emit('close')">
    <div class="native-form">
      <p class="muted">
        {{
          c(
            'Restore copies an older version into your current draft and creates an undo step. Your CMS saves it as a new version.',
            'Geri yükleme eski sürümü güncel taslağa kopyalar ve geri alma adımı oluşturur. CMS bunu yeni bir sürüm olarak kaydeder.',
          )
        }}
      </p>
      <p v-if="busy" role="status">{{ c('Loading…', 'Yükleniyor…') }}</p>
      <p v-if="error" role="alert" class="error-banner">{{ error }}</p>
      <label
        >{{ c('Version', 'Sürüm')
        }}<select
          class="text-input"
          @change="select($event.target.value)"
          :disabled="!versions.length"
        >
          <option value="" disabled selected>{{ c('Select a version', 'Bir sürüm seçin') }}</option>
          <option v-for="item in versions" :key="item.version" :value="item.version">
            {{ item.title }} · {{ item.version }} {{ item.createdAt || '' }}
          </option>
        </select></label
      >
      <p v-if="!busy && !error && !versions.length">
        {{ c('No saved versions.', 'Kayıtlı sürüm yok.') }}
      </p>
      <iframe
        v-if="preview"
        :srcdoc="preview"
        sandbox=""
        :title="c('Version preview', 'Sürüm önizlemesi')"
        class="document-preview-frame"
      ></iframe>
    </div>
    <template #footer
      ><button type="button" class="button primary" :disabled="busy || !selected" @click="restore">
        {{ c('Restore to draft', 'Taslağa geri yükle') }}
      </button></template
    >
  </AppDialog>
</template>
