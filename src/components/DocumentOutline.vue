<script setup>
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { sectionInfo } from '../editor/outline-tools.js'
import { X, ListTree, ArrowUp, ArrowDown, IndentDecrease, IndentIncrease } from '@lucide/vue'
import { useEditorLocale } from '../lib/editor-locale'
const props = defineProps({ engine: Object, frame: Object, readonly: Boolean })
const emit = defineEmits(['close'])
const { t } = useEditorLocale()
const headings = ref([]),
  active = ref(-1)
const query = ref(''),
  collapsed = ref(new Set()),
  notice = ref('')
const navigation = ref(null)
const visible = computed(() => {
  let hiddenBelow = 7
  return headings.value.filter((item) => {
    if (query.value.trim())
      return item.text.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())
    if (item.level > hiddenBelow) return false
    hiddenBelow = collapsed.value.has(item.node) ? item.level : 7
    return true
  })
})
const selected = computed(() => headings.value[active.value])
const section = computed(
  () => selected.value && sectionInfo(props.engine.root, selected.value.node),
)
function toggle(item) {
  const next = new Set(collapsed.value)
  if (next.has(item.node)) next.delete(item.node)
  else next.add(item.node)
  collapsed.value = next
}
function change(action) {
  const node = selected.value?.node
  const changed =
    action === 'up' || action === 'down'
      ? props.engine.moveSection(node, action === 'up' ? -1 : 1)
      : props.engine.changeSectionLevel(node, action === 'promote' ? -1 : 1)
  if (changed) {
    collect()
    notice.value = t('Bölüm güncellendi.')
    nextTick(() =>
      navigation.value?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' }),
    )
  }
}
function moveFromKeyboard(item, direction) {
  jump(item)
  change(direction)
}
let observer,
  frameDoc,
  animation,
  alive = true
function collect() {
  if (!props.engine || !alive) return
  headings.value = [...props.engine.root.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter((n) => !n.closest('[data-studio-toc],figure[data-studio-embed]'))
    .map((node, index, nodes) => ({
      node,
      hasChildren: Number(nodes[index + 1]?.tagName[1] || 0) > Number(node.tagName[1]),
      text: node.textContent.trim() || t('Başlıksız bölüm'),
      level: Number(node.tagName[1]),
    }))
  collapsed.value = new Set([...collapsed.value].filter((n) => n.isConnected))
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
  active.value = headings.value.length ? index : -1
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
  active.value = headings.value.findIndex((h) => h.node === item.node)
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
    <input
      class="text-input outline-search"
      v-model="query"
      :aria-label="t('Başlıklarda ara')"
      :placeholder="t('Başlıklarda ara')"
    />
    <nav ref="navigation" :aria-label="t('Bölüme git')">
      <div
        v-for="item in visible"
        :key="headings.indexOf(item)"
        class="outline-row"
        :style="{ paddingInlineStart: `${Math.min(4, item.level - 1) * 10}px` }"
      >
        <button
          v-if="item.hasChildren && !query"
          class="outline-toggle"
          :aria-label="t('Alt başlıkları aç/kapat') + ': ' + item.text"
          :aria-expanded="!collapsed.has(item.node)"
          @click="toggle(item)"
        >
          {{ collapsed.has(item.node) ? '›' : '⌄' }}
        </button>
        <button
          :aria-current="selected?.node === item.node ? 'location' : undefined"
          @click="jump(item)"
          @keydown.alt.up.prevent="moveFromKeyboard(item, 'up')"
          @keydown.alt.down.prevent="moveFromKeyboard(item, 'down')"
        >
          <small>H{{ item.level }}</small
          >{{ item.text }}
        </button>
      </div>
    </nav>
    <p v-if="!headings.length">{{ t('Belgenize başlık eklediğinizde burada görünür.') }}</p>
    <p v-else-if="!visible.length">{{ t('Sonuç yok') }}</p>
    <div v-if="selected && !readonly" class="outline-section-tools">
      <strong>{{ selected.text }}</strong>
      <p>{{ t('İşlemler alt başlıkları ve bölüm içeriğini de kapsar.') }}</p>
      <div>
        <button
          class="button"
          :aria-label="t('Bölümü yukarı taşı')"
          :disabled="!section?.previous"
          @click="change('up')"
        >
          <ArrowUp :size="15" />{{ t('Yukarı taşı') }}
        </button>
        <button
          class="button"
          :aria-label="t('Bölümü aşağı taşı')"
          :disabled="!section?.next"
          @click="change('down')"
        >
          <ArrowDown :size="15" />{{ t('Aşağı taşı') }}
        </button>
        <button
          class="button"
          :aria-label="t('Başlık düzeyini yükselt')"
          :disabled="!section?.promote"
          @click="change('promote')"
        >
          <IndentDecrease :size="15" />{{ t('Düzeyi yükselt') }}
        </button>
        <button
          class="button"
          :aria-label="t('Başlık düzeyini düşür')"
          :disabled="!section?.demote"
          @click="change('demote')"
        >
          <IndentIncrease :size="15" />{{ t('Düzeyi düşür') }}
        </button>
      </div>
      <p v-if="!section">
        {{ t('Bölüm düzenleme, belgenin ana düzeyindeki başlıklarda kullanılabilir.') }}
      </p>
    </div>
    <footer>
      <span v-if="notice" role="status">{{ notice }} · </span>{{ headings.length }}
      {{ t('başlık') }}
    </footer>
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
  overflow: hidden;
}
.native-editing-area {
  position: relative;
}
.native-canvas {
  min-width: 0;
}
.studio-outline header {
  flex-shrink: 0;
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
  flex: 1 1 auto;
  min-height: 90px;
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
.studio-outline .outline-search {
  flex-shrink: 0;
  margin: 10px;
  width: calc(100% - 20px);
}
.outline-row {
  display: flex;
  align-items: start;
}
.studio-outline nav .outline-toggle {
  flex: 0 0 22px;
  width: 22px;
  padding: 10px 3px;
}
.outline-section-tools {
  flex: 0 0 auto;
  max-height: 195px;
  overflow: auto;
  border-top: 1px solid #e0e5ec;
  padding: 12px;
  font-size: 12px;
}
.outline-section-tools strong {
  display: block;
  overflow-wrap: anywhere;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.studio-outline .outline-section-tools p {
  padding: 6px 0;
  margin: 0;
  font-size: 10px;
  line-height: 1.5;
}
.outline-section-tools > div {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.outline-section-tools .button {
  font-size: 10px;
  flex-direction: column;
  padding: 5px;
  white-space: normal;
  min-height: 42px;
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
  flex-shrink: 0;
  padding: 6px 12px;
  font-size: 10px;
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
