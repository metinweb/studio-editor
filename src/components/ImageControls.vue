<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import {
  Crop,
  SlidersHorizontal,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  LockKeyhole,
  UnlockKeyhole,
} from '@lucide/vue'

const props = defineProps({ engine: Object, state: Object, frame: Object })
const emit = defineEmits(['command', 'edit', 'properties'])
const box = ref(null)
const dragging = ref(false)
const locked = ref(true)
const toolbar = ref(null)
const toolbarPosition = ref({ left: 8, top: 8 })
const alignments = [
  { value: 'left', label: 'Görseli sola hizala', icon: AlignLeft },
  { value: 'center', label: 'Görseli ortala', icon: AlignCenter },
  { value: 'right', label: 'Görseli sağa hizala', icon: AlignRight },
]
let image = null
let resize = null
let observer = null
let frameDoc = null
let animation = 0
let alive = true
let resizeAnimation = 0
let lastPointer = null
const corners = [
  { id: 'nw', label: 'Sol üst köşe', x: -1, y: -1 },
  { id: 'ne', label: 'Sağ üst köşe', x: 1, y: -1 },
  { id: 'sw', label: 'Sol alt köşe', x: -1, y: 1 },
  { id: 'se', label: 'Sağ alt köşe', x: 1, y: 1 },
  { id: 'n', label: 'Üst kenar', x: 0, y: -1 },
  { id: 's', label: 'Alt kenar', x: 0, y: 1 },
  { id: 'w', label: 'Sol kenar', x: -1, y: 0 },
  { id: 'e', label: 'Sağ kenar', x: 1, y: 0 },
]
function measure() {
  if (!image?.isConnected || !props.frame) {
    box.value = null
    return
  }
  const rect = image.getBoundingClientRect()
  if (rect.bottom < 0 || rect.top > props.frame.clientHeight) {
    box.value = null
    return
  }
  box.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  const width = toolbar.value?.offsetWidth || Math.min(450, props.frame.clientWidth - 16)
  const height = toolbar.value?.offsetHeight || 44
  toolbarPosition.value = {
    left: Math.max(
      8,
      Math.min(rect.left + (rect.width - width) / 2, props.frame.clientWidth - width - 8),
    ),
    top:
      rect.top > height + 12
        ? rect.top - height - 12
        : rect.bottom + height + 12 < props.frame.clientHeight
          ? rect.bottom + 12
          : 8,
  }
}
function schedule() {
  cancelAnimationFrame(animation)
  animation = requestAnimationFrame(measure)
}
function disconnect() {
  observer?.disconnect()
  frameDoc?.removeEventListener('scroll', schedule, true)
  frameDoc?.removeEventListener('load', schedule, true)
}
watch(
  () => [props.state, props.engine, props.frame],
  async () => {
    await nextTick()
    if (!alive || dragging.value) return
    disconnect()
    image = props.state.image ? props.engine?.context()?.closest('img') : null
    if (image && props.frame) {
      observer = new ResizeObserver(schedule)
      observer.observe(image)
      observer.observe(props.frame)
      observer.observe(props.engine.root)
      frameDoc = props.frame.contentDocument
      frameDoc.addEventListener('scroll', schedule, true)
      frameDoc.addEventListener('load', schedule, true)
    }
    measure()
  },
  { immediate: true, flush: 'post' },
)
function begin(event, corner) {
  if (event.button !== 0 || !image) return
  const session = props.engine.beginImageResize(image)
  if (!session) return
  resize = {
    session,
    x: event.clientX,
    y: event.clientY,
    corner,
    handle: event.currentTarget,
    pointerId: event.pointerId,
  }
  dragging.value = true
  event.currentTarget.focus({ preventScroll: true })
  event.currentTarget.setPointerCapture(event.pointerId)
}
function move(event) {
  if (!resize || resize.cancelled || event.pointerId !== resize.pointerId) return
  lastPointer = { x: event.clientX, y: event.clientY, shift: event.shiftKey }
  if (!resizeAnimation) resizeAnimation = requestAnimationFrame(preview)
}
function preview() {
  resizeAnimation = 0
  if (!resize || resize.cancelled || !lastPointer) return
  const { session, corner } = resize
  const dx = (lastPointer.x - resize.x) * corner.x
  const dy = (lastPointer.y - resize.y) * corner.y
  const proportional = lastPointer.shift ? !locked.value : locked.value
  if (proportional) {
    const delta = !corner.x
      ? dy * session.ratio
      : !corner.y
        ? dx
        : (dx + dy / session.ratio) / (1 + 1 / session.ratio ** 2)
    props.engine.previewImageResize(session, session.width + delta)
  } else props.engine.previewImageResize(session, session.width + dx, session.height + dy)
  measure()
}
function finish(cancel = false) {
  if (!resize) return
  cancelAnimationFrame(resizeAnimation)
  if (!cancel) preview()
  resizeAnimation = 0
  lastPointer = null
  const current = resize
  resize = null
  dragging.value = false
  props.engine.finishImageResize(current.session, cancel || current.cancelled)
  if (current.handle.hasPointerCapture(current.pointerId))
    current.handle.releasePointerCapture(current.pointerId)
  measure()
}
function key(event) {
  if (event.key === 'Escape' && resize) {
    event.preventDefault()
    event.stopPropagation()
    // Keep capture until the physical pointerup. Releasing over the iframe on
    // Escape can make WebKit send the next toolbar click to the old handle.
    resize.cancelled = true
    cancelAnimationFrame(resizeAnimation)
    resizeAnimation = 0
    props.engine.finishImageResize(resize.session, true)
    measure()
    return
  }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || resize) return
  event.preventDefault()
  const session = props.engine.beginImageResize(image)
  if (!session) return
  const delta = (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) * (event.shiftKey ? 10 : 1)
  if (locked.value) props.engine.previewImageResize(session, session.width + delta)
  else {
    const horizontal = ['ArrowLeft', 'ArrowRight'].includes(event.key)
    props.engine.previewImageResize(
      session,
      session.width + (horizontal ? delta : 0),
      session.height + (horizontal ? 0 : delta),
    )
  }
  props.engine.finishImageResize(session)
  measure()
  event.target.focus({ preventScroll: true })
}
onBeforeUnmount(() => {
  alive = false
  finish(true)
  disconnect()
  cancelAnimationFrame(animation)
  cancelAnimationFrame(resizeAnimation)
})
</script>

