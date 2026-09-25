<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

const props = defineProps({ anchor: Object, label: String })
const emit = defineEmits(['close'])
const panel = ref(null)
const position = ref({ left: '0px', top: '0px', visibility: 'hidden' })
let observer, resizeFrame
let editorDocuments = []
watch(
  () => props.anchor,
  () => nextTick(place),
)
function place() {
  if (!props.anchor?.isConnected || !panel.value) return
  const rect = props.anchor.getBoundingClientRect()
  const box = panel.value.getBoundingClientRect()
  position.value = {
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - box.width - 8))}px`,
    top: `${Math.max(8, rect.bottom + box.height + 8 > window.innerHeight ? rect.top - box.height - 4 : rect.bottom + 4)}px`,
    visibility: 'visible',
  }
}
function outside(event) {
  if (!panel.value?.contains(event.target) && !props.anchor?.contains(event.target)) emit('close')
}
function escape(event) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  props.anchor?.focus()
  emit('close')
}
function blur() {
  // A click inside the editing iframe does not bubble into the parent document.
  if (document.activeElement?.tagName === 'IFRAME') emit('close')
}
onMounted(async () => {
  await nextTick()
  place()
  await nextTick()
  const initial =
    panel.value?.querySelector('[aria-checked="true"]') ||
    panel.value?.querySelector('input, button:not(:disabled)')
  initial?.focus({ preventScroll: true })
  if (!panel.value) return
  observer = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(place)
  })
  observer.observe(panel.value)
  window.addEventListener('resize', place)
  window.addEventListener('scroll', place, true)
  window.addEventListener('pointerdown', outside)
  window.addEventListener('blur', blur)
  editorDocuments = [...document.querySelectorAll('.studio-editor-frame')]
    .map((frame) => frame.contentDocument)
    .filter(Boolean)
  editorDocuments.forEach((doc) => doc.addEventListener('pointerdown', outside))
})
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(resizeFrame)
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', place, true)
  window.removeEventListener('pointerdown', outside)
  window.removeEventListener('blur', blur)
  editorDocuments.forEach((doc) => doc.removeEventListener('pointerdown', outside))
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="panel"
      class="editor-popover studio-editor-scope"
      :style="position"
      :aria-label="label"
      @keydown.esc="escape"
    >
      <slot />
    </div>
  </Teleport>
</template>
