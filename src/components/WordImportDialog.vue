<script setup>
import { ref, onBeforeUnmount } from 'vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import { importDocx } from '../lib/docx-import.js'
import { renderDocument } from '../lib/content'
const props = defineProps({ engine: Object })
const emit = defineEmits(['close'])
const { t, locale } = useEditorLocale()
const result = ref(null),
  busy = ref(false),
  error = ref(''),
  name = ref('')
const revision = props.engine.revision
const bookmark = props.engine.rememberSelection()
let epoch = 0
onBeforeUnmount(() => epoch++)
async function read(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const run = ++epoch
  busy.value = true
  error.value = ''
  result.value = null
  name.value = file.name
  try {
    const value = await importDocx(file)
    if (run === epoch) result.value = value
  } catch (failure) {
    if (run === epoch) error.value = failure.message
  } finally {
    if (run === epoch) busy.value = false
  }
}
function apply() {
  if (!result.value || !props.engine.editable || props.engine.destroyed) return
  if (props.engine.revision !== revision) {
    error.value = 'Belge değişti. İçe aktarmayı yeniden açın.'
    return
  }
  props.engine.restoreSelection(bookmark)
  props.engine.insert(result.value.html)
  emit('close')
}
</script>
<template>
  <AppDialog :title="t('Word dosyası içe aktar')" wide @close="emit('close')">
    <div class="native-form">
      <label class="field-label"
        >{{ t('DOCX dosyası')
        }}<input
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          :aria-label="t('DOCX dosyası')"
          @change="read"
      /></label>
      <p class="muted">
        {{
          t(
            'Başlıklar, listeler, tablolar, bağlantılar ve görseller içe aktarılır. Word sayfa düzeni birebir korunmaz.',
          )
        }}
      </p>
      <p v-if="busy" role="status">{{ t('Word dosyası okunuyor…') }}</p>
      <p v-if="error" class="error-banner" role="alert">{{ t(error) }}</p>
      <template v-if="result">
        <p>
          <strong>{{ name }}</strong> · {{ t('Eklemeden önce önizleyin') }}
        </p>
        <details v-if="result.warnings.length || result.skippedImages">
          <summary>
            {{ t('Dönüştürme notları') }} ({{ result.warnings.length + result.skippedImages }})
          </summary>
          <ul>
            <li v-for="(warning, index) in result.warnings" :key="index">{{ warning }}</li>
            <li v-if="result.skippedImages">{{ t('Desteklenmeyen görseller atlandı.') }}</li>
          </ul>
        </details>
        <iframe
          class="word-import-preview"
          sandbox=""
          :title="t('Word içe aktarma önizlemesi')"
          :srcdoc="renderDocument({ title: name, content: result.html, locale })"
        ></iframe>
      </template>
    </div>
    <template #footer
      ><button class="button" @click="emit('close')">{{ t('Vazgeç') }}</button
      ><button class="button primary" :disabled="!result || busy" @click="apply">
        {{ t('İmlecin bulunduğu yere ekle') }}
      </button></template
    >
  </AppDialog>
</template>
