<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { GripVertical, ArrowUp, ArrowDown } from '@lucide/vue'
import { blockId } from '../editor/identity'
import { useEditorLocale } from '../lib/editor-locale'
const props = defineProps({ engine: Object, state: Object, frame: Object, suspended: Boolean })
const { locale } = useEditorLocale()
const box = ref(null),
  target = ref(null),
  dragging = ref(false),
  notice = ref('')
let node, doc, observer, animation, session
const tr = (a, b) => (locale.value === 'en' ? b : a)
function measure() {
  if (
    !props.engine?.editable ||
    props.suspended ||
    !node?.isConnected ||
    node.parentNode !== props.engine.root
  ) {
    box.value = null
    return
  }
  const rect = node.getBoundingClientRect()
  box.value =
    rect.bottom < 0 || rect.top > props.frame.clientHeight
      ? null
      : { top: `${Math.max(4, rect.top)}px`, left: `${Math.max(2, rect.left - 29)}px` }
}
function schedule() {
  cancelAnimationFrame(animation)
  animation = requestAnimationFrame(measure)
}
function disconnect() {
  doc?.removeEventListener('scroll', schedule, true)
  observer?.disconnect()
}
watch(
  () => [props.engine, props.state, props.frame, props.suspended],
  async () => {
    await nextTick()
    if (session && (session.revision !== props.engine?.revision || props.suspended)) cancel()
    if (dragging.value) return
    disconnect()
    node = props.engine?.context()
    while (node && node !== props.engine.root && node.parentNode !== props.engine.root)
      node = node.parentNode
    if (node === props.engine?.root) node = null
    if (node && props.frame) {
      doc = props.engine.doc
      doc.addEventListener('scroll', schedule, true)
      observer = new ResizeObserver(schedule)
      observer.observe(props.frame)
      observer.observe(props.engine.root)
    }
    measure()
  },
  { flush: 'post' },
)
function announce() {
  notice.value = tr('Blok taşındı.', 'Block moved.')
}
function move(delta) {
  if (!node) return
  const before = delta < 0 ? node.previousSibling : node.nextSibling?.nextSibling
  if ((delta < 0 && !before) || (delta > 0 && !node.nextSibling)) return
  if (props.engine.moveBlock(blockId(node), before ? blockId(before) : null)) announce()
  schedule()
}
function begin(event) {
  if (event.button !== 0 || !node || !props.engine.editable) return
  event.preventDefault()
  props.engine.rememberSelection()
  session = {
    id: blockId(node),
    revision: props.engine.revision,
    button: event.currentTarget,
    pointer: event.pointerId,
    before: null,
    valid: false,
  }
  event.currentTarget.setPointerCapture(event.pointerId)
  dragging.value = true
  document.addEventListener('keydown', cancelKey, true)
  props.engine.doc.addEventListener('keydown', cancelKey, true)
}
function cancelKey(event) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  cancel()
}
function pointerMove(event) {
  if (!session) return
  const frame = props.frame.getBoundingClientRect(),
    y = event.clientY - frame.top
  if (y < 20) props.engine.doc.defaultView.scrollBy(0, -18)
  else if (y > frame.height - 20) props.engine.doc.defaultView.scrollBy(0, 18)
  const nodes = [...props.engine.root.children].filter((n) => n !== node)
  const before = nodes.find((n) => {
    const r = n.getBoundingClientRect()
    return y < r.top + r.height / 2
  })
  session.before = before ? blockId(before) : null
  session.valid =
    event.clientX >= frame.left && event.clientX <= frame.right && y >= 0 && y <= frame.height
  const last = nodes.at(-1),
    rect = (before || last)?.getBoundingClientRect()
  target.value =
    session.valid && rect
      ? {
          top: `${Math.max(2, Math.min(frame.height - 2, before ? rect.top : rect.bottom))}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
        }
      : null
}
function end() {
  const current = session
  cancel()
  if (
    current?.valid &&
    current.revision === props.engine.revision &&
    props.engine.moveBlock(current.id, current.before)
  )
    announce()
  schedule()
}
function cancel() {
  const current = session
  session = null
  dragging.value = false
  target.value = null
  document.removeEventListener('keydown', cancelKey, true)
  props.engine?.doc.removeEventListener('keydown', cancelKey, true)
  if (current?.button.hasPointerCapture(current.pointer))
    current.button.releasePointerCapture(current.pointer)
}
onBeforeUnmount(() => {
  cancel()
  disconnect()
  cancelAnimationFrame(animation)
})
</script>
<template>
  <div
    v-if="box"
    class="studio-block-controls"
    :style="box"
    role="group"
    :aria-label="tr('Blok kontrolleri', 'Block controls')"
    @pointerdown.prevent
  >
    <button
      :title="tr('Bloğu yukarı taşı', 'Move block up')"
      :aria-label="tr('Bloğu yukarı taşı', 'Move block up')"
      @click="move(-1)"
    >
      <ArrowUp :size="13" />
    </button>
    <button
      class="studio-block-grip"
      :aria-label="tr('Bloğu sürükle; ok tuşlarıyla taşı', 'Drag block; use arrow keys to move')"
      :title="tr('Bloğu sürükle', 'Drag block')"
      @pointerdown="begin"
      @pointermove="pointerMove"
      @pointerup="end"
      @pointercancel="cancel"
      @lostpointercapture="cancel"
      @keydown.up.prevent="move(-1)"
      @keydown.down.prevent="move(1)"
      @keydown.esc.prevent="cancel"
    >
      <GripVertical :size="17" />
    </button>
    <button
      :title="tr('Bloğu aşağı taşı', 'Move block down')"
      :aria-label="tr('Bloğu aşağı taşı', 'Move block down')"
      @click="move(1)"
    >
      <ArrowDown :size="13" />
    </button>
  </div>
  <div v-if="target" class="studio-block-drop" :style="target" />
  <span class="studio-block-announcement" role="status">{{ notice }}</span>
</template>
<style>
.studio-block-controls {
  position: absolute;
  z-index: 3;
  display: flex;
  flex-direction: column;
  border: 1px solid #e1e5eb;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 2px 6px #1c274012;
  opacity: 0.6;
}
.studio-block-controls:hover,
.studio-block-controls:focus-within {
  opacity: 1;
}
.studio-block-controls button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 23px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #66748a;
  cursor: pointer;
}
.studio-block-controls button:hover {
  background: #eee9ff;
  color: #5c3ec7;
}
.studio-block-controls button:focus-visible {
  outline: 2px solid #684ad8;
  outline-offset: 1px;
}
.studio-block-controls .studio-block-grip {
  cursor: grab;
  touch-action: none;
}
.studio-block-drop {
  position: absolute;
  height: 3px;
  z-index: 4;
  background: #7456df;
  pointer-events: none;
  border-radius: 2px;
}
.studio-block-announcement {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
