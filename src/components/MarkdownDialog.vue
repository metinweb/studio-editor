<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import { importMarkdown, exportMarkdown } from '../lib/markdown.js'
import { renderDocument } from '../lib/content'
const props = defineProps({ engine: Object, mode: String })
const emit = defineEmits(['close'])
const { t, locale } = useEditorLocale()
const exporting = props.mode === 'export'
const source = ref(exporting ? exportMarkdown(props.engine.getHTML()) : '')
const html = ref(''),
  error = ref(''),
  copied = ref(false)
const revision = props.engine.revision,
  bookmark = props.engine.rememberSelection()
let timer,
  epoch = 0,
  disposed = false
const title = computed(() => (exporting ? 'Markdown dışa aktar' : 'Markdown içe aktar'))
function preview() {
  error.value = ''
  try {
    html.value = importMarkdown(source.value)
  } catch (e) {
    error.value = e.message
    html.value = ''
  }
}
watch(source, () => {
  clearTimeout(timer)
  timer = setTimeout(preview, 180)
})
preview()
onBeforeUnmount(() => {
  disposed = true
  epoch++
  clearTimeout(timer)
})
async function read(event) {
  const file = event.target.files?.[0],
    run = ++epoch
  if (!file) return
  if (file.size > 800000) {
    error.value = 'Markdown dosyası çok büyük.'
    return
  }
  try {
    const text = await file.text()
    if (!disposed && run === epoch) source.value = text
  } catch {
    if (!disposed && run === epoch) error.value = 'Dosya okunamadı.'
  }
}
function insert() {
  preview()
  if (error.value || !html.value || !props.engine.editable || props.engine.destroyed) return
  if (props.engine.revision !== revision) {
    error.value = 'Belge değişti. İşlemi yeniden açın.'
    return
  }
  props.engine.restoreSelection(bookmark)
  props.engine.insert(html.value)
  emit('close')
}
function download() {
  const url = URL.createObjectURL(new Blob([source.value], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'document.md'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function copy() {
  try {
    await navigator.clipboard.writeText(source.value)
    copied.value = true
  } catch {
    error.value = 'Panoya kopyalanamadı. Metni seçip kopyalayın.'
  }
}
</script>
<template>
  <AppDialog class="writing-tool-dialog" :title="t(title)" wide @close="emit('close')">
    <div class="native-form">
      <p class="muted">
        {{
          t(
            'Başlıklar, listeler, tablolar, görevler, bağlantılar ve kod blokları desteklenir. Özel belge öğeleri dışa aktarımda HTML olarak korunur.',
          )
        }}
      </p>
      <label v-if="!exporting"
        >{{ t('Markdown dosyası')
        }}<input
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          :aria-label="t('Markdown dosyası')"
          @change="read"
      /></label>
      <div class="markdown-columns">
        <label
          >{{ t('Markdown metni')
          }}<textarea
            class="text-input markdown-source"
            v-model="source"
            :readonly="exporting"
            :aria-label="t('Markdown metni')"
            spellcheck="false"
          ></textarea>
        </label>
        <iframe
          sandbox=""
          class="markdown-preview"
          :title="t('Markdown önizlemesi')"
          :srcdoc="renderDocument({ title: 'Markdown', content: html, locale })"
        ></iframe>
      </div>
      <p v-if="error" role="alert" class="error-banner">{{ t(error) }}</p>
      <p v-if="copied" role="status">{{ t('Kopyalandı') }}</p>
    </div>
    <template #footer
      ><button class="button" @click="emit('close')">{{ t('Vazgeç') }}</button
      ><template v-if="exporting"
        ><button class="button" @click="copy">{{ t('Markdown kopyala') }}</button
        ><button class="button primary" @click="download">
          {{ t('Markdown indir') }}
        </button></template
      ><button v-else class="button primary" :disabled="!source.trim() || !!error" @click="insert">
        {{ t('İmlecin bulunduğu yere ekle') }}
      </button></template
    >
  </AppDialog>
</template>
