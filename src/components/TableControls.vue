<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  TableProperties,
  Table2,
  Rows3,
  Columns3,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Ellipsis,
  Check,
  Merge,
  Split,
  Paintbrush,
} from '@lucide/vue'
import EditorPopover from './EditorPopover.vue'
import { useEditorLocale } from '../lib/editor-locale'
const { t } = useEditorLocale()
const props = defineProps({ engine: Object, state: Object, frame: Object, suspended: Boolean })
const emit = defineEmits(['command', 'options', 'cell-format'])
const box = ref(null)
const cellBox = ref(null)
const selectedBoxes = ref([])
const columns = ref([])
const toolbar = ref(null)
const toolbarPosition = ref({ left: 8, top: 8 })
const properties = ref(false)
const propertyAnchor = ref(null)
const form = ref({ caption: '', width: '100%', style: 'plain' })
let table,
  observer,
  frameDoc,
  animation = 0,
  alive = true,
  resizing = null
const actions = [
  { label: 'Üstüne satır ekle', command: 'addRowBefore', icon: Rows3, arrow: ArrowUp },
  {
    label: 'Satır ekle',
    title: 'Altına satır ekle',
    command: 'addRow',
    icon: Rows3,
    arrow: ArrowDown,
  },
  { label: 'Satırı sil', command: 'deleteRow', icon: Rows3, remove: true },
  { label: 'Soluna sütun ekle', command: 'addColumnBefore', icon: Columns3, arrow: ArrowLeft },
  {
    label: 'Sütun ekle',
    title: 'Sağına sütun ekle',
    command: 'addColumn',
    icon: Columns3,
    arrow: ArrowRight,
  },
  { label: 'Sütunu sil', command: 'deleteColumn', icon: Columns3, remove: true },
]
function rectangle(node) {
  const r = node.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}
