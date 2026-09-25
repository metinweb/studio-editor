<script setup>
import { computed, ref, shallowRef, watch, onBeforeUnmount } from 'vue'
import {
  Copy,
  Scissors,
  ClipboardPaste,
  Image,
  Crop,
  Link,
  Unlink,
  Rows3,
  Columns3,
  TableProperties,
  Trash2,
  Merge,
  Split,
  Bold,
  Italic,
  MessageSquare,
  Undo2,
  Redo2,
  TextSelect,
  Paintbrush,
  Film,
} from '@lucide/vue'
import EditorPopover from './EditorPopover.vue'
import { selectRange } from '../editor/selection'
import { useEditorLocale } from '../lib/editor-locale'
const { t } = useEditorLocale()

const props = defineProps({ engine: Object, frame: Object, state: Object })
const emit = defineEmits(['action', 'notice', 'open'])
const opened = ref(false)
const contextState = shallowRef(null)
const anchor = shallowRef(null)
let alive = true
let position = null
let pointerTarget = null
const items = computed(() => {
  const s = contextState.value || props.state
  const groups = []
  if (s.mediaEmbed)
    groups.push([
      ['Gömülü medyayı düzenle', Film, 'embedProperties'],
      ['Gömülü medyayı sil', Trash2, 'removeEmbed'],
    ])
  if (s.image)
    groups.push([
      ['Resmi düzenle', Crop, 'imageEdit'],
      ['Görsel özellikleri', Image, 'imageProperties'],
      ['Görseli sil', Trash2, 'removeImage'],
    ])
  if (s.link)
    groups.push([
      ['Bağlantıyı düzenle', Link, 'linkProperties'],
      ['Bağlantıyı kaldır', Unlink, 'unlink'],
    ])
  if (s.table)
    groups.push([
      ['Tablo özellikleri', TableProperties, 'tableProperties'],
      ['Hücre biçimi', Paintbrush, 'cellFormat', null, !s.canEditTable],
      ['Üstüne satır ekle', Rows3, 'table', 'addRowBefore', !s.canEditTable],
      ['Altına satır ekle', Rows3, 'table', 'addRow', !s.canEditTable],
      ['Soluna sütun ekle', Columns3, 'table', 'addColumnBefore', !s.canEditTable],
      ['Sağına sütun ekle', Columns3, 'table', 'addColumn', !s.canEditTable],
      ['Seçili hücreleri birleştir', Merge, 'mergeCells', null, !s.canMergeCells],
      ['Alttaki hücreyle birleştir', Merge, 'mergeCellDown', null, !s.canMergeDown],
      ['Sağdaki hücreyle birleştir', Merge, 'mergeCellRight', null, !s.canMergeRight],
      ['Hücreyi ayır', Split, 'splitCell', null, !s.canSplitCell],
      ['Satırı sil', Rows3, 'table', 'deleteRow', !s.canEditTable],
      ['Sütunu sil', Columns3, 'table', 'deleteColumn', !s.canEditTable],
      ['Tabloyu sil', Trash2, 'table', 'deleteTable'],
    ])
  if (!s.image && !s.mediaEmbed)
    groups.push([
      ['Kalın', Bold, 'inline', 'bold'],
      ['İtalik', Italic, 'inline', 'italic'],
      ['Bağlantı ekle', Link, 'linkProperties'],
      ['Yorum ekle', MessageSquare, 'comment', null, !s.selectedText],
    ])
  groups.push(
    [
      ['Kes', Scissors, 'cut', null, !s.selectedText && !s.image && !s.selectedCellCount],
      ['Kopyala', Copy, 'copy', null, !s.selectedText && !s.image && !s.selectedCellCount],
      ['Yapıştır', ClipboardPaste, 'paste'],
      ['Tümünü seç', TextSelect, 'selectAll'],
    ],
    [
      ['Geri al', Undo2, 'undo', null, !s.canUndo],
      ['Yinele', Redo2, 'redo', null, !s.canRedo],
    ],
  )
  return groups.flatMap((group, index) =>
    group.map(([label, icon, action, arg, disabled], i) => ({
      label,
      icon,
      action,
      arg,
      disabled,
      separator: index > 0 && i === 0,
    })),
  )
})
function open(event, keyboard = false) {
  if (!alive || !props.engine?.editable) return
  if (event.shiftKey && !keyboard) return // Shift + right click retains the browser menu.
  event.preventDefault()
  const editor = props.engine
  // Focus the editing document before changing its selection. Firefox can
  // otherwise restore the previous caret when the iframe regains focus.
  editor.root.focus({ preventScroll: true })
  const target = keyboard
    ? editor.context() || editor.root
    : pointerTarget && editor.root.contains(pointerTarget)
      ? pointerTarget
      : event.target
  pointerTarget = null
  const selectedCells = editor.selectedCells()
  if (selectedCells && !selectedCells.cells.includes(target.closest?.('td,th')))
    editor.cellSelection = null
  const range = editor.range()
  const selectedHit =
    keyboard ||
    [...range.getClientRects()].some(
      (r) =>
        event.clientX >= r.left &&
        event.clientX <= r.right &&
        event.clientY >= r.top &&
        event.clientY <= r.bottom,
    )
  if (target.closest?.('figure[data-studio-embed]'))
    editor.selectEmbed(target.closest('figure[data-studio-embed]'))
  else if (target.tagName === 'IMG') editor.selectImage(target)
  else if (
    target.closest?.('a,td,th') &&
    (!selectedHit || editor.context()?.closest('a,td,th') !== target.closest('a,td,th'))
  ) {
    const next = editor.doc.createRange()
    next.selectNodeContents(target.closest('a,td,th'))
    next.collapse(true)
    selectRange(editor.root, next)
  } else if (!selectedHit) {
    const next = editor.doc.createRange()
    const caret = editor.doc.caretPositionFromPoint?.(event.clientX, event.clientY)
    const legacy = editor.doc.caretRangeFromPoint?.(event.clientX, event.clientY)
    if (caret && editor.root.contains(caret.offsetNode))
      next.setStart(caret.offsetNode, caret.offset)
    else if (legacy && editor.root.contains(legacy.startContainer))
      next.setStart(legacy.startContainer, legacy.startOffset)
    else next.selectNodeContents(target.closest?.('td,th,a,p,li') || target)
    next.collapse(true)
    selectRange(editor.root, next)
  }
  editor.selectionChanged()
  position = editor.rememberSelection()
  contextState.value = editor.publishState()
  const r = editor.range().getBoundingClientRect()
  const x = keyboard ? Math.max(12, r.left) : event.clientX
  const y = keyboard ? Math.max(12, r.bottom) : event.clientY
  anchor.value = {
    isConnected: true,
    getBoundingClientRect: () => {
      const frameRect = props.frame.getBoundingClientRect()
      return {
        left: frameRect.left + x,
        top: frameRect.top + y - 4,
        bottom: frameRect.top + y - 4,
        width: 0,
        height: 0,
      }
    },
    contains: () => false,
    focus: () => editor.restoreSelection(position),
  }
  emit('open')
  opened.value = true
}
function close() {
  opened.value = false
}
watch(
  () => props.engine,
  (editor) => {
    if (!editor) return
    // Keep the intended right-click target if focusing the iframe scrolls it
    // between pointerdown and contextmenu (notably in Firefox).
    editor.listen(editor.root, 'pointerdown', (event) => {
      pointerTarget = event.button === 2 ? event.target : null
    })
    editor.listen(editor.root, 'contextmenu', open)
    editor.listen(editor.root, 'keydown', (event) => {
      if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') open(event, true)
    })
    editor.listen(editor.doc, 'scroll', close)
  },
  { immediate: true },
)
async function clipboard(action) {
  const editor = props.engine
  const saved = position
  editor.restoreSelection(saved)
  const htmlBefore = editor.getHTML()
  const cellSelection = editor.cellSelection
  const range = editor.range()
  const container = editor.doc.createElement('div')
  container.append(range.cloneContents())
  try {
    if (action === 'paste') {
      let html = '',
        text = ''
      if (navigator.clipboard?.read) {
        const entries = await navigator.clipboard.read()
        for (const entry of entries) {
          if (entry.types.includes('text/html')) {
            html = await (await entry.getType('text/html')).text()
            break
          }
          if (entry.types.includes('text/plain'))
            text += await (await entry.getType('text/plain')).text()
        }
      } else text = await navigator.clipboard.readText()
      if (!html && !text) throw new Error('empty')
      if (!alive || editor.destroyed || htmlBefore !== editor.getHTML()) return
      editor.restoreSelection(saved)
      editor.pasteContent({ html, text })
    } else {
      let text = range.toString() || container.querySelector('img')?.alt || ''
      if (cellSelection) {
        const data = new DataTransfer()
        editor.cellClipboard({ clipboardData: data, preventDefault() {} })
        container.innerHTML = data.getData('text/html')
        text = data.getData('text/plain')
      }
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write)
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([container.innerHTML], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ])
      else await navigator.clipboard.writeText(text)
      if (action === 'cut' && alive && !editor.destroyed && htmlBefore === editor.getHTML()) {
        if (cellSelection) {
          if (editor.cellSelection === cellSelection) editor.clearCells()
          return
        }
        editor.restoreSelection(saved)
        editor.transaction((selected) => selected.deleteContents())
      }
    }
  } catch {
    if (alive)
      emit(
        'notice',
        `Tarayıcı panoya erişemedi. ${action === 'paste' ? 'Yapıştırmak için Ctrl / ⌘ + V' : action === 'cut' ? 'Kesmek için Ctrl / ⌘ + X' : 'Kopyalamak için Ctrl / ⌘ + C'} kullanın.`,
      )
  }
}
function run(item) {
  close()
  props.engine.restoreSelection(position)
  if (['cut', 'copy', 'paste'].includes(item.action)) clipboard(item.action)
  else if (item.action === 'selectAll') {
    props.engine.cellSelection = null
    const range = props.engine.doc.createRange()
    range.selectNodeContents(props.engine.root)
    selectRange(props.engine.root, range)
    props.engine.selectionChanged()
  } else emit('action', item.action, item.arg)
}
function keys(event) {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
  const i = buttons.indexOf(event.target)
  buttons[
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (i + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
  ]?.focus()
}
onBeforeUnmount(() => {
  alive = false
})
defineExpose({ close })
</script>
<template>
  <EditorPopover v-if="opened" :anchor="anchor" label="Sağ tık menüsü" @close="close">
    <div
      class="editor-menu editor-context-menu"
      role="menu"
      aria-label="Sağ tık menüsü"
      @keydown="keys"
    >
      <button
        v-for="item in items"
        :key="item.label"
        role="menuitem"
        :aria-label="t(item.label)"
        :disabled="item.disabled"
        :class="{ 'menu-separated': item.separator }"
        @click="run(item)"
      >
        <component :is="item.icon" :size="17" /><span>{{ t(item.label) }}</span>
      </button>
    </div>
  </EditorPopover>
</template>
