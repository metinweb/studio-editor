<script setup>
import { useEditorLocale } from '../lib/editor-locale'
const { t } = useEditorLocale()
import { ref } from 'vue'
import { Check, Pipette, RotateCcw } from '@lucide/vue'
import EditorPopover from './EditorPopover.vue'

const props = defineProps({ anchor: Object, label: String, value: String, highlight: Boolean })
const emit = defineEmits(['close', 'select'])
const custom = ref(/^#[a-f\d]{6}$/i.test(props.value) ? props.value : '#2563eb')
const colors = [
  '#000000',
  '#334155',
  '#64748b',
  '#94a3b8',
  '#cbd5e1',
  '#e2e8f0',
  '#f1f5f9',
  '#ffffff',
  '#991b1b',
  '#9a3412',
  '#854d0e',
  '#166534',
  '#115e59',
  '#1e40af',
  '#5b21b6',
  '#9d174d',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#f87171',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#2dd4bf',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#fee2e2',
  '#ffedd5',
  '#fef9c3',
  '#dcfce7',
  '#ccfbf1',
  '#dbeafe',
  '#ede9fe',
  '#fce7f3',
]
function navigate(event) {
  const offset = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 }[event.key]
  if (!offset && !['Home', 'End'].includes(event.key)) return
  const buttons = [...event.currentTarget.querySelectorAll('button')]
  const index = buttons.indexOf(event.target)
  event.preventDefault()
  buttons[
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (index + offset + buttons.length) % buttons.length
  ]?.focus()
}
function applyCustom() {
  if (/^#[a-f\d]{6}$/i.test(custom.value)) emit('select', custom.value.toLowerCase())
}
</script>

<template>
  <EditorPopover :anchor="anchor" :label="`${label} paleti`" @close="emit('close')">
    <div class="color-palette">
      <div class="palette-heading">
        {{ label }}
        <span>{{
          value === 'inherit' ? 'Varsayılan' : value === 'transparent' ? 'Şeffaf' : value
        }}</span>
      </div>
      <div class="palette-grid" role="menu" :aria-label="label" @keydown="navigate">
        <button
          v-for="color in colors"
          :key="color"
          role="menuitemradio"
          :aria-label="color"
          :aria-checked="value === color"
          :title="color"
          :style="{ backgroundColor: color }"
          @click="emit('select', color)"
        >
          <Check v-if="value === color" :size="16" />
        </button>
      </div>
      <button class="palette-reset" @click="emit('select', highlight ? 'transparent' : 'inherit')">
        <RotateCcw :size="15" /> {{ t(highlight ? 'Vurguyu kaldır' : 'Varsayılan metin rengi') }}
      </button>
      <form class="palette-custom" @submit.prevent="applyCustom">
        <label class="palette-picker" :title="t('Özel renk seç')">
          <Pipette :size="17" /><input
            v-model="custom"
            type="color"
            :aria-label="t('Özel renk seç')"
          />
        </label>
        <input
          v-model="custom"
          :aria-label="t('Hex renk kodu')"
          placeholder="#2563eb"
          pattern="#[a-fA-F0-9]{6}"
          required
          spellcheck="false"
          maxlength="7"
        />
        <button type="submit" :aria-label="t('Özel rengi uygula')" :title="t('Özel rengi uygula')">
          <Check :size="18" />
        </button>
      </form>
    </div>
  </EditorPopover>
</template>
