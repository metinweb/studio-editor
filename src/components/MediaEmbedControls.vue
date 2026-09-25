<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { Film, Trash2, AlignLeft, AlignCenter, AlignRight } from '@lucide/vue'
import { readMediaEmbed } from '../lib/media-embed.js'
import { useEditorLocale } from '../lib/editor-locale'
const { t } = useEditorLocale()
const props = defineProps({ engine: Object, state: Object, frame: Object, suspended: Boolean })
const emit = defineEmits(['edit'])
const box = ref(null)
const toolbar = ref(null)
const position = ref({})
const dragging = ref(false)
let target,
  observer,
  doc,
  session,
  animation,
  alive = true
function measure() {
  if (!target?.isConnected || !props.frame) {
    box.value = null
    return
  }
  const rect = target.getBoundingClientRect()
  if (rect.bottom < 0 || rect.top > props.frame.clientHeight) {
    box.value = null
    return
  }
  box.value = {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
  const width = toolbar.value?.offsetWidth || 370
  const height = toolbar.value?.offsetHeight || 44
  position.value = {
    left: `${Math.max(4, Math.min(rect.left, props.frame.clientWidth - width - 4))}px`,
    top: `${Math.max(4, rect.top - height - 8)}px`,
  }
}
function schedule() {
  cancelAnimationFrame(animation)
  animation = requestAnimationFrame(measure)
}
function disconnect() {
  observer?.disconnect()
  doc?.removeEventListener('scroll', schedule, true)
}
watch(
  () => [props.state, props.frame],
  async () => {
    await nextTick()
    if (!alive || session) return
    disconnect()
    target = props.state.mediaEmbed
      ? props.engine?.context()?.closest('figure[data-studio-embed]')
      : null
    if (target) {
      doc = props.engine.doc
      observer = new ResizeObserver(schedule)
      observer.observe(target)
      observer.observe(props.frame)
      observer.observe(props.engine.root)
      doc.addEventListener('scroll', schedule, true)
    }
    measure()
  },
  { immediate: true, flush: 'post' },
)
function update(options) {
  const media = readMediaEmbed(target)
  if (media) props.engine.updateEmbed(target, media.url, { ...media, ...options })
}
function start(event) {
  if (event.button !== 0 || !target || !props.engine.editable) return
  const media = readMediaEmbed(target)
  const parentStyle = props.engine.doc.defaultView.getComputedStyle(target.parentElement)
  session = {
    node: target,
    media,
    style: target.getAttribute('style'),
    x: event.clientX,
    width: target.getBoundingClientRect().width,
    parent:
      target.parentElement.clientWidth -
      parseFloat(parentStyle.paddingLeft || 0) -
      parseFloat(parentStyle.paddingRight || 0),
    handle: event.currentTarget,
    pointer: event.pointerId,
  }
  session.handle.setPointerCapture(event.pointerId)
  dragging.value = true
  window.addEventListener('keydown', cancelKey, true)
  props.engine.doc.addEventListener('keydown', cancelKey, true)
}
function move(event) {
  if (!session) return
  const multiplier = session.media.align === 'right' ? -1 : session.media.align === 'center' ? 2 : 1
  session.next = Math.round(
    Math.min(
      100,
      Math.max(
        25,
        ((session.width + (event.clientX - session.x) * multiplier) / session.parent) * 100,
      ),
    ),
  )
  session.node.style.width = `${session.next}%`
  measure()
}
function finish(cancel = false) {
  if (!session) return
  const value = session
  session = null
  value.node.setAttribute('style', value.style)
  if (value.handle.hasPointerCapture(value.pointer))
    value.handle.releasePointerCapture(value.pointer)
  window.removeEventListener('keydown', cancelKey, true)
  props.engine.doc.removeEventListener('keydown', cancelKey, true)
  dragging.value = false
  if (!cancel && value.next && props.engine.editable && value.node.isConnected)
    props.engine.updateEmbed(value.node, value.media.url, { ...value.media, width: value.next })
  measure()
}
function cancelKey(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    finish(true)
  }
}
function keyboardResize(event) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault()
  update({ width: (readMediaEmbed(target)?.width || 100) + (event.key === 'ArrowRight' ? 5 : -5) })
}
onBeforeUnmount(() => {
  alive = false
  finish(true)
  disconnect()
  cancelAnimationFrame(animation)
})
</script>
<template>
  <template v-if="box && !suspended">
    <div class="embed-selection" :style="box">
      <button
        class="embed-resize"
        :aria-label="t('Medya genişliğini değiştir')"
        :title="t('Sürükleyin veya ok tuşlarını kullanın')"
        @pointerdown.stop.prevent="start"
        @pointermove="move"
        @pointerup="finish(false)"
        @pointercancel="finish(true)"
        @lostpointercapture="finish(true)"
        @keydown="keyboardResize"
      />
    </div>
    <div
      v-show="!dragging"
      ref="toolbar"
      class="embed-floating"
      role="toolbar"
      :aria-label="t('Gömülü medya araçları')"
      :style="position"
      @pointerdown.prevent
    >
      <button
        :aria-label="t('Gömülü medyayı düzenle')"
        :title="t('Önizleme ve özellikler')"
        @click="emit('edit', target)"
      >
        <Film :size="18" />
      </button>
      <button
        v-for="item in [
          { id: 'left', icon: AlignLeft, title: 'Medyayı sola hizala' },
          { id: 'center', icon: AlignCenter, title: 'Medyayı ortala' },
          { id: 'right', icon: AlignRight, title: 'Medyayı sağa hizala' },
        ]"
        :key="item.id"
        :aria-label="t(item.title)"
        :title="t(item.title)"
        :aria-pressed="state.mediaEmbed?.align === item.id"
        @click="update({ align: item.id })"
      >
        <component :is="item.icon" :size="17" />
      </button>
      <button
        v-for="width in [50, 75, 100]"
        :key="width"
        :aria-label="`${t('Medya genişliği')} ${width}%`"
        :aria-pressed="state.mediaEmbed?.width === width"
        @click="update({ width })"
      >
        {{ width }}%
      </button>
      <button
        :aria-label="t('Gömülü medyayı sil')"
        :title="t('Gömülü medyayı sil')"
        @click="engine.removeEmbed(target)"
      >
        <Trash2 :size="17" />
      </button>
    </div>
  </template>
</template>
<style>
.embed-selection {
  position: absolute;
  pointer-events: none;
  outline: 3px solid #b4a1ed;
  border-radius: 10px;
  z-index: 8;
  box-sizing: border-box;
}
.embed-resize {
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 13px;
  height: 13px;
  border: 2px solid white;
  border-radius: 3px;
  background: #7551c5;
  pointer-events: auto;
  cursor: ew-resize;
  touch-action: none;
}
.embed-floating {
  position: absolute;
  display: flex;
  flex-wrap: wrap;
  max-width: calc(100% - 8px);
  gap: 2px;
  padding: 5px;
  border: 1px solid #d9dfe8;
  border-radius: 10px;
  background: white;
  box-shadow: 0 5px 20px #172b4d24;
  z-index: 12;
}
.embed-floating button {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #394762;
  border-radius: 5px;
  min-width: 30px;
  height: 32px;
  font: 12px system-ui;
  cursor: pointer;
}
.embed-floating button:hover,
.embed-floating button[aria-pressed='true'] {
  background: #eee8fb;
  color: #6140aa;
}
</style>
