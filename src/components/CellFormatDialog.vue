<script setup>
import { computed, reactive, ref } from 'vue'
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, Check, RotateCcw } from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import { validCellFormat } from '../editor/table-format'

const props = defineProps({ engine: Object, session: Object })
const emit = defineEmits(['close'])
const { t } = useEditorLocale()
const patch = reactive({})
const error = ref('')
const border = reactive({ mode: 'all', width: 1, style: 'solid', color: '#94a3b8' })
const palette = [
  '#ffffff',
  '#f1f5f9',
  '#dbeafe',
  '#dcfce7',
  '#fef3c7',
  '#ffe4e6',
  '#ede9fe',
  '#0f172a',
]
const alignments = [
  ['left', 'Sola hizala', AlignLeft],
  ['center', 'Ortala', AlignCenter],
  ['right', 'Sağa hizala', AlignRight],
  ['justify', 'İki yana yasla', AlignJustify],
]
const vertical = [
  ['top', 'Üste'],
  ['middle', 'Ortaya'],
  ['bottom', 'Alta'],
]
const borders = [
  ['all', 'Tüm kenarlar'],
  ['outer', 'Dış çerçeve'],
  ['inner', 'İç çizgiler'],
  ['none', 'Kenarlık yok'],
  ['reset', 'Varsayılan kenarlık'],
]
const changed = computed(() => Object.keys(patch).length > 0)
const valid = computed(() => changed.value && validCellFormat(patch))
function value(key) {
  return key in patch ? patch[key] : patch.reset ? '' : props.session.values[key]
}
function edit(key, next) {
  if (next === '') delete patch[key]
  else patch[key] = key === 'padding' ? Number(next) : next
}
function borderChange() {
  patch.border = { ...border }
}
function chooseBorder(mode) {
  border.mode = mode
  borderChange()
}
function reset() {
  Object.keys(patch).forEach((key) => delete patch[key])
  patch.reset = true
}
function apply() {
  if (!valid.value) return
  if (props.engine.formatCells(props.session, patch)) emit('close')
  else error.value = 'Belge değişti. Hücreleri yeniden seçip bu pencereyi açın.'
}
const preview = computed(() => {
  const style = {
    'background-color': '#ffffff',
    color: '#0f172a',
    'text-align': 'left',
    'vertical-align': 'middle',
    padding: '12px',
    border: '1px solid #cbd5e1',
  }
  for (const key of ['background-color', 'color', 'text-align', 'vertical-align', 'padding']) {
    const current = value(key)
    if (current !== null && current !== undefined && current !== '')
      style[key] = key === 'padding' && Object.hasOwn(patch, key) ? `${current}px` : current
  }
  if (patch.border)
    style.border = ['none', 'reset'].includes(border.mode)
      ? border.mode === 'none'
        ? 'none'
        : '1px solid #cbd5e1'
      : `${border.width}px ${border.style} ${border.color}`
  return style
})
</script>

