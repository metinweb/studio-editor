<script setup>
import { nextTick, onBeforeUnmount, watch } from 'vue'
const props = defineProps({ engine: Object, state: Object, visible: Boolean })
let overlay, doc, animation, resize
let disposed = false
function draw() {
  overlay?.replaceChildren()
  if (!props.visible || !doc || !overlay) return
  const root = props.engine.root,
    walker = doc.createTreeWalker(root, 4)
  let scanned = 0,
    shown = 0
  const fragment = doc.createDocumentFragment()
  for (
    let text = walker.nextNode();
    text && scanned < 100000 && shown < 500;
    text = walker.nextNode()
  ) {
    scanned += text.length
    if (
      !/[ \t\u00a0]/.test(text.data) ||
      text.parentElement.closest('pre,code,[contenteditable="false"]')
    )
      continue
    const box = text.parentElement.getBoundingClientRect()
    if (box.bottom < 0 || box.top > doc.defaultView.innerHeight) continue
    for (let index = 0; index < text.length && shown < 500; index++) {
      if (!/[ \t\u00a0]/.test(text.data[index])) continue
      const range = doc.createRange()
      range.setStart(text, index)
      range.setEnd(text, index + 1)
      const rect = range.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > doc.defaultView.innerHeight || !rect.width) continue
      const marker = doc.createElement('span')
      marker.textContent =
        text.data[index] === '\u00a0' ? '°' : text.data[index] === '\t' ? '→' : '·'
      marker.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;line-height:${rect.height}px;text-align:center;color:#8c78b6;font:12px/ ${rect.height}px Arial;`
      fragment.append(marker)
      shown++
    }
  }
  overlay.append(fragment)
}
function schedule() {
  cancelAnimationFrame(animation)
  animation = requestAnimationFrame(draw)
}
function clear() {
  doc?.removeEventListener('scroll', schedule, true)
  doc?.defaultView.removeEventListener('resize', schedule)
  resize?.disconnect()
  overlay?.remove()
  overlay = null
}
watch(
  () => props.engine,
  async () => {
    clear()
    await nextTick()
    if (disposed) return
    doc = props.engine?.doc
    if (!doc) return
    overlay = doc.createElement('div')
    overlay.setAttribute('aria-hidden', 'true')
    overlay.style.cssText = 'pointer-events:none;position:fixed;inset:0;z-index:20;overflow:hidden;'
    // Kept outside body, so helpers never enter the document model, clipboard or exports.
    doc.documentElement.append(overlay)
    doc.addEventListener('scroll', schedule, true)
    doc.defaultView.addEventListener('resize', schedule)
    resize = new ResizeObserver(schedule)
    resize.observe(props.engine.root)
    schedule()
  },
  { immediate: true },
)
watch(() => [props.state, props.visible], schedule)
onBeforeUnmount(() => {
  disposed = true
  clear()
  cancelAnimationFrame(animation)
})
</script>
<template><span hidden></span></template>
