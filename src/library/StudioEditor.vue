<script setup>
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onBeforeUnmount,
  provide,
  ref,
  watch,
} from 'vue'
import RichEditor from '../components/RichEditor.vue'
import { useMedia } from '../stores/media'
import { publicHtml } from '../lib/content'
import { createMediaService, mediaServiceKey } from '../lib/media-service'
import { provideEditorLocale } from '../lib/editor-locale'
import { createCommandRegistry } from '../lib/command-registry'
import { featureEnabled } from '../lib/feature-policy.js'

const SourceEditor = defineAsyncComponent(() => import('../components/SourceEditor.vue'))
const MediaManager = defineAsyncComponent(() => import('../components/MediaManager.vue'))
const props = defineProps({
  modelValue: { type: String, default: '' },
  direction: { type: String, default: 'ltr' },
  height: { type: [Number, String], default: 600 },
  mediaAdapter: Object,
  mentions: { type: Array, default: () => [] },
  allowCreateMention: Boolean,
  readonly: Boolean,
  disabled: Boolean,
  placeholder: { type: String, default: '' },
  toolbar: { type: [Boolean, Array], default: true },
  menubar: { type: [Boolean, Array], default: true },
  locale: { type: String, default: 'en' },
  messages: Object,
  pasteMode: { type: String, default: 'keep' },
  tablePasteStyle: { type: String, default: 'target' },
  contentCss: { type: [String, Array], default: () => [] },
  allowContentCss: { type: Boolean, default: true },
  assistanceAdapter: Object,
  bodyClass: { type: String, default: '' },
  features: { type: Object, default: () => ({}) },
  documentSession: Object,
})
const emit = defineEmits([
  'update:modelValue',
  'change',
  'ready',
  'save',
  'transaction',
  'paste',
  'update:pasteMode',
  'update:tablePasteStyle',
  'upload-progress',
  'upload-error',
  'update:contentCss',
  'content-css-status',
  'update:bodyClass',
])
const editor = ref(null)
const commandVersion = ref(0)
const slashCommands = computed(() => {
  commandVersion.value
  props.modelValue
  props.readonly
  props.disabled
  return commands.list().filter((command) => !command.id.startsWith('studio/'))
})
provideEditorLocale(props)
const modal = ref(null)
const locked = computed(() => props.readonly || props.disabled)
watch(
  () => props.features,
  () => {
    modal.value = null
    if (!featureEnabled(props.features, 'media')) customMedia?.cancel()
  },
  { deep: true },
)
watch(
  () => [props.readonly, props.disabled],
  () => {
    modal.value = null
    if (locked.value) customMedia?.cancel()
  },
)
const customMedia = props.mediaAdapter ? createMediaService(props.mediaAdapter) : null
const media = customMedia || useMedia()
provide(mediaServiceKey, media)
if (customMedia) {
  watch(
    () => media.progress,
    (value) => emit('upload-progress', value),
  )
  watch(
    () => media.error,
    (value) => {
      if (value) emit('upload-error', value)
    },
  )
}
onBeforeUnmount(() => customMedia?.dispose())
const height = computed(() =>
  typeof props.height === 'number' ? `${props.height}px` : props.height,
)
function changed(html) {
  emit('update:modelValue', html)
  emit('change', html)
}
function openMedia() {
  if (locked.value || !featureEnabled(props.features, 'media')) return
  editor.value?.rememberSelection()
  modal.value = 'media'
  media.initialize()
}
function insertMedia(item) {
  if (locked.value || !featureEnabled(props.features, 'media')) return
  editor.value?.insert(media.markup(item))
  modal.value = null
}
function applySource(html) {
  if (locked.value || !featureEnabled(props.features, 'source')) return
  editor.value?.replace(html)
  modal.value = null
}
const api = {
  isComposing: () => editor.value?.isComposing() || false,
  setSharedHistory: (history) => editor.value?.setSharedHistory(history),
  subscribeTransactions: (listener) => {
    transactionListeners.add(listener)
    return () => transactionListeners.delete(listener)
  },
  registerPlugin: (plugin) => {
    const remove = commands.register(plugin)
    commandVersion.value++
    return () => {
      remove()
      commandVersion.value++
    }
  },
  getCommands: () => commands.list(),
  executeCommand: (id, argument) => commands.execute(id, argument),
  refreshMedia: () =>
    editor.value?.refreshMedia(async (id) => {
      if (props.mediaAdapter?.resolve) return props.mediaAdapter.resolve(id)
      const item = media.items.find((item) => item.id === id)
      if (!item) throw new Error('Medya dosyası bulunamadı.')
      return item
    }),
  getModel: () => editor.value?.getModel(),
  setModel: (model) => editor.value?.setModel(model),
  applyOperations: (transaction) => editor.value?.applyOperations(transaction) || false,
  getHTML: () => editor.value?.getHTML() || props.modelValue,
  getPublicHTML: () => publicHtml(api.getHTML()),
  getInlineHTML: () => editor.value?.getInlineHTML() || '',
  setHTML: (html) => editor.value?.replace(html),
  insertHTML: (html) => editor.value?.insert(html),
  focus: () => editor.value?.focus(),
  undo: () => editor.value?.undo(),
  redo: () => editor.value?.redo(),
  openSource: () => {
    if (props.disabled || !featureEnabled(props.features, 'source')) return
    modal.value = 'source'
  },
  openMedia,
  openScience: () => editor.value?.openScience(),
  openContentStyles: () => editor.value?.openContentStyles(),
  openAssistant: (kind) => editor.value?.openAssistant(kind),
  openVersionHistory: () => editor.value?.openVersionHistory(),
  openPageEmbed: () => editor.value?.openPageEmbed(),
  openUiElement: (kind = 'form') => editor.value?.openUiElement(kind),
  getDocument: () => editor.value?.getDocument(),
  getHistoryStats: () => editor.value?.getHistoryStats(),
}
const transactionListeners = new Set()
function publishTransaction(transaction) {
  emit('transaction', transaction)
  for (const listener of transactionListeners) listener(transaction)
}
onBeforeUnmount(() => transactionListeners.clear())
const commands = createCommandRegistry(api, () => !!editor.value && !locked.value)
commands.register({
  id: 'studio',
  commands: [
    { id: 'undo', title: 'Undo', execute: (api) => api.undo() },
    { id: 'redo', title: 'Redo', execute: (api) => api.redo() },
    { id: 'science', title: 'Math & chemistry', execute: (api) => api.openScience() },
    {
      id: 'insert-html',
      title: 'Insert HTML',
      execute: (api, html) => api.insertHTML(String(html || '')),
    },
  ],
})
onBeforeUnmount(() => commands.dispose())
onMounted(() => media.initialize())
defineExpose(api)
</script>