<template>
  <div v-if="box" class="image-selection-layer" :class="{ resizing: dragging }">
    <div
      class="image-selection"
      :style="{
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      }"
    >
      <button
        v-for="corner in corners"
        :key="corner.id"
        :class="['image-resize-handle', corner.id]"
        :aria-label="`Görseli boyutlandır: ${corner.label}`"
        title="Sürükleyerek boyutlandır · Ok tuşları: 1 px · Shift: 10 px"
        @pointerdown.prevent="begin($event, corner)"
        @pointermove="move"
        @pointerup="finish(false)"
        @pointercancel="finish(true)"
        @lostpointercapture="finish(true)"
        @keydown="key"
        @dragstart.prevent
      ></button>
      <span class="image-dimensions" aria-live="polite"
        >{{ Math.round(box.width) }} × {{ Math.round(box.height) }} px</span
      >
    </div>
    <div
      v-if="!dragging"
      ref="toolbar"
      class="image-quick-toolbar"
      role="toolbar"
      aria-label="Görsel hızlı işlemleri"
      :style="{ left: `${toolbarPosition.left}px`, top: `${toolbarPosition.top}px` }"
    >
      <button
        class="image-edit-action"
        aria-label="Resmi düzenle"
        title="Kırp, döndür ve renkleri düzenle"
        @pointerdown.prevent
        @click="emit('edit')"
      >
        <Crop :size="17" /><span>Düzenle</span>
      </button>
      <span class="quick-separator" />
      <button
        v-for="item in alignments"
        :key="item.value"
        :aria-label="item.label"
        :title="item.label"
        @pointerdown.prevent
        @click="emit('command', 'image', { align: item.value })"
      >
        <component :is="item.icon" :size="17" />
      </button>
      <button
        v-for="width in ['25%', '50%', '100%']"
        :key="width"
        :aria-label="width"
        :title="`Genişlik: ${width}`"
        @pointerdown.prevent
        @click="emit('command', 'image', { width })"
      >
        {{ width }}
      </button>
      <span class="quick-separator" />
      <button
        aria-label="Oranı koru"
        title="Oranı koru · Shift ile geçici olarak değiştir"
        :aria-pressed="locked"
        @pointerdown.prevent
        @click="locked = !locked"
      >
        <LockKeyhole v-if="locked" :size="16" /><UnlockKeyhole v-else :size="16" />
      </button>
      <button
        aria-label="Görsel özellikleri"
        title="Görsel özellikleri"
        @pointerdown.prevent
        @click="emit('properties')"
      >
        <SlidersHorizontal :size="17" />
      </button>
      <button
        aria-label="Görseli sil"
        title="Görseli sil"
        @pointerdown.prevent
        @click="emit('command', 'removeImage')"
      >
        <Trash2 :size="17" />
      </button>
    </div>
  </div>
</template>
