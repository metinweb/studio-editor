<script setup>
import { computed, nextTick, ref, onBeforeUnmount } from 'vue'
import { Check, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useEditorLocale } from '../lib/editor-locale'
const props = defineProps({ items: Array, label: String })
const emit = defineEmits(['select', 'navigate'])
const { t, locale } = useEditorLocale()
const path = ref([])
const panel = ref(null)
const panes = computed(() => [{ label: props.label, children: props.items }, ...path.value])
let hoverTimer
function cancelHover() {
  clearTimeout(hoverTimer)
}
onBeforeUnmount(() => clearTimeout(hoverTimer))
const buttons = (level) => [
  ...panel.value.querySelectorAll(
    `[data-menu-level="${level}"] > button[role="menuitem"]:not(:disabled)`,
  ),
]
async function open(item, level, focus = true) {
  clearTimeout(hoverTimer)
  if (!item.children) return emit('select', item)
  path.value = [...path.value.slice(0, level), item]
  if (focus) {
    await nextTick()
    buttons(level + 1)[0]?.focus({ preventScroll: true })
  }
}
function hover(item, level, event) {
  clearTimeout(hoverTimer)
  if (event.pointerType === 'touch' || window.innerWidth < 720) return
  hoverTimer = setTimeout(() => {
    if (item.children) open(item, level, false)
    else path.value = path.value.slice(0, level)
  }, 180)
}
async function back(level) {
  clearTimeout(hoverTimer)
  const parent = path.value[level - 1]
  path.value = path.value.slice(0, level - 1)
  await nextTick()
  buttons(level - 1)
    .find((button) => button.getAttribute('aria-label') === t(parent.label))
    ?.focus({ preventScroll: true })
}
function keys(event, level) {
  clearTimeout(hoverTimer)
  const list = buttons(level),
    index = list.indexOf(event.target)
  const item = panes.value[level].children.find(
    (entry) => t(entry.label) === event.target.getAttribute('aria-label'),
  )
  if (event.key === 'Escape' && level) {
    event.preventDefault()
    event.stopPropagation()
    back(level)
    return
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    if (event.key === 'ArrowLeft' && level) back(level)
    else if (event.key === 'ArrowRight' && item?.children) open(item, level)
    else if (!level) emit('navigate', event.key === 'ArrowRight' ? 1 : -1)
    return
  }
  if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? list.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length
    list[next]?.focus()
  } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey) {
    const ordered = [...list.slice(index + 1), ...list.slice(0, index + 1)]
    const match = ordered.find((button) =>
      button
        .getAttribute('aria-label')
        .toLocaleLowerCase(locale.value)
        .startsWith(event.key.toLocaleLowerCase(locale.value)),
    )
    if (match) {
      event.preventDefault()
      match.focus()
    }
  }
}
</script>

<template>
  <div ref="panel" class="editor-menu-stack" @pointerleave="cancelHover">
    <div
      v-for="(pane, level) in panes"
      :key="pane.label"
      class="editor-menu editor-navigation-menu"
      :class="{ 'is-parent': level < panes.length - 1 }"
      :data-menu-level="level"
      role="menu"
      :aria-label="t(pane.label)"
      @keydown="keys($event, level)"
    >
      <button
        v-if="level"
        class="editor-menu-back"
        :aria-label="t('Önceki menü')"
        @click="back(level)"
      >
        <ChevronLeft :size="16" />{{ t(pane.label) }}
      </button>
      <template v-for="item in pane.children" :key="item.label">
        <div v-if="item.section" class="editor-menu-section" role="presentation">
          {{ t(item.section) }}
        </div>
        <button
          role="menuitem"
          :aria-label="t(item.label)"
          :aria-haspopup="item.children ? 'menu' : undefined"
          :aria-expanded="item.children ? path[level]?.label === item.label : undefined"
          :disabled="item.disabled"
          @pointerenter="hover(item, level, $event)"
          @click="open(item, level)"
        >
          <component v-if="item.icon" :is="item.icon" :size="17" /><span
            v-else
            class="editor-menu-icon"
          ></span
          ><span class="editor-menu-label">{{ t(item.label) }}</span
          ><kbd v-if="item.shortcut">{{ item.shortcut }}</kbd
          ><Check v-if="item.active" :size="15" /><ChevronRight v-if="item.children" :size="15" />
        </button>
      </template>
    </div>
  </div>
</template>
