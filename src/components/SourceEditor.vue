<script setup>
import { useEditorLocale } from '../lib/editor-locale'
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { html } from '@codemirror/lang-html'
import { oneDark } from '@codemirror/theme-one-dark'
import { Check, Code2 } from '@lucide/vue'
import AppDialog from './AppDialog.vue'

const props = defineProps({ content: String, readonly: Boolean })
const { t } = useEditorLocale()
const emit = defineEmits(['apply', 'close'])
const element = ref(null)
const changed = ref(false)
let editor

onMounted(() => {
  editor = new EditorView({
    doc: props.content,
    extensions: [
      basicSetup,
      html(),
      oneDark,
      EditorView.lineWrapping,
      EditorState.readOnly.of(props.readonly),
      EditorView.editable.of(!props.readonly),
      EditorView.contentAttributes.of({ 'aria-label': t('HTML kaynak kodu') }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) changed.value = editor.state.doc.toString() !== props.content
      }),
      EditorView.theme({
        '&': { height: '100%', color: '#c7cfdb' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'Consolas, monospace', fontSize: '13px' },
        '.cm-content': { padding: '20px 0', color: '#c7cfdb', caretColor: '#c6b3e3' },
      }),
    ],
    parent: element.value,
  })
})
onBeforeUnmount(() => editor?.destroy())
watch(
  () => t('HTML kaynak kodu'),
  (label) => editor?.contentDOM.setAttribute('aria-label', label),
)
function close() {
  if (
    !changed.value ||
    window.confirm(t('Kaynak kodundaki uygulanmamış değişiklikler silinsin mi?'))
  )
    emit('close')
}
</script>

<template>
  <AppDialog :title="t('Kaynak kodu')" wide @close="close">
    <template #eyebrow
      ><span class="eyebrow">{{ t('HTML EDİTÖRÜ') }}</span></template
    >
    <div class="code-toolbar">
      <span><Code2 :size="15" /> {{ t('HTML · CSS · JavaScript renklendirme') }}</span
      ><span>{{ t('Ctrl / ⌘ + F ile ara') }}</span>
    </div>
    <div ref="element" class="code-editor"></div>
    <template #footer>
      <p class="muted footer-note">
        {{ t('Uygulamada betikler ve güvenli olmayan HTML temizlenir.') }}
      </p>
      <button class="button" @click="close">{{ t('Vazgeç') }}</button>
      <button
        v-if="!readonly"
        class="button primary"
        @click="emit('apply', editor.state.doc.toString())"
      >
        <Check :size="16" /> {{ t('Değişiklikleri uygula') }}
      </button>
    </template>
  </AppDialog>
</template>
