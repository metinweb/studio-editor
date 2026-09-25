<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { X, ListTree } from '@lucide/vue'
import { useEditorLocale } from '../lib/editor-locale'
const props = defineProps({ engine: Object, frame: Object })
const emit = defineEmits(['close'])
const { t } = useEditorLocale()
const headings = ref([]),
  active = ref(-1)
let observer,
  frameDoc,
  animation,
  alive = true
function collect() {
  if (!props.engine || !alive) return
  headings.value = [...props.engine.root.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter((n) => !n.closest('[data-studio-toc],figure[data-studio-embed]'))
    .map((node) => ({
      node,
      text: node.textContent.trim() || t('Başlıksız bölüm'),
      level: Number(node.tagName[1]),
    }))
  follow()
}
function follow() {
  let index = headings.value.findIndex((h) =>
    h.node.contains(props.engine.doc.getSelection()?.anchorNode),
  )
  if (index < 0) {
    index = 0
    headings.value.forEach((h, i) => {
      if (h.node.getBoundingClientRect().top < 110) index = i
    })
  }
  active.value = index
}
function schedule() {
  cancelAnimationFrame(animation)
  animation = requestAnimationFrame(collect)
}
function disconnect() {
  observer?.disconnect()
  frameDoc?.removeEventListener('scroll', follow, true)
  frameDoc?.removeEventListener('selectionchange', follow)
}
watch(
  () => props.engine,
  (engine) => {
    disconnect()
    if (!engine) return
    observer = new MutationObserver(schedule)
    observer.observe(engine.root, { subtree: true, childList: true, characterData: true })
    frameDoc = engine.doc
    frameDoc.addEventListener('scroll', follow, true)
    frameDoc.addEventListener('selectionchange', follow)
    collect()
  },
  { immediate: true },
)
function jump(item) {
  if (!item.node.isConnected || props.engine.disabled) return
  props.engine.root.focus({ preventScroll: true })
  const range = props.engine.doc.createRange()
  range.selectNodeContents(item.node)
  range.collapse(true)
  const selection = props.engine.doc.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  item.node.scrollIntoView({ block: 'start', behavior: 'smooth' })
  props.engine.selectionChanged()
}
onBeforeUnmount(() => {
  alive = false
  disconnect()
  cancelAnimationFrame(animation)
})
</script>
<template>
  <aside class="studio-outline" :aria-label="t('Belge başlıkları')">
    <header>
      <ListTree :size="17" /><strong>{{ t('Belge başlıkları') }}</strong
      ><button class="icon-button" :aria-label="t('Başlık gezginini kapat')" @click="emit('close')">
        <X :size="16" />
      </button>
    </header>
    <nav :aria-label="t('Bölüme git')">
      <button
        v-for="(item, index) in headings"
        :key="index"
        :aria-current="active === index ? 'location' : undefined"
        :style="{ paddingInlineStart: `${12 + (item.level - 1) * 12}px` }"
        @click="jump(item)"
      >
        <small>H{{ item.level }}</small
        >{{ item.text }}
      </button>
    </nav>
    <p v-if="!headings.length">{{ t('Belgenize başlık eklediğinizde burada görünür.') }}</p>
    <footer>{{ headings.length }} {{ t('başlık') }}</footer>
  </aside>
</template>
<style>
.studio-outline {
  flex: 0 0 220px;
  min-width: 0;
  background: #fafbfe;
  border-inline-end: 1px solid #e0e5ec;
  display: flex;
  flex-direction: column;
  overflow: auto;
}
.native-editing-area {
  position: relative;
}
.native-canvas {
  min-width: 0;
}
.studio-outline header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font-size: 12px;
  border-bottom: 1px solid #e4e8f0;
}
.studio-outline header button {
  margin-inline-start: auto;
}
.studio-outline nav {
  padding: 8px;
  overflow: auto;
}
.studio-outline nav button {
  display: flex;
  gap: 8px;
  width: 100%;
  text-align: start;
  border: 0;
  padding: 10px;
  background: transparent;
  border-radius: 6px;
  color: #526077;
  cursor: pointer;
  overflow-wrap: anywhere;
  font: 12px/1.5 system-ui;
}
.studio-outline nav button[aria-current],
.studio-outline nav button:hover {
  background: #ece7fa;
  color: #6241a9;
}
.studio-outline nav small {
  color: #929bad;
  flex-shrink: 0;
  font-size: 9px;
  padding-top: 3px;
}
.studio-outline p,
.studio-outline footer {
  padding: 12px;
  color: #7c8696;
  font-size: 12px;
  line-height: 1.6;
}
.studio-outline footer {
  margin-top: auto;
}
@media (max-width: 700px) {
  .studio-outline {
    position: absolute;
    inset: 0 auto 0 0;
    width: min(260px, 85%);
    z-index: 30;
    box-shadow: 6px 0 24px #1c2c451a;
  }
}
</style>
