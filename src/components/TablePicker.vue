<script setup>
import { useEditorLocale } from '../lib/editor-locale'
const { t } = useEditorLocale()
import { ref } from 'vue'
import { Table2, Settings2 } from '@lucide/vue'
import EditorPopover from './EditorPopover.vue'

defineProps({ anchor: Object })
const emit = defineEmits(['close', 'insert', 'custom'])
const rows = ref(1)
const columns = ref(1)
const header = ref(true)
function hover(index) {
  rows.value = Math.floor(index / 10) + 1
  columns.value = (index % 10) + 1
}
function choose(index) {
  hover(index)
  emit('insert', { rows: rows.value, columns: columns.value, header: header.value })
}
function custom() {
  emit('custom', { rows: rows.value, columns: columns.value, header: header.value })
}
function key(event, index) {
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -10, ArrowDown: 10 }
  if (!(event.key in offsets)) return
  event.preventDefault()
  const next = Math.max(0, Math.min(79, index + offsets[event.key]))
  event.currentTarget.parentElement.querySelectorAll('button')[next]?.focus()
}
</script>

<template>
  <EditorPopover :anchor="anchor" :label="t('Tablo boyutunu seç')" @close="emit('close')">
    <div class="table-picker" role="dialog" :aria-label="t('Tablo boyutunu seç')">
      <div class="table-picker-title">
        <Table2 :size="18" /><strong>{{ t('Tablo ekle') }}</strong
        ><span aria-live="polite">{{ columns }} × {{ rows }}</span>
      </div>
      <div class="table-grid" role="group" :aria-label="t('Tablo boyutları')">
        <button
          v-for="(_, index) in 80"
          :key="index"
          type="button"
          :aria-label="
            t('{columns} sütun, {rows} satır', {
              columns: (index % 10) + 1,
              rows: Math.floor(index / 10) + 1,
            })
          "
          :tabindex="index === (rows - 1) * 10 + columns - 1 ? 0 : -1"
          :class="{
            selected: index % 10 < columns && Math.floor(index / 10) < rows,
            'header-cell': header && index < columns,
          }"
          @pointerenter="hover(index)"
          @focus="hover(index)"
          @keydown="key($event, index)"
          @click="choose(index)"
        ></button>
      </div>
      <p class="table-picker-hint">
        {{ columns }} {{ t('sütun,') }} {{ rows }} {{ t('satır oluştur') }}
      </p>
      <label class="table-picker-check"
        ><input v-model="header" type="checkbox" /> {{ t('İlk satır başlık olsun') }}</label
      >
      <button class="table-custom" @click="custom">
        <Settings2 :size="16" /> {{ t('Özel boyut…') }} <span>{{ t('En çok 20 satır') }}</span>
      </button>
    </div>
  </EditorPopover>
</template>
