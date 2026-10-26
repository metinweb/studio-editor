<script setup>
import { nextTick, onBeforeUnmount, watch } from 'vue'
import { useEditorLocale } from '../lib/editor-locale'
import { useEditorTheme } from '../lib/theme.js'
import { pageAt, pageBox, pageBreaks } from '../lib/page-layout.js'
import { overlayFrame } from './overlay-frame.js'

// Shows the editing body as sheets of the print page size, with computed page boundaries.
// Everything lives outside <body>: documents, history and exports are not affected.
const props = defineProps({ engine: Object, state: Object, enabled: Boolean, settings: Object })
const emit = defineEmits(['pages'])
const { t } = useEditorLocale()
const theme = useEditorTheme()
let doc, style, overlay, resize, animation
let disposed = false

function clear() {
  cancelAnimationFrame(animation)
  resize?.disconnect()
  resize = null
  style?.remove()
  overlay?.remove()
  style = overlay = null
  doc?.defaultView?.removeEventListener('resize', schedule)
  if (doc?.body) doc.body.style.minHeight = ''
  emit('pages', null)
}
function schedule() {
  cancelAnimationFrame(animation)
  animation = overlayFrame(props.engine, draw, 'page view')
}
function install() {
  clear()
  doc = props.engine?.doc
  if (!props.enabled || !doc?.head || props.engine.destroyed) return
  const box = pageBox(props.settings)
  const dark = theme.value === 'dark'
  style = doc.createElement('style')
  style.dataset.studioPageView = 'true'
  style.textContent = `html{background:${dark ? '#151a22' : '#e9edf2'}}body{box-sizing:border-box;width:${box.width}px;max-width:none;margin:28px auto 56px;padding:${box.margin}px;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.16),0 8px 24px rgba(15,23,42,.08)}body[data-empty="true"]::before{top:${box.margin}px;left:${box.margin}px;right:${box.margin}px}`
  doc.head.append(style)
  overlay = doc.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none'
  doc.documentElement.append(overlay)
  resize = new ResizeObserver(schedule)
  resize.observe(props.engine.root)
  doc.defaultView.addEventListener('resize', schedule)
  schedule()
}
function draw() {
  if (!overlay || !doc || props.engine?.destroyed) return
  const root = props.engine.root
  const box = pageBox(props.settings)
  const scroll = doc.defaultView.scrollY
  const bodyRect = root.getBoundingClientRect()
  const contentTop = bodyRect.top + scroll + box.margin
  const blocks = [...root.children].map((block) => {
    const rect = block.getBoundingClientRect()
    return {
      top: rect.top + scroll - contentTop,
      bottom: rect.bottom + scroll - contentTop,
      forced: block.matches('hr[data-studio-page-break]'),
    }
  })
  const contentHeight = box.height - box.margin * 2
  const breaks = pageBreaks(blocks, contentHeight)
  // The sheet ends on a page boundary.
  const last = breaks.at(-1) || 0
  root.style.minHeight = `${Math.ceil(last + contentHeight + box.margin * 2)}px`
  const fragment = doc.createDocumentFragment()
  const left = bodyRect.left + doc.defaultView.scrollX
  breaks.forEach((offset, index) => {
    const line = doc.createElement('div')
    line.style.cssText = `position:absolute;left:${left}px;top:${contentTop + offset}px;width:${bodyRect.width}px;border-top:1px dashed #9aa7b8`
    const label = doc.createElement('span')
    label.textContent = t('Sayfa {page}', { page: index + 2 })
    label.style.cssText =
      'position:absolute;right:6px;top:-9px;padding:0 6px;background:#fff;color:#7a8698;font:11px/16px Arial,sans-serif'
    line.append(label)
    fragment.append(line)
  })
  overlay.replaceChildren(fragment)
  const selection = doc.getSelection()
  let current = 1
  if (selection?.rangeCount && root.contains(selection.anchorNode)) {
    // Collapsed ranges at element boundaries have no box; use the caret's element then.
    let rect = selection.getRangeAt(0).getBoundingClientRect()
    if (!rect.height) {
      let node = selection.anchorNode
      if (node === root)
        node = root.childNodes[Math.min(selection.anchorOffset, root.childNodes.length - 1)] || root
      rect = (node.nodeType === 1 ? node : node.parentElement).getBoundingClientRect()
    }
    current = pageAt(breaks, rect.top + scroll - contentTop)
  }
  emit('pages', { current, total: breaks.length + 1 })
}
watch(
  () => [props.engine, props.enabled, props.settings, theme.value],
  async () => {
    await nextTick()
    if (!disposed) install()
  },
  { immediate: true, deep: true },
)
watch(
  () => props.state,
  () => {
    if (overlay) schedule()
  },
)
onBeforeUnmount(() => {
  disposed = true
  clear()
})
</script>
<template><span hidden></span></template>
