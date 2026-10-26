<script setup>
import { nextTick, onBeforeUnmount, watch } from 'vue'
import { presenceColor, rangeFromPortable } from '../editor/presence.js'

// Draws collaborators' carets and selections over the editing iframe. The overlay lives
// outside <body>, so it never enters the document, clipboard or exports.
const props = defineProps({ engine: Object, state: Object, users: Array })
let doc, overlay, animation, resize
let disposed = false
const css = (value) => String(value).replace(/[^#(),.%\w\s-]/g, '')

function draw() {
  if (!overlay || !doc || props.engine?.destroyed) return
  const fragment = doc.createDocumentFragment()
  const height = doc.defaultView.innerHeight
  for (const user of (props.users || []).slice(0, 20)) {
    const range = rangeFromPortable(props.engine.root, user.selection)
    if (!range) continue
    const color = css(user.color || presenceColor(user.id))
    for (const rect of [...range.getClientRects()].slice(0, 200)) {
      if (!rect.width || rect.bottom < 0 || rect.top > height) continue
      const mark = doc.createElement('div')
      mark.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;background:${color};opacity:.18`
      fragment.append(mark)
    }
    const end = range.cloneRange()
    end.collapse(false)
    let caret = end.getBoundingClientRect()
    if (!caret.height) {
      const node = end.startContainer
      caret = (node.nodeType === 1 ? node : node.parentElement).getBoundingClientRect()
    }
    if (caret.bottom < 0 || caret.top > height) continue
    const line = doc.createElement('div')
    line.dataset.studioRemoteCaret = String(user.id)
    line.style.cssText = `position:fixed;left:${caret.left}px;top:${caret.top}px;width:2px;height:${caret.height || 18}px;background:${color}`
    const label = doc.createElement('span')
    label.textContent = String(user.name || user.id).slice(0, 40)
    label.style.cssText = `position:absolute;left:0;bottom:100%;padding:1px 5px;border-radius:4px 4px 4px 0;background:${color};color:#fff;font:600 11px/15px Arial,sans-serif;white-space:nowrap`
    line.append(label)
    fragment.append(line)
  }
  overlay.replaceChildren(fragment)
}
function schedule() {
  cancelAnimationFrame(animation)
  animation = requestAnimationFrame(draw)
}
function clear() {
  doc?.removeEventListener('scroll', schedule, true)
  doc?.defaultView?.removeEventListener('resize', schedule)
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
    overlay.dataset.studioPresence = 'true'
    overlay.style.cssText = 'pointer-events:none;position:fixed;inset:0;z-index:15;overflow:hidden'
    doc.documentElement.append(overlay)
    doc.addEventListener('scroll', schedule, true)
    doc.defaultView.addEventListener('resize', schedule)
    resize = new ResizeObserver(schedule)
    resize.observe(props.engine.root)
    schedule()
  },
  { immediate: true },
)
watch(() => [props.users, props.state], schedule, { deep: true })
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(animation)
  clear()
})
</script>
<template><span hidden></span></template>
