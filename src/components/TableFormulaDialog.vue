<script setup>
import { ref, computed } from 'vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import { tableShape, calculateTable, cellAddress } from '../lib/table-formulas.js'
import { selectRange } from '../editor/selection'
const props = defineProps({ engine: Object })
const emit = defineEmits(['close'])
const { t } = useEditorLocale()
const cell = props.engine.context()?.closest('td,th')
const table = cell?.closest('table')
const widget = cell?.querySelector('[data-studio-formula]')
const revision = props.engine.revision
const expression = ref(widget?.dataset.studioFormula || '=SUM(A1:A2)')
const precision = ref(Number(widget?.dataset.studioFormulaPrecision ?? 2))
const error = ref('')
const address = cell ? cellAddress(cell.parentElement.rowIndex, cell.cellIndex) : ''
const shape = table && tableShape(table)
const result = computed(() =>
  table && cell
    ? calculateTable(table, { cell, expression: expression.value })(cell)
    : { error: '#TABLE!' },
)
const visibleRows = table ? [...table.rows].slice(0, 10) : []
function valid() {
  if (
    !props.engine.editable ||
    props.engine.destroyed ||
    props.engine.revision !== revision ||
    !cell?.isConnected
  ) {
    error.value = 'Belge değişti. İşlemi yeniden açın.'
    return false
  }
  return true
}
function apply() {
  if (!valid() || !shape || result.value.error) return
  props.engine.transaction(() => {
    const span = props.engine.doc.createElement('span')
    span.dataset.studioFormula = expression.value.trim()
    span.textContent = String(result.value.value)
    span.dataset.studioFormulaShape = shape
    span.dataset.studioFormulaPrecision = String(
      Math.max(0, Math.min(8, Math.floor(Number(precision.value) || 0))),
    )
    cell.replaceChildren(span)
    const caret = props.engine.doc.createRange()
    caret.setStartAfter(span)
    caret.collapse(true)
    selectRange(props.engine.root, caret)
  }, 'tableFormula')
  emit('close')
}
function freeze() {
  if (!valid() || !widget) return
  props.engine.transaction(
    () => widget.replaceWith(props.engine.doc.createTextNode(widget.textContent)),
    'freezeFormula',
  )
  emit('close')
}
</script>
<template>
  <AppDialog class="writing-tool-dialog" :title="t('Tablo formülü')" wide @close="emit('close')">
    <form id="table-formula" class="native-form" @submit.prevent="apply">
      <p>
        <strong>{{ t('Hedef hücre') }}: {{ address }}</strong> ·
        {{ t('Formül bu hücrenin içeriğini değiştirir.') }}
      </p>
      <p v-if="!shape" class="error-banner" role="alert">
        {{
          t(
            'Formüller en fazla 5.000 hücreli, birleşik hücre içermeyen dikdörtgen tablolarda kullanılabilir.',
          )
        }}
      </p>
      <label class="field-label"
        >{{ t('Formül')
        }}<input
          v-model="expression"
          class="text-input"
          :aria-label="t('Formül')"
          maxlength="500"
          spellcheck="false"
      /></label>
      <div class="formula-functions">
        <button
          v-for="name in ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'ROUND', 'ABS']"
          :key="name"
          type="button"
          class="button"
          @click="
            expression =
              name === 'ROUND'
                ? '=ROUND(A1,2)'
                : name === 'ABS'
                  ? '=ABS(A1)'
                  : '=' + name + '(A1:A2)'
          "
        >
          {{ name }}
        </button>
      </div>
      <p class="muted">
        {{
          t(
            'A1 hücre adlarını, A1:B3 aralıklarını ve + - * / işlemlerini kullanın. Ondalık ayırıcı noktadır. Hücreye tıklamak adresini formüle ekler.',
          )
        }}
      </p>
      <div class="formula-grid">
        <table>
          <tbody>
            <tr v-for="(row, r) in visibleRows" :key="r">
              <td v-for="(entry, c) in [...row.cells].slice(0, 8)" :key="c">
                <button
                  type="button"
                  :disabled="entry === cell"
                  :aria-label="cellAddress(r, c)"
                  @click="expression += cellAddress(r, c)"
                >
                  <strong>{{ cellAddress(r, c) }}</strong
                  ><span>{{ entry.textContent.slice(0, 30) }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted">
        {{
          t(
            'Izgara ilk 10 satır ve 8 sütunu gösterir. Satır veya sütun yapısı değişirse formülleri yeniden açıp onaylayın; aksi halde #REF! gösterilir.',
          )
        }}
      </p>
      <label class="field-label"
        >{{ t('Ondalık basamak')
        }}<input
          v-model.number="precision"
          type="number"
          min="0"
          max="8"
          class="text-input"
          :aria-label="t('Ondalık basamak')"
      /></label>
      <output class="formula-result" aria-live="polite"
        >{{ t('Sonuç') }}: {{ result.error || result.value }}</output
      >
      <p v-if="error" role="alert" class="error-banner">{{ t(error) }}</p>
    </form>
    <template #footer
      ><button v-if="widget" class="button" @click="freeze">
        {{ t('Sonucu sabit metne çevir') }}</button
      ><button class="button" @click="emit('close')">{{ t('Vazgeç') }}</button
      ><button
        type="submit"
        form="table-formula"
        class="button primary"
        :disabled="!shape || !!result.error"
      >
        {{ t('Formülü uygula') }}
      </button></template
    >
  </AppDialog>
</template>