<template>
  <div
    class="studio-editor-scope studio-editor-embed"
    :style="{ height }"
    @submit.stop
    @click.capture="
      (event) => {
        if (event.target.closest('button')?.getAttribute('type') === null) event.preventDefault()
      }
    "
  >
    <RichEditor
      ref="editor"
      :model-value="modelValue"
      :mentions="mentions"
      :allow-create-mention="allowCreateMention"
      :slash-commands="slashCommands"
      @slash-command="api.executeCommand($event)"
      :direction="direction"
      :readonly="readonly"
      :disabled="disabled"
      :placeholder="placeholder"
      :toolbar="toolbar"
      :menubar="menubar"
      :locale="locale"
      :messages="messages"
      :paste-mode="pasteMode"
      :table-paste-style="tablePasteStyle"
      :content-css="contentCss"
      :allow-content-css="allowContentCss"
      :assistance-adapter="assistanceAdapter"
      :body-class="bodyClass"
      :features="features"
      :document-session="documentSession"
      @update:body-class="emit('update:bodyClass', $event)"
      @update:content-css="emit('update:contentCss', $event)"
      @content-css-status="emit('content-css-status', $event)"
      @update:table-paste-style="emit('update:tablePasteStyle', $event)"
      @update:paste-mode="emit('update:pasteMode', $event)"
      @paste="emit('paste', $event)"
      @update:model-value="changed"
      @ready="emit('ready', api)"
      @save="emit('save', api.getHTML())"
      @source="api.openSource"
      @media="openMedia"
      @transaction="publishTransaction"
    />
    <SourceEditor
      v-if="modal === 'source'"
      :content="api.getHTML()"
      :readonly="locked"
      @apply="applySource"
      @close="modal = null"
    />
    <MediaManager v-if="modal === 'media'" @insert="insertMedia" @close="modal = null" />
  </div>
</template>
