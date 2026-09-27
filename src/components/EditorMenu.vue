<script setup>
import { computed, nextTick, ref } from 'vue'
import { Check, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useEditorLocale } from '../lib/editor-locale'
const props = defineProps({ items: Array, label: String })
const emit = defineEmits(['select', 'navigate'])
const { t, locale } = useEditorLocale()
const path = ref([])
const panel = ref(null)
const current = computed(() => path.value.at(-1)?.children || props.items)
const title = computed(() => path.value.at(-1)?.label || props.label)
const buttons = () => [...panel.value.querySelectorAll('[role="menuitem"]:not(:disabled)')]
async function open(item) {
  if (!item.children) return emit('select', item)
  path.value.push(item)
  await nextTick()
  buttons()[0]?.focus()
}
async function back() {
  const parent = path.value.pop()
  await nextTick()
  buttons()
    .find((button) => button.getAttribute('aria-label') === t(parent.label))
    ?.focus()
}
function keys(event) {
  const list = buttons()
  const index = list.indexOf(event.target)
  const item = current.value.find(
    (entry) => t(entry.label) === event.target.getAttribute('aria-label'),
  )
  if (event.key === 'Escape' && path.value.length) {
    event.preventDefault()
    event.stopPropagation()
    back()
    return
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    if (event.key === 'ArrowLeft' && path.value.length) back()
    else if (event.key === 'ArrowRight' && item?.children) open(item)
    else if (!path.value.length) emit('navigate', event.key === 'ArrowRight' ? 1 : -1)
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
  <div
    ref="panel"
    class="editor-menu editor-navigation-menu"
    role="menu"
    :aria-label="t(title)"
    @keydown="keys"
  >
    <button
      v-if="path.length"
      class="editor-menu-back"
      :aria-label="t('Önceki menü')"
      @click="back"
    >
      <ChevronLeft :size="16" />{{ t(title) }}
    </button>
    <template v-for="item in current" :key="item.label">
      <div v-if="item.section" class="editor-menu-section" role="presentation">
        {{ t(item.section) }}
      </div>
      <button
        role="menuitem"
        :aria-label="t(item.label)"
        :aria-haspopup="item.children ? 'menu' : undefined"
        :aria-expanded="item.children ? false : undefined"
        :disabled="item.disabled"
        @click="open(item)"
      >
        <component v-if="item.icon" :is="item.icon" :size="17" /><span
          v-else
          class="editor-menu-icon"
        ></span>
        <span class="editor-menu-label">{{ t(item.label) }}</span>
        <kbd v-if="item.shortcut">{{ item.shortcut }}</kbd
        ><Check v-if="item.active" :size="15" /><ChevronRight v-if="item.children" :size="15" />
      </button>
    </template>
  </div>
</template>
