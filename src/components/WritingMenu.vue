<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { writingCommands } from '../editor/productivity'
import { useEditorLocale } from '../lib/editor-locale'
const props = defineProps({
  engine: Object,
  query: { type: String, default: null },
  frame: Object,
  extraCommands: { type: Array, default: () => [] },
})
const emit = defineEmits(['action'])
const menu = ref(null)
const { locale } = useEditorLocale()
const selected = ref(0),
  position = ref({})
const commands = computed(() =>
  [
    ...writingCommands,
    ...props.extraCommands
      .filter((c) => c.enabled !== false)
      .map((c) => ({ id: `plugin:${c.id}`, label: c.title, en: c.title, hint: '↗', action: true })),
  ].filter((c) =>
    `${c.label} ${c.en} ${c.id}`
      .toLocaleLowerCase(locale.value)
      .includes((props.query || '').toLocaleLowerCase(locale.value)),
  ),
)
watch(
  () => props.query,
  () => {
    selected.value = 0
    if (props.query === null || !props.frame) return
    const rect = props.frame.getBoundingClientRect(),
      caret = props.engine.range().getBoundingClientRect()
    position.value = {
      left: `${Math.max(8, Math.min(rect.left + caret.left, window.innerWidth - 288))}px`,
      top: `${Math.max(8, Math.min(rect.top + caret.bottom + 8, window.innerHeight - 340))}px`,
    }
  },
)
function apply(command) {
  if (command.action) {
    if (props.engine.prepareSlashAction()) emit('action', command.id)
    return
  }
  props.engine.writingBlock(command.id)
}
function key(event) {
  if (props.query === null) return false
  if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) return false
  if (event.key === 'Escape') props.engine.dismissSlash()
  else if (event.key === 'Enter') {
    if (!commands.value.length) return false
    apply(commands.value[selected.value])
  } else if (commands.value.length)
    selected.value =
      (selected.value + (event.key === 'ArrowDown' ? 1 : -1) + commands.value.length) %
      commands.value.length
  event.preventDefault()
  nextTick(() => menu.value?.querySelector('.active')?.scrollIntoView({ block: 'nearest' }))
  return true
}
defineExpose({ key })
</script>
<template>
  <Teleport to="body">
    <div
      v-if="query !== null"
      ref="menu"
      class="studio-writing-menu studio-editor-scope"
      :style="position"
      role="menu"
      :aria-label="locale === 'en' ? 'Insert block' : 'Blok ekle'"
    >
      <small>{{ locale === 'en' ? 'INSERT BLOCK · ↑ ↓ Enter' : 'BLOK EKLE · ↑ ↓ Enter' }}</small>
      <button
        v-for="(item, index) in commands"
        :key="item.id"
        role="menuitem"
        :class="{ active: selected === index }"
        @pointerdown.prevent
        @click="apply(item)"
      >
        <span>{{ locale === 'en' ? item.en : item.label }}</span
        ><kbd>{{ item.hint }}</kbd>
      </button>
      <p v-if="!commands.length" role="status">
        {{ locale === 'en' ? 'No results' : 'Sonuç yok' }}
      </p>
    </div>
  </Teleport>
</template>
<style>
.studio-writing-menu {
  position: fixed;
  width: 280px;
  max-width: calc(100vw - 16px);
  z-index: 120;
  padding: 8px;
  border: 1px solid #dce1e8;
  border-radius: 10px;
  box-shadow: 0 8px 32px #18233826;
  background: white;
  font: 13px system-ui;
  max-height: 330px;
  overflow: auto;
}
.studio-writing-menu small {
  display: block;
  padding: 8px;
  color: #64748b;
  font-size: 10px;
}
.studio-writing-menu button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 9px;
  border: 0;
  background: transparent;
  border-radius: 5px;
  text-align: start;
  cursor: pointer;
}
.studio-writing-menu button.active,
.studio-writing-menu button:hover {
  background: #eee9ff;
  color: #5c3ec7;
}
.studio-writing-menu kbd {
  color: #64748b;
  font: 11px monospace;
}
</style>
