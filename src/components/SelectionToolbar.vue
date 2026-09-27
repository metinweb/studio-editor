<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Bold, Italic, Underline, Link, MessageSquare, Quote } from '@lucide/vue'
import { currentRange } from '../editor/selection'
import { useEditorLocale } from '../lib/editor-locale'
const props = defineProps({
  engine: Object,
  state: Object,
  frame: Object,
  suspended: Boolean,
  formatEnabled: Boolean,
  insertEnabled: Boolean,
  reviewEnabled: Boolean,
})
const emit = defineEmits(['command', 'link', 'comment'])
const { t } = useEditorLocale()
const position = ref(null)
let doc, animation
let disposed = false
const tools = [
  { id: 'bold', label: 'Kalın', icon: Bold },
  { id: 'italic', label: 'İtalik', icon: Italic },
  { id: 'underline', label: 'Altı çizili', icon: Underline },
]
function measure() {
  const range = props.engine && currentRange(props.engine.root)
  if (
    props.suspended ||
    !props.engine?.editable ||
    !range ||
    range.collapsed ||
    !range.toString().trim()
  ) {
    position.value = null
    return
  }
  const rect = range.getBoundingClientRect(),
    frame = props.frame.getBoundingClientRect()
  if (rect.bottom < 0 || rect.top > frame.height || rect.width === 0) {
    position.value = null
    return
  }
  position.value = {
    top: `${Math.min(window.innerHeight - 48, Math.max(frame.top + 4, frame.top + rect.top - 44))}px`,
    left: `${Math.max(8, Math.min(window.innerWidth - 246, frame.left + rect.left + rect.width / 2 - 119))}px`,
  }
}
function schedule() {
  cancelAnimationFrame(animation)
  animation = requestAnimationFrame(measure)
}
function disconnect() {
  doc?.removeEventListener('scroll', schedule, true)
  window.removeEventListener('resize', schedule)
}
watch(
  () => [props.engine, props.state, props.suspended],
  async () => {
    disconnect()
    await nextTick()
    if (disposed) return
    doc = props.engine?.doc
    doc?.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    schedule()
  },
  { flush: 'post' },
)
onBeforeUnmount(() => {
  disposed = true
  disconnect()
  cancelAnimationFrame(animation)
})
</script>
<template>
  <Teleport to="body"
    ><div
      v-if="position"
      class="selection-quickbar studio-editor-scope"
      role="toolbar"
      :aria-label="t('Seçili metin araçları')"
      :style="position"
    >
      <button
        v-for="tool in formatEnabled ? tools : []"
        :key="tool.id"
        :aria-label="t('Hızlı {name}', { name: t(tool.label) })"
        :title="t(tool.label)"
        :aria-pressed="!!state[tool.id]"
        @pointerdown.prevent
        @click="emit('command', 'inline', tool.id)"
      >
        <component :is="tool.icon" :size="17" />
      </button>
      <span v-if="formatEnabled && (insertEnabled || reviewEnabled)"></span
      ><button
        v-if="insertEnabled"
        :aria-label="t('Hızlı bağlantı')"
        :title="t('Bağlantı ekle')"
        @pointerdown.prevent
        @click="emit('link')"
      >
        <Link :size="17" /></button
      ><button
        v-if="formatEnabled"
        :aria-label="t('Hızlı alıntı')"
        :title="t('Alıntı')"
        @pointerdown.prevent
        @click="emit('command', 'block', 'blockquote')"
      >
        <Quote :size="17" /></button
      ><button
        v-if="reviewEnabled"
        :aria-label="t('Hızlı yorum')"
        :title="t('Yorum ekle')"
        @pointerdown.prevent
        @click="emit('comment')"
      >
        <MessageSquare :size="17" />
      </button></div
  ></Teleport>
</template>
