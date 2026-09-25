<script setup>
import { computed, ref, watch, onBeforeUnmount, onMounted, nextTick } from 'vue'
import { useEditorLocale } from '../lib/editor-locale'
import { validMention } from '../editor/writing-widgets.js'
const props = defineProps({
  engine: Object,
  frame: Object,
  query: { type: String, default: null },
  mentions: { type: Array, default: () => [] },
  allowCreate: Boolean,
})
const { t, locale } = useEditorLocale()
const selected = ref(0),
  position = ref({}),
  menu = ref(null)
const entries = computed(() => {
  if (props.query === null) return []
  const existing = [...props.engine.root.querySelectorAll('span[data-studio-mention]')].map(
    (n) => ({ id: n.dataset.studioMention, label: n.dataset.studioMentionLabel }),
  )
  const all = new Map(
    [...props.mentions, ...existing]
      .filter((n) => validMention(n?.id, n?.label))
      .map((n) => [n.id, n]),
  )
  const query = props.query.trim().toLocaleLowerCase(locale.value)
  const result = [...all.values()]
    .filter((n) => n.label.toLocaleLowerCase(locale.value).includes(query))
    .slice(0, 20)
  if (
    props.allowCreate &&
    query &&
    ![...all.values()].some((n) => n.label.toLocaleLowerCase(locale.value) === query)
  )
    result.push({ id: null, label: props.query.trim(), create: true })
  return result
})
function place() {
  if (props.query === null || !props.frame) return
  const frame = props.frame.getBoundingClientRect(),
    caret = props.engine.range().getBoundingClientRect()
  position.value = {
    left: `${Math.max(8, Math.min(frame.left + caret.left, window.innerWidth - 288))}px`,
    top: `${Math.max(8, Math.min(frame.top + caret.bottom + 8, window.innerHeight - 310))}px`,
  }
}
watch(
  () => props.query,
  () => {
    selected.value = 0
    place()
  },
)
watch(
  () => props.frame,
  (frame, old) => {
    old?.contentDocument?.removeEventListener('scroll', place, true)
    frame?.contentDocument?.addEventListener('scroll', place, true)
  },
)
onMounted(() => window.addEventListener('resize', place))
onBeforeUnmount(() => {
  window.removeEventListener('resize', place)
  props.frame?.contentDocument?.removeEventListener('scroll', place, true)
})
function apply(item) {
  props.engine.insertMention({ id: item.id || `local:${crypto.randomUUID()}`, label: item.label })
}
async function key(event) {
  // This handler is exposed synchronously below; scrolling can wait for Vue.
  await nextTick()
  menu.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
}
function handleKey(event) {
  if (props.query === null || !['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key))
    return false
  if (event.key === 'Escape') props.engine.dismissMention()
  else if (event.key === 'Enter') {
    if (!entries.value.length) return false
    apply(entries.value[selected.value] || entries.value[0])
  } else if (entries.value.length)
    selected.value =
      (selected.value + (event.key === 'ArrowDown' ? 1 : -1) + entries.value.length) %
      entries.value.length
  event.preventDefault()
  key(event)
  return true
}
defineExpose({ key: handleKey })
</script>
<template>
  <Teleport to="body">
    <div
      v-if="query !== null"
      ref="menu"
      class="studio-mention-menu studio-editor-scope"
      :style="position"
      role="listbox"
      :aria-label="t('Bahsetme önerileri')"
    >
      <small>{{ t('BAHSET · ↑ ↓ Enter') }}</small>
      <button
        v-for="(item, index) in entries"
        :key="item.id || 'new'"
        role="option"
        :aria-selected="selected === index"
        @pointerdown.prevent
        @click="apply(item)"
      >
        <span class="mention-avatar" aria-hidden="true">@</span
        ><span
          ><strong>{{ item.label }}</strong
          ><small v-if="item.create">{{ t('Yerel bahsetme olarak ekle') }}</small></span
        >
      </button>
      <p v-if="!entries.length">
        {{
          t(
            allowCreate
              ? 'Bir ad yazın; bu belgede bahsetme olarak saklansın.'
              : 'Eşleşen kişi bulunamadı.',
          )
        }}
      </p>
    </div>
  </Teleport>
</template>
<style>
.studio-mention-menu {
  position: fixed;
  width: 280px;
  max-width: calc(100vw - 16px);
  max-height: 300px;
  overflow: auto;
  z-index: 121;
  border: 1px solid #dce1e8;
  border-radius: 10px;
  padding: 8px;
  background: white;
  box-shadow: 0 8px 32px #18233826;
  font: 13px system-ui;
}
.studio-mention-menu > small {
  display: block;
  padding: 8px;
  color: #657185;
  font-size: 10px;
}
.studio-mention-menu button {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  text-align: start;
  border: 0;
  background: transparent;
  padding: 9px;
  border-radius: 6px;
  cursor: pointer;
}
.studio-mention-menu button[aria-selected='true'],
.studio-mention-menu button:hover {
  background: #eee9ff;
  color: #5c3ec7;
}
.studio-mention-menu button small {
  display: block;
  color: #657185;
  margin-top: 3px;
}
.mention-avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e6def9;
  color: #6542b0;
}
.studio-mention-menu p {
  padding: 8px;
  color: #657185;
  line-height: 1.5;
}
</style>