function measure() {
  if (!table?.isConnected || !props.frame) {
    box.value = null
    return
  }
  const rect = rectangle(table)
  const height = props.frame.clientHeight
  if (rect.top + rect.height <= 0 || rect.top >= height) {
    box.value = null
    return
  }
  box.value = rect
  const cell = props.engine.context()?.closest('td,th')
  cellBox.value = cell ? rectangle(cell) : null
  selectedBoxes.value = (props.engine.selectedCells()?.cells || []).map(rectangle)
  const geometry = props.engine.columnGeometry(table)
  columns.value = geometry
    ? geometry.visible.map((index) => ({ index, left: geometry.boundaries[index] }))
    : []
  const barWidth = toolbar.value?.offsetWidth || Math.min(354, props.frame.clientWidth - 16)
  const barHeight = toolbar.value?.offsetHeight || 44
  const above = rect.top - barHeight - 12
  const below = rect.top + rect.height + 12
  toolbarPosition.value = {
    left: Math.max(
      8,
      Math.min(rect.left + (rect.width - barWidth) / 2, props.frame.clientWidth - barWidth - 8),
    ),
    top: above >= 8 ? above : below + barHeight < height - 8 ? below : 8,
  }
}
function schedule() {
  cancelAnimationFrame(animation)
  animation = requestAnimationFrame(measure)
}
function disconnect() {
  observer?.disconnect()
  frameDoc?.removeEventListener('scroll', schedule, true)
  frameDoc?.removeEventListener('keydown', cancelResize, true)
}
watch(
  () => [props.state, props.engine, props.frame],
  async () => {
    await nextTick()
    if (!alive || resizing) return
    disconnect()
    const nextTable =
      props.state.table && !props.state.image ? props.engine?.context()?.closest('table') : null
    if (table !== nextTable) properties.value = false
    table = nextTable
    if (table && props.frame) {
      observer = new ResizeObserver(schedule)
      observer.observe(table)
      observer.observe(props.engine.root)
      observer.observe(props.frame)
      frameDoc = props.frame.contentDocument
      frameDoc.addEventListener('scroll', schedule, true)
      frameDoc.addEventListener('keydown', cancelResize, true)
    }
    measure()
    await nextTick()
    if (alive) measure()
  },
  { immediate: true, flush: 'post' },
)
function css(rect) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
}
function openProperties(event) {
  props.engine.rememberSelection()
  propertyAnchor.value = event.currentTarget
  form.value = {
    caption: table.caption?.textContent || '',
    width: table.style.width || '100%',
    style: table.dataset.studioTable || 'plain',
  }
  properties.value = !properties.value
}
function apply() {
  emit('command', 'tableProperties', form.value)
  properties.value = false
}
function keys(event) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    props.engine.restoreSelection()
    return
  }
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
  const index = buttons.indexOf(event.target)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
  buttons[next]?.focus()
}
function begin(event, corner) {
  if (event.button !== 0) return
  const session = props.engine.beginTableResize(table)
  if (!session) return
  resizing = {
    session,
    x: event.clientX,
    sign: corner.endsWith('w') ? -1 : 1,
    handle: event.currentTarget,
    pointerId: event.pointerId,
  }
  event.currentTarget.focus({ preventScroll: true })
  event.currentTarget.setPointerCapture(event.pointerId)
}
function beginColumn(event, index) {
  if (event.button !== 0) return
  const session = props.engine.beginColumnResize(table, index)
  if (!session) return
  resizing = {
    session,
    column: true,
    x: event.clientX,
    handle: event.currentTarget,
    pointerId: event.pointerId,
  }
  event.currentTarget.focus({ preventScroll: true })
  event.currentTarget.setPointerCapture(event.pointerId)
}
function move(event) {
  if (!resizing || resizing.cancelled || event.pointerId !== resizing.pointerId) return
  if (resizing.column) {
    props.engine.previewColumnResize(resizing.session, event.clientX - resizing.x)
    measure()
    return
  }
  props.engine.previewTableResize(
    resizing.session,
    resizing.session.width + (event.clientX - resizing.x) * resizing.sign,
  )
  measure()
}
function finish(cancel = false) {
  if (!resizing) return
  const old = resizing
  resizing = null
  props.engine[old.column ? 'finishColumnResize' : 'finishTableResize'](
    old.session,
    cancel || old.cancelled,
  )
  if (old.handle.hasPointerCapture(old.pointerId)) old.handle.releasePointerCapture(old.pointerId)
  measure()
}
function resizeKey(event) {
  if (event.key === 'Escape' && resizing) {
    event.preventDefault()
    event.stopPropagation()
    resizing.cancelled = true
    if (resizing.column) props.engine.previewColumnResize(resizing.session, 0)
    else props.engine.previewTableResize(resizing.session, resizing.session.width)
    measure()
    return
  }
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || resizing) return
  event.preventDefault()
  const session = props.engine.beginTableResize(table)
  props.engine.previewTableResize(
    session,
    session.width + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 10 : 1),
  )
  props.engine.finishTableResize(session)
  event.currentTarget.focus({ preventScroll: true })
}
function columnKey(event, index) {
  if (event.key === 'Escape') {
    if (resizing) {
      event.preventDefault()
      event.stopPropagation()
      finish(true)
    }
    return
  }
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || resizing) return
  event.preventDefault()
  const session = props.engine.beginColumnResize(table, index)
  if (!session) return
  props.engine.previewColumnResize(
    session,
    (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 10 : 1),
  )
  props.engine.finishColumnResize(session)
  event.currentTarget.focus({ preventScroll: true })
}
function cancelResize(event) {
  if (event.key !== 'Escape' || !resizing) return
  event.preventDefault()
  event.stopPropagation()
  finish(true)
}
onMounted(() => document.addEventListener('keydown', cancelResize, true))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', cancelResize, true)
  alive = false
  finish(true)
  disconnect()
  cancelAnimationFrame(animation)
})
defineExpose({
  showProperties: () => {
    const button = toolbar.value?.querySelector('button')
    if (button) openProperties({ currentTarget: button })
  },
})
</script>
<template>
  <div v-if="box" class="table-selection-layer">
    <div class="table-selection-frame" :style="css(box)">
      <button
        v-for="corner in ['nw', 'ne', 'sw', 'se']"
        :key="corner"
        :class="['table-resize-handle', corner]"
        :aria-label="`Tablo genişliğini boyutlandır: ${corner}`"
        title="Tablo genişliğini sürükleyerek değiştir"
        @pointerdown.prevent="begin($event, corner)"
        @pointermove="move"
        @pointerup="finish(false)"
        @pointercancel="finish(true)"
        @lostpointercapture="finish(true)"
        @keydown="resizeKey"
      />
    </div>
    <div v-if="cellBox && !selectedBoxes.length" class="table-active-cell" :style="css(cellBox)" />
    <div
      v-for="(rect, index) in selectedBoxes"
      :key="index"
      class="table-active-cell table-multi-cell"
      :style="css(rect)"
    />
    <button
      v-for="column in columns"
      :key="column.index"
      class="table-column-handle"
      :style="{ left: `${column.left - 4}px`, top: `${box.top}px`, height: `${box.height}px` }"
      :aria-label="`${column.index}. sütun sınırını boyutlandır`"
      title="Sütun sınırını sürükleyin; ok tuşlarıyla 1 px, Shift ile 10 px"
      @pointerdown.prevent="beginColumn($event, column.index)"
      @pointermove="move"
      @pointerup="finish(false)"
      @pointercancel="finish(true)"
      @lostpointercapture="finish(true)"
      @keydown="columnKey($event, column.index)"
    />
    <span
      v-if="selectedBoxes.length"
      class="table-selection-count"
      role="status"
      :style="{ left: `${box.left}px`, top: `${Math.max(0, box.top)}px` }"
      >{{ selectedBoxes.length }} hücre seçili</span
    >
    <div
      ref="toolbar"
      class="table-quick-toolbar"
      role="toolbar"
      aria-label="Tablo hızlı işlemleri"
      :style="{ left: `${toolbarPosition.left}px`, top: `${toolbarPosition.top}px` }"
      @keydown="keys"
    >
      <button
        aria-label="Tablo özellikleri"
        title="Tablo özellikleri"
        @pointerdown.prevent
        @click="openProperties"
      >
        <TableProperties :size="18" />
      </button>
      <button
        aria-label="Tabloyu sil"
        title="Tabloyu sil"
        @pointerdown.prevent
        @click="emit('command', 'table', 'deleteTable')"
      >
        <Table2 :size="18" /><span class="quick-remove">×</span>
      </button>
      <span class="quick-separator" />
      <template v-for="(action, index) in actions" :key="action.command">
        <span v-if="index === 3" class="quick-separator" />
        <button
          :aria-label="action.label"
          :title="action.title || action.label"
          :disabled="!state.canEditTable"
          @pointerdown.prevent
          @click="emit('command', 'table', action.command)"
        >
          <component :is="action.icon" :size="18" /><component
            v-if="action.arrow"
            :is="action.arrow"
            class="quick-direction"
            :size="10"
          /><span v-if="action.remove" class="quick-remove">×</span>
        </button>
      </template>
      <span class="quick-separator" /><button
        :aria-label="t('Hücre biçimi')"
        :title="t('Hücre biçimi')"
        :disabled="!state.canEditTable"
        @pointerdown.prevent
        @click="emit('cell-format')"
      >
        <Paintbrush :size="18" />
      </button>
      <button
        aria-label="Seçili hücreleri birleştir"
        title="Seçili hücreleri birleştir"
        :disabled="!state.canMergeCells"
        @pointerdown.prevent
        @click="emit('command', 'mergeCells')"
      >
        <Merge :size="18" />
      </button>
      <button
        aria-label="Hücreyi ayır"
        title="Hücreyi ayır"
        :disabled="!state.canSplitCell"
        @pointerdown.prevent
        @click="emit('command', 'splitCell')"
      >
        <Split :size="18" />
      </button>
      <button
        aria-label="Diğer tablo işlemleri"
        title="Sırala, hücre birleştir veya ayır"
        @pointerdown.prevent
        @click="emit('options', $event)"
      >
        <Ellipsis :size="18" />
      </button>
    </div>
  </div>
  <EditorPopover
    v-if="properties && box"
    :anchor="propertyAnchor"
    label="Tablo özellikleri"
    @close="properties = false"
  >
    <form class="table-properties-form" @submit.prevent="apply">
      <strong>Tablo özellikleri</strong
      ><label
        >Açıklama<input
          v-model="form.caption"
          aria-label="Tablo açıklaması"
          placeholder="İsteğe bağlı tablo başlığı" /></label
      ><label
        >Genişlik<input
          v-model="form.width"
          aria-label="Tablo genişliği"
          pattern="[0-9]{1,4}(px|%)?"
          placeholder="100% veya 600px"
          required /></label
      ><label
        >Görünüm<select v-model="form.style" aria-label="Tablo görünümü">
          <option value="plain">Klasik</option>
          <option value="striped">Şeritli satırlar</option>
          <option value="minimal">Sade çizgiler</option>
        </select></label
      ><button class="button primary" type="submit"><Check :size="14" /> Tabloyu güncelle</button>
    </form>
  </EditorPopover>
</template>