<template>
  <AppDialog :title="t('Hücre biçimi')" @close="emit('close')">
    <form class="cell-format-form" @submit.prevent="apply">
      <p class="cell-format-summary">
        <b>{{ session.cells.length }}</b> {{ t('hücre seçili') }} ·
        {{ t('Yalnızca değiştirdiğiniz ayarlar uygulanır.') }}
      </p>
      <fieldset
        v-for="[key, label] in [
          ['background-color', 'Hücre dolgusu'],
          ['color', 'Hücre metin rengi'],
        ]"
        :key="key"
      >
        <legend>{{ t(label) }}</legend>
        <div class="cell-color-row">
          <button
            v-for="color in palette"
            :key="color"
            type="button"
            class="cell-swatch"
            :style="{ background: color }"
            :aria-label="`${t(label)} ${color}`"
            :aria-pressed="value(key) === color"
            @click="patch[key] = color"
          />
          <input
            :aria-label="t(label)"
            :value="patch[key] || ''"
            :placeholder="value(key) === null ? t('Karışık') : value(key) || '#rrggbb'"
            pattern="(#[0-9a-fA-F]{6}|transparent)"
            @input="edit(key, $event.target.value)"
          />
        </div>
        <button
          v-if="key === 'background-color'"
          type="button"
          class="cell-text-button"
          :aria-pressed="value(key) === 'transparent'"
          @click="patch[key] = 'transparent'"
        >
          {{ t('Şeffaf dolgu') }}
        </button>
      </fieldset>
      <div class="cell-format-columns">
        <fieldset>
          <legend>{{ t('Yatay hizalama') }}</legend>
          <div class="cell-format-segments">
            <button
              v-for="[key, label, icon] in alignments"
              :key="key"
              type="button"
              :aria-label="t(label)"
              :title="t(label)"
              :aria-pressed="value('text-align') === key"
              @click="patch['text-align'] = key"
            >
              <component :is="icon" :size="18" />
            </button>
          </div>
        </fieldset>
        <fieldset>
          <legend>{{ t('Dikey hizalama') }}</legend>
          <div class="cell-format-segments">
            <button
              v-for="[key, label] in vertical"
              :key="key"
              type="button"
              :aria-pressed="value('vertical-align') === key"
              @click="patch['vertical-align'] = key"
            >
              {{ t(label) }}
            </button>
          </div>
        </fieldset>
      </div>
      <fieldset>
        <legend>{{ t('Kenarlık') }}</legend>
        <div class="cell-format-segments cell-border-modes">
          <button
            v-for="[mode, label] in borders"
            :key="mode"
            type="button"
            :aria-pressed="patch.border?.mode === mode"
            @click="chooseBorder(mode)"
          >
            {{ t(label) }}
          </button>
        </div>
        <div class="cell-format-columns">
          <label
            >{{ t('Çizgi rengi')
            }}<input
              v-model="border.color"
              :aria-label="t('Çizgi rengi')"
              pattern="#[0-9a-fA-F]{6}"
              @input="borderChange"
          /></label>
          <label
            >{{ t('Kalınlık (px)')
            }}<input
              v-model.number="border.width"
              :aria-label="t('Kalınlık (px)')"
              type="number"
              min="0"
              max="8"
              step="1"
              @input="borderChange"
          /></label>
          <label
            >{{ t('Çizgi türü')
            }}<select v-model="border.style" :aria-label="t('Çizgi türü')" @change="borderChange">
              <option value="solid">{{ t('Düz') }}</option>
              <option value="dashed">{{ t('Kesikli') }}</option>
              <option value="dotted">{{ t('Noktalı') }}</option>
            </select></label
          >
        </div>
      </fieldset>
      <label class="cell-padding-label"
        >{{ t('İç boşluk (px)')
        }}<input
          :value="Object.hasOwn(patch, 'padding') ? patch.padding : ''"
          :placeholder="t(session.values.padding === null ? 'Karışık' : 'Değiştirme')"
          :aria-label="t('İç boşluk (px)')"
          type="number"
          min="0"
          max="48"
          step="1"
          @input="edit('padding', $event.target.value)"
      /></label>
      <div class="cell-format-preview" aria-hidden="true">
        <span>{{ t('Biçim örneği') }}</span>
        <table>
          <tbody>
            <tr>
              <td :style="preview">
                Aa<br /><small>{{ t('Örnek hücre') }}</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="patch.reset" class="cell-format-summary" role="status">
        {{ t('Hücre renkleri, hizalama, iç boşluk ve kenarlıklar varsayılana dönecek.') }}
      </p>
      <p v-if="error" role="alert">{{ t(error) }}</p>
      <div class="cell-format-footer">
        <button type="button" class="button" @click="reset">
          <RotateCcw :size="15" />{{ t('Hücre biçimini sıfırla') }}</button
        ><button type="button" class="button" @click="emit('close')">{{ t('Vazgeç') }}</button
        ><button type="submit" class="button primary" :disabled="!valid">
          <Check :size="15" />{{ t('Hücrelere uygula') }}
        </button>
      </div>
    </form>
  </AppDialog>
</template>
