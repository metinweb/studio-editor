<script setup>
import { provideEditorLocale } from '../lib/editor-locale'
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue'
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  Link,
  Unlink,
  Image,
  Table2,
  Code2,
  Quote,
  Minus,
  Search,
  Maximize2,
  Minimize2,
  RemoveFormatting,
  X,
  ArrowDown,
  ArrowUp,
  Rows3,
  Columns3,
  Trash2,
  Check,
  ChevronDown,
  Save,
  FileText,
  MessageSquare,
  LayoutTemplate,
  ScanEye,
  Paintbrush,
  ListTree,
  CaseUpper,
  CaseLower,
  ArrowDownAZ,
  ArrowUpAZ,
  Merge,
  Split,
  Ellipsis,
  Film,
  ListChecks,
  Palette,
} from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import EditorPopover from './EditorPopover.vue'
import TablePicker from './TablePicker.vue'
import ImageControls from './ImageControls.vue'
import TableControls from './TableControls.vue'
import CellFormatDialog from './CellFormatDialog.vue'
import ColorPalette from './ColorPalette.vue'
import EditorContextMenu from './EditorContextMenu.vue'
import ReviewPanel from './ReviewPanel.vue'
import WritingMenu from './WritingMenu.vue'
import BlockControls from './BlockControls.vue'
import MediaEmbedControls from './MediaEmbedControls.vue'
import MentionMenu from './MentionMenu.vue'
import DocumentOutline from './DocumentOutline.vue'
import { contentStyles } from '../editor/writing-widgets.js'
import { StudioEditor } from '../editor/engine'
import { documentCss, escapeHtml } from '../lib/content'
import { useEditorMedia } from '../stores/editor-media'
import { assetUrl } from '../lib/media-service'
import { includesOption, menuNames } from '../lib/editor-options'
import './rich-editor.css'
import './content-tools.css'
import './image-editor.css'
const TemplateLibrary = defineAsyncComponent(() => import('./TemplateLibrary.vue'))
const ImageEditor = defineAsyncComponent(() => import('./ImageEditor.vue'))
const PrintDialog = defineAsyncComponent(() => import('./PrintDialog.vue'))
const MediaEmbedDialog = defineAsyncComponent(() => import('./MediaEmbedDialog.vue'))

const props = defineProps({
  modelValue: String,
  blockIds: Array,
  mentions: { type: Array, default: () => [] },
  allowCreateMention: { type: Boolean, default: true },
  slashCommands: { type: Array, default: () => [] },
  direction: { type: String, default: 'ltr' },
  readonly: Boolean,
  disabled: Boolean,
  placeholder: { type: String, default: '' },
  toolbar: { type: [Boolean, Array], default: true },
  menubar: { type: [Boolean, Array], default: true },
  locale: { type: String, default: 'en' },
  messages: Object,
  pasteMode: { type: String, default: 'keep' },
  tablePasteStyle: { type: String, default: 'target' },
})
const { t, locale: activeLocale } = provideEditorLocale(props)
const locked = computed(() => props.readonly || props.disabled)
let editEpoch = 0
const tools = (group) => !locked.value && includesOption(props.toolbar, group)
const firstRow = computed(() => ['history', 'typography', 'format', 'color'].some(tools))
const secondRow = computed(() => ['align', 'lists', 'insert', 'tools', 'review'].some(tools))
const emit = defineEmits([
  'update:modelValue',
  'update:pasteMode',
  'update:tablePasteStyle',
  'paste',
  'media',
  'source',
  'ready',
  'save',
  'transaction',
  'slash-command',
])
const pasteMode = ref(props.pasteMode)
function setPasteMode(mode) {
  pasteMode.value = ['keep', 'clean', 'text'].includes(mode) ? mode : 'keep'
  if (engine.value) engine.value.pasteMode = pasteMode.value
}
watch(() => props.pasteMode, setPasteMode)
const tablePasteStyle = ref(props.tablePasteStyle === 'source' ? 'source' : 'target')
function setTablePasteStyle(value) {
  tablePasteStyle.value = value === 'source' ? 'source' : 'target'
  if (engine.value) engine.value.tablePasteStyle = tablePasteStyle.value
}
watch(() => props.tablePasteStyle, setTablePasteStyle)
const media = useEditorMedia()
const engine = shallowRef(null)
const writingMenu = ref(null)
const mentionMenu = ref(null)
const outlineOpen = ref(false)
const frame = ref(null)
const contextMenu = ref(null)
const tableControls = ref(null)
const cellFormatSession = shallowRef(null)
const imageTarget = shallowRef(null)
const embedTarget = shallowRef(null)
function openEmbed(target = null) {
  if (locked.value) return
  rememberSelection()
  embedTarget.value = target
  dialog.value = 'embed'
}
const menubar = ref(null)
const popup = ref(null)
const popupAnchor = shallowRef(null)
const reviewTab = ref(null)
const format = ref(null)
const toolNotice = ref('')
const commentCount = computed(() => {
  state.value
  return engine.value?.threads().filter((thread) => !thread.resolved).length || 0
})
const state = ref({ block: 'p', align: 'left' })
const fullscreen = ref(false)
const toolbarExpanded = ref(false)
const dialog = ref(null)
const error = ref('')
const busy = ref(false)
const linkForm = ref({ href: '', text: '', blank: false })
const tableForm = ref({ rows: 3, columns: 3, header: true })
const imageForm = ref({ alt: '', width: '' })
const codeForm = ref({ language: 'javascript', code: '' })
const searchOpen = ref(false)
const searchInput = ref(null)
const query = ref('')
const replacement = ref('')
const caseSensitive = ref(false)
const searchResults = ref({ index: -1, count: 0 })
const foreground = computed(() => state.value.color || '#253343')
const background = computed(() => state.value.backgroundColor || 'transparent')
const markButtons = [
  { command: 'bold', title: 'Kalın', icon: Bold },
  { command: 'italic', title: 'İtalik', icon: Italic },
  { command: 'underline', title: 'Altı çizili', icon: Underline },
  { command: 'strike', title: 'Üstü çizili', icon: Strikethrough },
]
const alignButtons = [
  { value: 'left', title: 'Sola hizala', icon: AlignLeft },
  { value: 'center', title: 'Ortala', icon: AlignCenter },
  { value: 'right', title: 'Sağa hizala', icon: AlignRight },
  { value: 'justify', title: 'İki yana yasla', icon: AlignJustify },
]
const fonts = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Arial Black', value: '"Arial Black", sans-serif' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
  { label: 'Consolas', value: 'Consolas, monospace' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
]
const blocks = [
  { label: 'Paragraf', value: 'p', size: '14px' },
  { label: 'Başlık 1', value: 'h1', size: '26px' },
  { label: 'Başlık 2', value: 'h2', size: '22px' },
  { label: 'Başlık 3', value: 'h3', size: '18px' },
  { label: 'Başlık 4', value: 'h4', size: '16px' },
  { label: 'Alıntı', value: 'blockquote', size: '14px' },
  { label: 'Ön biçimlendirilmiş', value: 'pre', size: '13px' },
]
const fontLabel = computed(() =>
  (state.value.fontFamily || 'Arial').split(',')[0].replace(/["']/g, '').trim(),
)
const blockLabel = computed(
  () => blocks.find((item) => item.value === state.value.block)?.label || 'Paragraf',
)
const typeOptions = computed(() =>
  popup.value === 'fonts'
    ? fonts.map((font) => ({
        ...font,
        selected: font.label.toLowerCase() === fontLabel.value.toLowerCase(),
        style: { fontFamily: font.value },
      }))
    : popup.value === 'sizes'
      ? [8, 10, 12, 14, 16, 17, 18, 20, 24, 28, 32, 36, 48, 64, 72].map((size) => ({
          label: `${size} px`,
          value: `${size}px`,
          selected: parseFloat(state.value.fontSize) === size,
        }))
      : blocks.map((block) => ({
          ...block,
          selected: state.value.block === block.value,
          style: {
            fontSize: block.size,
            fontWeight: block.value.startsWith('h') ? 600 : 400,
            fontFamily: block.value === 'pre' ? 'monospace' : 'inherit',
          },
        })),
)
function applyTypography(item) {
  const name = popup.value
  popup.value = null
  if (name === 'blocks') command('block', item.value)
  else command('inline', null, { [name === 'fonts' ? 'fontFamily' : 'fontSize']: item.value })
}
function applyColor(value) {
  const highlight = popup.value === 'highlight'
  popup.value = null
  command('inline', null, { [highlight ? 'backgroundColor' : 'color']: value })
}
function applyNamedStyle(id) {
  popup.value = null
  command('applyContentStyle', id)
}
const allMenus = computed(() => ({
  Dosya: [
    {
      label: 'Sayfa düzeni ve dışa aktarım',
      icon: FileText,
      action: () => (dialog.value = 'print'),
    },
    { label: 'Belgeyi kaydet', icon: Save, shortcut: 'Ctrl S', action: () => emit('save') },
    { label: 'HTML kaynak kodu', icon: Code2, action: () => emit('source') },
  ],
  Düzenle: [
    ...[
      ['keep', 'Yapıştır: biçimi koru'],
      ['clean', 'Yapıştır: biçimi temizle'],
      ['text', 'Yapıştır: yalnızca metin'],
    ].map(([mode, label]) => ({
      label,
      active: pasteMode.value === mode,
      action: () => {
        setPasteMode(mode)
        emit('update:pasteMode', mode)
      },
    })),
    {
      label: 'Geri al',
      icon: Undo2,
      shortcut: 'Ctrl Z',
      disabled: !state.value.canUndo,
      action: () => command('undo'),
    },
    {
      label: 'Yinele',
      icon: Redo2,
      shortcut: 'Ctrl Shift Z',
      disabled: !state.value.canRedo,
      action: () => command('redo'),
    },
    {
      label: 'Bul ve değiştir',
      icon: Search,
      shortcut: 'Ctrl F',
      action: () => {
        searchOpen.value = true
      },
    },
  ],
  Görünüm: [
    {
      label: 'Belge başlıkları',
      icon: ListTree,
      action: () => (outlineOpen.value = !outlineOpen.value),
    },
    {
      label: fullscreen.value ? 'Tam ekrandan çık' : 'Tam ekran',
      icon: Maximize2,
      action: () => {
        fullscreen.value = !fullscreen.value
      },
    },
    { label: 'HTML kaynak kodu', icon: Code2, action: () => emit('source') },
  ],
  Ekle: [
    { label: 'Şablon kütüphanesi', icon: LayoutTemplate, action: () => openDialog('templates') },
    { label: 'Yorum ekle', icon: MessageSquare, action: () => openReview('comments') },
    { label: 'İçindekiler ekle / güncelle', icon: ListTree, action: insertContents },
    { label: 'Görsel veya medya', icon: Image, action: openMedia },
    { label: 'Bağlantıdan medya ekle', icon: Film, action: () => openEmbed() },
    { label: 'Görev listesi', icon: ListChecks, action: () => command('taskList') },
    { label: 'Bağlantı ekle', icon: Link, action: () => openDialog('link') },
    {
      label: 'Tablo ekle',
      icon: Table2,
      action: () => {
        popup.value = 'table'
      },
    },
    { label: 'Kod bloğu ekle', icon: Code2, action: () => openDialog('code') },
    { label: 'Yatay çizgi', icon: Minus, action: () => insert('<hr><p><br></p>') },
  ],
  Biçim: [
    { label: 'Biçimi kopyala', icon: Paintbrush, action: copyFormat },
    {
      label: 'Kopyalanan biçimi uygula',
      icon: Paintbrush,
      disabled: !format.value,
      action: pasteFormat,
    },
    {
      label: 'BÜYÜK HARFE ÇEVİR',
      icon: CaseUpper,
      disabled: !state.value.selectedText,
      action: () => command('changeCase', 'upper'),
    },
    {
      label: 'küçük harfe çevir',
      icon: CaseLower,
      disabled: !state.value.selectedText,
      action: () => command('changeCase', 'lower'),
    },
    ...markButtons.map((tool) => ({
      label: tool.title,
      icon: tool.icon,
      active: !!state.value[tool.command],
      shortcut: { bold: 'Ctrl B', italic: 'Ctrl I', underline: 'Ctrl U' }[tool.command],
      action: () => command('inline', tool.command),
    })),
    { label: 'Alıntı', icon: Quote, action: () => command('block', 'blockquote') },
    { label: 'Alt simge', icon: Subscript, action: () => command('inline', 'subscript') },
    { label: 'Üst simge', icon: Superscript, action: () => command('inline', 'superscript') },
    {
      label: 'Biçimlendirmeyi temizle',
      icon: RemoveFormatting,
      action: () => command('clearFormat'),
    },
  ],
  Tablo: [
    ...[
      ['target', 'Tablo yapıştır: hedef biçimini koru'],
      ['source', 'Tablo yapıştır: kaynak hücre biçimini kullan'],
    ].map(([value, label]) => ({
      label,
      active: tablePasteStyle.value === value,
      action: () => {
        setTablePasteStyle(value)
        emit('update:tablePasteStyle', value)
      },
    })),
    {
      label: 'Hücre biçimi',
      icon: Paintbrush,
      disabled: !state.value.canEditTable,
      action: openCellFormat,
    },
    {
      label: 'Seçili hücreleri birleştir',
      icon: Merge,
      disabled: !state.value.canMergeCells,
      action: () => command('mergeCells'),
    },
    {
      label: 'Alttaki hücreyle birleştir',
      icon: Merge,
      disabled: !state.value.canMergeDown,
      action: () => command('mergeCellDown'),
    },
    {
      label: 'Seçili sütuna göre A → Z',
      icon: ArrowDownAZ,
      disabled: !state.value.table || state.value.complexTable,
      action: () => command('tableSort', 1),
    },
    {
      label: 'Seçili sütuna göre Z → A',
      icon: ArrowUpAZ,
      disabled: !state.value.table || state.value.complexTable,
      action: () => command('tableSort', -1),
    },
    {
      label: 'Sağdaki hücreyle birleştir',
      icon: Merge,
      disabled: !state.value.canMergeRight,
      action: () => command('mergeCellRight'),
    },
    {
      label: 'Hücreyi ayır',
      icon: Split,
      disabled: !state.value.canSplitCell,
      action: () => command('splitCell'),
    },
    {
      label: 'Tablo ekle',
      icon: Table2,
      action: () => {
        popup.value = 'table'
      },
    },
    {
      label: 'Satır ekle',
      icon: Rows3,
      disabled: !state.value.canEditTable,
      action: () => command('table', 'addRow'),
    },
    {
      label: 'Sütun ekle',
      icon: Columns3,
      disabled: !state.value.canEditTable,
      action: () => command('table', 'addColumn'),
    },
    {
      label: 'Tabloyu sil',
      icon: Trash2,
      disabled: !state.value.table,
      action: () => command('table', 'deleteTable'),
    },
  ],
  Araçlar: [
    { label: 'Belge yorumları', icon: MessageSquare, action: () => openReview('comments') },
    { label: 'Erişilebilirlik denetimi', icon: ScanEye, action: () => openReview('check') },
    { label: 'Şablon kütüphanesi', icon: LayoutTemplate, action: () => openDialog('templates') },
    { label: 'İçindekiler ekle / güncelle', icon: ListTree, action: insertContents },
  ],
}))
const menus = computed(() =>
  Object.fromEntries(
    Object.entries(menuNames)
      .filter(([id]) => includesOption(props.menubar, id))
      .map(([, name]) => [
        name,
        allMenus.value[name].filter(
          (item) =>
            !locked.value ||
            [
              'Belgeyi kaydet',
              'HTML kaynak kodu',
              'Bul ve değiştir',
              'Tam ekran',
              'Tam ekrandan çık',
              'Belge başlıkları',
            ].includes(item.label),
        ),
      ])
      .filter(([, items]) => items.length),
  ),
)
function openReview(tab) {
  if (locked.value) return
  rememberSelection()
  reviewTab.value = tab
}
function copyFormat() {
  format.value = engine.value.copyFormat()
  toolNotice.value = format.value
    ? 'Biçim kopyalandı. Hedef metni seçip “Biçimi uygula” düğmesine basın.'
    : 'Önce belgedeki bir metne tıklayın.'
}
function pasteFormat() {
  command('applyFormat', format.value)
  toolNotice.value = ''
}
function insertContents() {
  if (!engine.value.root.querySelector('h1,h2,h3')) {
    toolNotice.value = 'İçindekiler oluşturmak için önce belgeye başlık ekleyin.'
    return
  }
  command('contents')
  toolNotice.value =
    'İçindekiler güncellendi. Başlıklar değiştiğinde aynı düğmeyle yenileyebilirsiniz.'
}
function togglePopup(name, event) {
  contextMenu.value?.close()
  rememberSelection()
  popupAnchor.value = event.currentTarget
  popup.value = popup.value === name ? null : name
}
function hoverMenu(name, event) {
  if (!menus.value[popup.value] || popup.value === name || event.pointerType === 'touch') return
  popupAnchor.value = event.currentTarget
  popup.value = name
}
function switchMenu(direction) {
  const names = Object.keys(menus.value)
  const index = names.indexOf(popup.value)
  const next = (index + direction + names.length) % names.length
  popupAnchor.value = menubar.value.querySelectorAll('button')[next]
  popup.value = names[next]
}
function menubarKeys(event) {
  if (menus.value[popup.value] && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault()
    switchMenu(event.key === 'ArrowRight' ? 1 : -1)
  } else toolbarKeys(event)
}
function runMenu(item) {
  popup.value = null
  item.action()
}
function menuKeys(event) {
  if (
    ['fonts', 'sizes', 'blocks'].includes(popup.value) &&
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    event.key !== ' '
  ) {
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    const index = buttons.indexOf(event.target)
    const ordered = [...buttons.slice(index + 1), ...buttons.slice(0, index + 1)]
    const match = ordered.find((button) =>
      button.textContent
        .trim()
        .toLocaleLowerCase('tr')
        .startsWith(event.key.toLocaleLowerCase('tr')),
    )
    if (match) {
      event.preventDefault()
      match.focus()
    }
    return
  }
  if (menus.value[popup.value] && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault()
    switchMenu(event.key === 'ArrowRight' ? 1 : -1)
    return
  }
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
  const index = buttons.indexOf(event.target)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
  event.preventDefault()
  buttons[next]?.focus()
}
function insertPickedTable(value) {
  popup.value = null
  tableForm.value = value
  applyTable()
}
function slashAction(id) {
  if (id === 'table') command('insertTable', 3, 3)
  else if (id === 'media') openMedia()
  else if (id === 'embed') openEmbed()
  else if (id === 'templates') openDialog('templates')
  else if (id.startsWith('plugin:')) emit('slash-command', id.slice(7))
}
function customTable(value) {
  popup.value = null
  tableForm.value = value
  openDialog('table')
}
// CSP blocks document scripts. WebKit needs allow-scripts for event callbacks
// registered by the parent; the CSP still rejects inline and external scripts.
const frameDocument = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>${documentCss}body{position:relative;outline:none;min-height:calc(100vh - 160px);overflow-wrap:anywhere}table{width:100%}td,th{min-width:40px}a{cursor:text}img{cursor:default}::selection{background:#b4d7ff}pre{white-space:pre-wrap}body:focus{outline:none}body[data-empty="true"]::before{content:attr(data-placeholder);position:absolute;top:14px;left:32px;right:32px;color:#77808d;pointer-events:none;white-space:pre-wrap}[data-studio-thread]{background:#fff1bf;border-bottom:2px solid #dfb455}[data-studio-resolved="true"]{background:transparent;border-bottom:1px dotted #b8b0c4}</style></head><body contenteditable="true" role="textbox" aria-label="Belge içeriği" aria-multiline="true" spellcheck="true"></body></html>`

function initialize() {
  engine.value?.destroy()
  engine.value = new StudioEditor(frame.value.contentDocument.body, {
    content: props.modelValue,
    blockIds: props.blockIds,
    readonly: props.readonly,
    disabled: props.disabled,
    pasteMode: pasteMode.value,
    tablePasteStyle: tablePasteStyle.value,
    onWritingKey: (event) =>
      mentionMenu.value?.key(event) || writingMenu.value?.key(event) || false,
    onNotice: (message) => {
      toolNotice.value = message
    },
    onPaste: (info) => {
      toolNotice.value = [...new Set(info.warnings)].join(' ')
      emit('paste', info)
    },
    onChange: (content) => {
      updateFrameOptions()
      emit('update:modelValue', content)
      if (searchOpen.value) refreshSearch()
    },
    onState: (value) => {
      state.value = value
    },
    onSave: () => emit('save'),
    onFind: () => {
      searchOpen.value = true
      setTimeout(() => searchInput.value?.focus(), 0)
    },
    onFiles: uploadFiles,
    onTransaction: (transaction) => emit('transaction', transaction),
  })
  engine.value.listen(engine.value.doc, 'keydown', (event) => {
    if (event.key === 'Escape') {
      fullscreen.value = false
      searchOpen.value = false
    }
  })
  engine.value.listen(engine.value.root, 'click', (event) => {
    if (locked.value) return
    if (event.target.closest?.('[data-studio-thread]')) reviewTab.value = 'comments'
  })
  engine.value.listen(engine.value.root, 'dblclick', (event) => {
    if (locked.value) return
    if (event.target.tagName === 'IMG') {
      engine.value.selectImage(event.target)
      openImageEditor()
    }
  })
  updateFrameOptions()
  emit('ready')
}
function updateFrameOptions() {
  const root = engine.value?.root
  if (!root) return
  root.dataset.placeholder = props.placeholder
  root.ownerDocument.documentElement.lang = activeLocale.value
  root.dir = ['ltr', 'rtl', 'auto'].includes(props.direction) ? props.direction : 'ltr'
  root.setAttribute('aria-label', t('Belge içeriği'))
  root.setAttribute('aria-placeholder', props.placeholder)
  root.dataset.empty = String(
    !root.textContent.trim() && !root.querySelector('img,video,audio,table,hr,pre,ul,ol'),
  )
}
watch(
  () => [props.readonly, props.disabled],
  () => {
    editEpoch++
    engine.value?.setMode(props)
    popup.value = null
    dialog.value = null
    reviewTab.value = null
    contextMenu.value?.close()
    if (props.disabled) {
      searchOpen.value = false
      fullscreen.value = false
    }
  },
  { flush: 'sync' },
)
watch(() => props.placeholder, updateFrameOptions)
watch(() => props.direction, updateFrameOptions)
watch(() => [props.locale, props.messages], updateFrameOptions, { deep: true })
watch(
  () => [props.toolbar, props.menubar],
  () => {
    popup.value = null
  },
  { deep: true },
)
function rememberSelection() {
  return engine.value?.rememberSelection()
}
function insert(html) {
  if (locked.value) return
  engine.value?.insert(html)
}
function replace(html) {
  engine.value?.replace(html)
}
function command(name, ...args) {
  if (locked.value) return
  rememberSelection()
  engine.value?.[name](...args)
}
function openMedia() {
  if (locked.value) return
  rememberSelection()
  emit('media')
}
function openDialog(name) {
  if (locked.value) return
  contextMenu.value?.close()
  popup.value = null
  rememberSelection()
  error.value = ''
  if (name === 'link')
    linkForm.value = state.value.link
      ? { ...state.value.link }
      : { href: '', text: engine.value.range().toString(), blank: false }
  if (name === 'image') imageForm.value = { ...state.value.image }
  dialog.value = name
}
function openCellFormat() {
  if (locked.value) return
  rememberSelection()
  cellFormatSession.value = engine.value?.captureCellFormat()
  if (cellFormatSession.value) openDialog('cellFormat')
}
function openImageEditor() {
  if (locked.value) return
  engine.value.restoreSelection()
  const target = engine.value.context()?.closest('img')
  if (!target) return
  imageTarget.value = target
  openDialog('imageEdit')
}
async function applyImageEdit({ blob, width }) {
  if (locked.value) throw new Error('Editör salt okunur veya devre dışı.')
  const instance = engine.value,
    target = imageTarget.value
  const epoch = editEpoch
  if (!target?.isConnected || instance.destroyed)
    throw new Error('Düzenlenen görsel artık belgede bulunmuyor.')
  const file = new File(
    [blob],
    `gorsel-duzenlenmis-${Date.now()}.${blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'}`,
    { type: blob.type },
  )
  const added = await media.upload([file], { alt: target.alt })
  if (!added.length) throw new Error(media.error || 'Görsel kütüphaneye kaydedilemedi.')
  if (
    epoch !== editEpoch ||
    instance.destroyed ||
    !instance.replaceImageData(target, assetUrl(added[0]), width)
  )
    throw new Error('Belge değişti. Düzenlenmiş görseli medya kütüphanesinden ekleyebilirsiniz.')
}
async function contextAction(name, arg) {
  if (name === 'embedProperties') {
    openEmbed(engine.value.context()?.closest('figure[data-studio-embed]'))
    return
  }
  if (name === 'cellFormat') openCellFormat()
  else if (name === 'imageEdit') openImageEditor()
  else if (name === 'imageProperties') openDialog('image')
  else if (name === 'linkProperties') openDialog('link')
  else if (name === 'comment') openReview('comments')
  else if (name === 'tableProperties') {
    await nextTick()
    tableControls.value?.showProperties()
  } else command(name, arg)
}
function applyLink() {
  if (!engine.value.link(linkForm.value)) {
    error.value = 'Geçerli bir https://, http://, mailto:, tel: veya göreli adres girin.'
    return
  }
  dialog.value = null
}
function removeLink() {
  command('unlink')
  dialog.value = null
}
function applyTable() {
  command('insertTable', tableForm.value.rows, tableForm.value.columns, tableForm.value.header)
  dialog.value = null
}
function applyImage() {
  command('image', imageForm.value)
  dialog.value = null
}
function applyCode() {
  insert(
    `<pre><code class="language-${codeForm.value.language}">${escapeHtml(codeForm.value.code)}</code></pre><p><br></p>`,
  )
  dialog.value = null
  codeForm.value.code = ''
}
async function uploadFiles(files, position, prepared = null) {
  if (busy.value || locked.value) return
  busy.value = true
  error.value = ''
  const instance = engine.value
  const epoch = editEpoch
  const revision = instance?.revision
  let added
  try {
    added = await media.upload(files)
  } catch (failure) {
    error.value = failure.message
    return
  } finally {
    busy.value = false
  }
  if (!instance || instance.destroyed || locked.value || epoch !== editEpoch) return
  if (instance.revision !== revision) {
    toolNotice.value =
      'Yükleme sürerken belge değişti; yüklenen dosyaları medya kütüphanesinden ekleyebilirsiniz. İçeriği yeniden yapıştırın.'
    return
  }
  if (added.length || prepared) {
    instance.restoreSelection(position)
    instance.savedSelection = position
    if (prepared)
      instance.insertPaste(
        prepared,
        added.map((item) => ({ ...item, html: media.markup(item) })),
      )
    else instance.insert(added.map(media.markup).join(''))
  }
  if (media.error) error.value = media.error
  busy.value = false
}
function refreshSearch() {
  searchResults.value = {
    index: -1,
    count: engine.value?.matches(query.value, caseSensitive.value).length || 0,
  }
}
function find(direction = 1) {
  searchResults.value = engine.value.find(
    query.value,
    searchResults.value.index + direction,
    caseSensitive.value,
  )
}
function replaceFound(all = false) {
  if (locked.value) return
  engine.value.replaceMatches(query.value, replacement.value, all, caseSensitive.value)
  refreshSearch()
}
function toolbarKeys(event) {
  if (
    !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) ||
    event.target.tagName !== 'BUTTON'
  )
    return
  const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
  const index = buttons.indexOf(event.target)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
  event.preventDefault()
  buttons[next]?.focus()
}
function escape(event) {
  if (event.key === 'Escape') fullscreen.value = false
}
onMounted(() => window.addEventListener('keydown', escape))
watch(
  () => props.modelValue,
  (value) => {
    if (engine.value && !engine.value.composing && engine.value.getHTML() !== value)
      engine.value.replace(value, props.blockIds)
  },
)
onBeforeUnmount(() => {
  engine.value?.destroy()
  window.removeEventListener('keydown', escape)
})
defineExpose({
  isComposing: () => !!engine.value?.composing,
  setSharedHistory: (history) => {
    if (engine.value) {
      engine.value.sharedHistory = history
      engine.value.publishState()
    }
  },
  refreshMedia: (resolve) => engine.value?.refreshMedia(resolve),
  getModel: () => engine.value?.getModel(),
  setModel: (model) => engine.value?.setModel(model),
  applyOperations: (transaction) => engine.value?.applyOperations(transaction),
  insert,
  replace,
  rememberSelection,
  getHTML: () => engine.value?.getHTML() || props.modelValue || '',
  focus: () => {
    if (!props.disabled) engine.value?.root.focus()
  },
  undo: () => engine.value?.undo(),
  redo: () => engine.value?.redo(),
  getDocument: () => engine.value?.getDocument(),
  getHistoryStats: () => engine.value?.history.stats,
})
</script>

<template>
  <section
    class="native-editor"
    :class="{ 'native-fullscreen': fullscreen, 'native-disabled': disabled }"
    :inert="disabled || undefined"
    :aria-disabled="disabled"
    :aria-label="t('Studio görsel editör')"
  >
    <div
      v-if="Object.keys(menus).length"
      ref="menubar"
      class="native-menubar"
      :aria-label="t('Editör menüleri')"
      @keydown="menubarKeys"
    >
      <button
        v-for="(_, name) in menus"
        :key="name"
        :aria-expanded="popup === name"
        aria-haspopup="menu"
        @pointerdown.prevent
        @pointerenter="hoverMenu(name, $event)"
        @click="togglePopup(name, $event)"
        @keydown.down.prevent="togglePopup(name, $event)"
      >
        {{ t(name) }}
      </button>
      <span class="native-editor-label">studio<span>.</span></span>
    </div>
    <EditorPopover
      v-if="menus[popup]"
      :key="popup"
      :anchor="popupAnchor"
      :label="t(popup)"
      @close="popup = null"
    >
      <div class="editor-menu" role="menu" @keydown="menuKeys">
        <button
          v-for="item in menus[popup]"
          :key="item.label"
          :class="{
            'menu-separated': [
              'Bul ve değiştir',
              'Görsel veya medya',
              'Kalın',
              'Alıntı',
              'Tablo ekle',
              'Biçimlendirmeyi temizle',
            ].includes(item.label),
          }"
          role="menuitem"
          :aria-label="t(item.label)"
          :disabled="item.disabled"
          @click="runMenu(item)"
        >
          <component :is="item.icon" :size="17" /><span>{{ t(item.label) }}</span
          ><kbd v-if="item.shortcut">{{ item.shortcut }}</kbd
          ><Check v-if="item.active" :size="15" class="menu-check" />
        </button>
      </div>
    </EditorPopover>
    <EditorPopover
      v-if="['fonts', 'sizes', 'blocks'].includes(popup)"
      :key="popup"
      :anchor="popupAnchor"
      :label="
        popup === 'fonts'
          ? t('Yazı tipi menüsü')
          : popup === 'sizes'
            ? t('Yazı boyutu menüsü')
            : t('Paragraf biçimi menüsü')
      "
      @close="popup = null"
    >
      <div class="typography-menu" :class="`typography-${popup}`" role="menu" @keydown="menuKeys">
        <button
          v-for="item in typeOptions"
          :key="item.value"
          role="menuitemradio"
          :aria-checked="item.selected"
          :style="item.style"
          @click="applyTypography(item)"
        >
          <Check :size="15" :style="{ visibility: item.selected ? 'visible' : 'hidden' }" /><span>{{
            t(item.label)
          }}</span>
        </button>
      </div>
    </EditorPopover>
    <TablePicker
      v-if="popup === 'table'"
      :anchor="popupAnchor"
      @close="popup = null"
      @insert="insertPickedTable"
      @custom="customTable"
    />
    <ColorPalette
      v-if="['foreground', 'highlight'].includes(popup)"
      :key="popup"
      :anchor="popupAnchor"
      :label="popup === 'highlight' ? t('Vurgu rengi') : t('Metin rengi')"
      :value="popup === 'highlight' ? background : foreground"
      :highlight="popup === 'highlight'"
      @select="applyColor"
      @close="popup = null"
    />
    <EditorPopover
      v-if="popup === 'contentStyles'"
      :anchor="popupAnchor"
      :label="t('İçerik stilleri')"
      @close="popup = null"
    >
      <div class="editor-menu" role="menu" :aria-label="t('İçerik stilleri')" @keydown="menuKeys">
        <button
          v-for="style in contentStyles"
          :key="style.id"
          role="menuitemradio"
          :aria-checked="state.contentStyle === style.id"
          @click="applyNamedStyle(style.id)"
        >
          <Palette :size="16" /><span>{{ activeLocale === 'en' ? style.en : style.label }}</span>
        </button>
      </div>
    </EditorPopover>
    <div
      v-if="firstRow || secondRow"
      class="native-toolbar"
      :class="{ 'toolbar-expanded': toolbarExpanded }"
      role="toolbar"
      :aria-label="t('Biçimlendirme araçları')"
      @keydown="toolbarKeys"
    >
      <div v-if="firstRow" class="native-toolbar-row">
        <div v-if="tools('history')" class="native-tool-group">
          <button
            class="native-tool"
            :aria-label="t('Geri al')"
            :title="t('Geri al · Ctrl / ⌘ + Z')"
            :disabled="!state.canUndo"
            @pointerdown.prevent
            @click="command('undo')"
          >
            <Undo2 :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Yinele')"
            :title="t('Yinele · Ctrl / ⌘ + Shift + Z')"
            :disabled="!state.canRedo"
            @pointerdown.prevent
            @click="command('redo')"
          >
            <Redo2 :size="17" />
          </button>
        </div>
        <div v-if="tools('typography')" class="native-tool-group">
          <button
            class="native-menu-select block-select"
            :aria-label="t('Paragraf biçimi')"
            aria-haspopup="menu"
            :aria-expanded="popup === 'blocks'"
            @pointerdown.prevent
            @click="togglePopup('blocks', $event)"
            @keydown.down.prevent="togglePopup('blocks', $event)"
          >
            <span>{{ t(blockLabel) }}</span
            ><ChevronDown :size="14" />
          </button>
          <button
            class="native-menu-select font-select"
            :aria-label="t('Yazı tipi')"
            aria-haspopup="menu"
            :aria-expanded="popup === 'fonts'"
            @pointerdown.prevent
            @click="togglePopup('fonts', $event)"
            @keydown.down.prevent="togglePopup('fonts', $event)"
          >
            <span>{{ fontLabel }}</span
            ><ChevronDown :size="14" />
          </button>
          <button
            class="native-menu-select size-select"
            :aria-label="t('Yazı boyutu')"
            aria-haspopup="menu"
            :aria-expanded="popup === 'sizes'"
            @pointerdown.prevent
            @click="togglePopup('sizes', $event)"
            @keydown.down.prevent="togglePopup('sizes', $event)"
          >
            <span>{{ parseFloat(state.fontSize || '16') }} px</span><ChevronDown :size="14" />
          </button>
        </div>
        <div v-if="tools('format') || tools('color')" class="native-tool-group">
          <button
            v-for="tool in tools('format') ? markButtons : []"
            :key="tool.command"
            class="native-tool"
            :aria-label="t(tool.title)"
            :title="t(tool.title)"
            :aria-pressed="!!state[tool.command]"
            @pointerdown.prevent
            @click="command('inline', tool.command)"
          >
            <component :is="tool.icon" :size="17" />
          </button>
          <button
            v-if="tools('color')"
            class="native-color"
            :title="t('Metin rengi')"
            :aria-label="t('Metin rengi')"
            aria-haspopup="menu"
            :aria-expanded="popup === 'foreground'"
            @pointerdown.prevent
            @click="togglePopup('foreground', $event)"
          >
            <span :style="{ borderColor: foreground }">A</span><ChevronDown :size="11" />
          </button>
          <button
            v-if="tools('color')"
            class="native-color"
            :title="t('Vurgu rengi')"
            :aria-label="t('Vurgu rengi')"
            aria-haspopup="menu"
            :aria-expanded="popup === 'highlight'"
            @pointerdown.prevent
            @click="togglePopup('highlight', $event)"
          >
            <span :style="{ borderColor: background }" class="highlight-letter">A</span
            ><ChevronDown :size="11" />
          </button>
        </div>
      </div>
      <div v-if="secondRow" class="native-toolbar-row">
        <div v-if="tools('align')" class="native-tool-group">
          <button
            v-for="tool in alignButtons"
            :key="tool.value"
            class="native-tool"
            :aria-label="t(tool.title)"
            :title="t(tool.title)"
            :aria-pressed="state.align === tool.value"
            @pointerdown.prevent
            @click="command('align', tool.value)"
          >
            <component :is="tool.icon" :size="17" />
          </button>
        </div>
        <div v-if="tools('lists')" class="native-tool-group">
          <button
            class="native-tool"
            :aria-label="t('Madde işaretli liste')"
            :title="t('Madde işaretli liste')"
            :aria-pressed="state.list === 'ul'"
            @pointerdown.prevent
            @click="command('list', 'ul')"
          >
            <List :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Numaralı liste')"
            :title="t('Numaralı liste')"
            :aria-pressed="state.list === 'ol'"
            @pointerdown.prevent
            @click="command('list', 'ol')"
          >
            <ListOrdered :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Girintiyi artır')"
            :title="t('Liste girintisini artır · Tab')"
            :disabled="!state.list"
            @pointerdown.prevent
            @click="command('indent')"
          >
            <IndentIncrease :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Girintiyi azalt')"
            :title="t('Liste girintisini azalt · Shift + Tab')"
            :disabled="!state.list"
            @pointerdown.prevent
            @click="command('indent', true)"
          >
            <IndentDecrease :size="17" />
          </button>
        </div>
        <div v-if="tools('insert')" class="native-tool-group">
          <button
            class="native-tool"
            :aria-label="t('Bağlantı ekle')"
            :title="t('Bağlantı ekle veya düzenle')"
            :aria-pressed="!!state.link"
            @pointerdown.prevent
            @click="openDialog('link')"
          >
            <Link :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Medya kütüphanesini aç')"
            :title="t('Medya kütüphanesi')"
            @pointerdown.prevent
            @click="openMedia"
          >
            <Image :size="17" />
          </button>
          <button
            class="native-tool native-table-button"
            :aria-label="t('Tablo ekle')"
            :aria-expanded="popup === 'table'"
            :title="t('Tablo ekle')"
            @pointerdown.prevent
            @click="togglePopup('table', $event)"
          >
            <Table2 :size="17" /><ChevronDown :size="12" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Bağlantıdan medya ekle')"
            :title="t('YouTube / Vimeo')"
            @pointerdown.prevent
            @click="openEmbed()"
          >
            <Film :size="17" />
          </button>
        </div>
        <div v-if="tools('tools')" class="native-tool-group">
          <button
            class="native-tool native-menu-button"
            :aria-label="t('İçerik stilleri')"
            :title="t('İçerik stilleri')"
            :aria-expanded="popup === 'contentStyles'"
            @pointerdown.prevent
            @click="togglePopup('contentStyles', $event)"
          >
            <Palette :size="17" /><ChevronDown :size="12" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Belge başlıkları')"
            :title="t('Belge başlıkları')"
            :aria-pressed="outlineOpen"
            @pointerdown.prevent
            @click="outlineOpen = !outlineOpen"
          >
            <ListTree :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Görev listesi')"
            :title="t('Görev listesi')"
            :aria-pressed="state.taskList"
            @pointerdown.prevent
            @click="command('taskList')"
          >
            <ListChecks :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Biçimlendirmeyi temizle')"
            :title="t('Biçimlendirmeyi temizle')"
            @pointerdown.prevent
            @click="command('clearFormat')"
          >
            <RemoveFormatting :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Bul ve değiştir')"
            :title="t('Bul ve değiştir · Ctrl / ⌘ + F')"
            :aria-pressed="searchOpen"
            @pointerdown.prevent
            @click="searchOpen = !searchOpen"
          >
            <Search :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="fullscreen ? t('Tam ekrandan çık') : t('Tam ekran')"
            :title="fullscreen ? t('Tam ekrandan çık · Esc') : t('Tam ekran')"
            :aria-pressed="fullscreen"
            @pointerdown.prevent
            @click="fullscreen = !fullscreen"
          >
            <Minimize2 v-if="fullscreen" :size="17" /><Maximize2 v-else :size="17" />
          </button>
        </div>
        <div v-if="tools('review')" class="content-tool-strip" :aria-label="t('İçerik araçları')">
          <button
            :aria-pressed="reviewTab === 'suggestions'"
            @pointerdown.prevent
            @click="openReview('suggestions')"
          >
            {{ t('Öneriler') }}
          </button>
          <button @pointerdown.prevent @click="openDialog('templates')">
            <LayoutTemplate :size="15" /> {{ t('Şablonlar') }}
          </button>
          <button
            :aria-pressed="reviewTab === 'comments'"
            @pointerdown.prevent
            @click="openReview('comments')"
          >
            <MessageSquare :size="15" /> {{ t('Yorumlar') }}
            <b v-if="commentCount">{{ commentCount }}</b>
          </button>
          <button
            :aria-pressed="reviewTab === 'check'"
            @pointerdown.prevent
            @click="openReview('check')"
          >
            <ScanEye :size="16" /> {{ t('İçerik denetimi') }}
          </button>
          <button
            v-if="format"
            class="format-paste-button"
            @pointerdown.prevent
            @click="pasteFormat"
          >
            <Paintbrush :size="14" /> {{ t('Biçimi uygula') }}
          </button>
        </div>
      </div>
    </div>
    <button
      v-if="firstRow || secondRow"
      class="toolbar-overflow-toggle"
      :aria-expanded="toolbarExpanded"
      :aria-label="toolbarExpanded ? t('Araçları daralt') : t('Tüm araçları göster')"
      :title="toolbarExpanded ? t('Araçları daralt') : t('Tüm araçları göster')"
      @pointerdown.prevent
      @click="toolbarExpanded = !toolbarExpanded"
    >
      <X v-if="toolbarExpanded" :size="19" /><Ellipsis v-else :size="20" />
    </button>
    <div v-if="toolNotice" class="native-message" role="status">
      {{ t(toolNotice)
      }}<button class="icon-button" :aria-label="t('Bilgiyi kapat')" @click="toolNotice = ''">
        <X :size="14" />
      </button>
    </div>
    <div v-if="!locked && state.link && !state.image" class="native-context">
      <span><Link :size="14" /> {{ state.link.href?.slice(0, 70) }}</span
      ><button @pointerdown.prevent @click="openDialog('link')">
        {{ t('Bağlantıyı düzenle') }}</button
      ><button @pointerdown.prevent @click="command('unlink')">
        <Unlink :size="13" /> {{ t('Bağlantıyı kaldır') }}
      </button>
    </div>
    <div
      v-if="searchOpen"
      class="native-find"
      role="search"
      :aria-label="t('Belgede bul ve değiştir')"
    >
      <div>
        <label class="search-box"
          ><Search :size="15" /><input
            ref="searchInput"
            v-model="query"
            :aria-label="t('Aranacak metin')"
            :placeholder="t('Belgede ara…')"
            @input="refreshSearch"
            @keydown.enter.prevent="find(1)" /></label
        ><span class="find-count">{{
          searchResults.count
            ? `${Math.max(0, searchResults.index + 1)} / ${searchResults.count}`
            : t('Sonuç yok')
        }}</span
        ><button
          class="icon-button"
          :aria-label="t('Önceki eşleşme')"
          :disabled="!searchResults.count"
          @click="find(-1)"
        >
          <ArrowUp :size="16" /></button
        ><button
          class="icon-button"
          :aria-label="t('Sonraki eşleşme')"
          :disabled="!searchResults.count"
          @click="find(1)"
        >
          <ArrowDown :size="16" /></button
        ><label class="case-check"
          ><input v-model="caseSensitive" type="checkbox" @change="refreshSearch" />
          {{ t('Büyük/küçük harf') }}</label
        ><button class="icon-button" :aria-label="t('Aramayı kapat')" @click="searchOpen = false">
          <X :size="16" />
        </button>
      </div>
      <div v-if="!locked">
        <input
          v-model="replacement"
          class="text-input"
          :aria-label="t('Yerine yazılacak metin')"
          :placeholder="t('Yerine yazılacak metin…')"
        /><button class="button" :disabled="searchResults.index < 0" @click="replaceFound()">
          {{ t('Değiştir') }}</button
        ><button class="button" :disabled="!searchResults.count" @click="replaceFound(true)">
          {{ t('Tümünü değiştir') }}
        </button>
      </div>
    </div>
    <div v-if="error && !dialog" class="native-message" role="alert">
      {{ t(error)
      }}<button class="icon-button" :aria-label="t('Hata mesajını kapat')" @click="error = ''">
        <X :size="14" />
      </button>
    </div>
    <div v-if="busy" class="native-message" role="status">
      {{ t('Medya dosyaları ekleniyor…') }}
    </div>
    <div class="native-editing-area">
      <DocumentOutline
        v-if="outlineOpen && engine"
        :engine="engine"
        :frame="frame"
        @close="outlineOpen = false"
      />
      <MentionMenu
        v-if="engine && !locked"
        ref="mentionMenu"
        :engine="engine"
        :frame="frame"
        :query="dialog || popup ? null : (state.mentionQuery ?? null)"
        :mentions="mentions"
        :allow-create="allowCreateMention"
      />
      <WritingMenu
        v-if="engine && !locked"
        ref="writingMenu"
        :engine="engine"
        :frame="frame"
        :query="dialog || popup ? null : (state.slashQuery ?? null)"
        :extra-commands="slashCommands"
        @action="slashAction"
      />
      <div class="native-canvas">
        <iframe
          ref="frame"
          class="studio-editor-frame"
          :tabindex="disabled ? -1 : 0"
          :title="t('Belge düzenleme alanı')"
          sandbox="allow-same-origin allow-scripts"
          :srcdoc="frameDocument"
          @load="initialize"
        ></iframe>
        <BlockControls
          v-if="engine && !locked"
          :engine="engine"
          :state="state"
          :frame="frame"
          :suspended="!!dialog || !!popup || !!state.table || !!state.image || !!state.mediaEmbed"
        />
        <ImageControls
          v-if="!locked"
          :engine="engine"
          :state="state"
          :frame="frame"
          @command="command"
          @edit="openImageEditor"
          @properties="openDialog('image')"
        />
        <MediaEmbedControls
          v-if="engine && !locked"
          :engine="engine"
          :state="state"
          :frame="frame"
          :suspended="!!dialog || !!popup"
          @edit="openEmbed"
        />
        <TableControls
          v-if="!locked"
          ref="tableControls"
          :engine="engine"
          :state="state"
          :frame="frame"
          :suspended="!!dialog || !!popup"
          @command="command"
          @cell-format="openCellFormat"
          @options="togglePopup('Tablo', $event)"
        />
      </div>
      <ReviewPanel
        v-if="reviewTab"
        :engine="engine"
        :state="state"
        :tab="reviewTab"
        @close="reviewTab = null"
        @tab="reviewTab = $event"
      />
    </div>
    <EditorContextMenu
      ref="contextMenu"
      :engine="engine"
      :frame="frame"
      :state="state"
      @action="contextAction"
      @open="popup = null"
      @notice="toolNotice = $event"
    />
    <MediaEmbedDialog
      v-if="dialog === 'embed'"
      :engine="engine"
      :target="embedTarget"
      @close="dialog = null"
    />
    <div class="native-statusbar">
      <span v-if="disabled">{{ t('Devre dışı') }}</span
      ><span v-else-if="readonly">{{ t('Salt okunur') }}</span
      ><span v-else-if="state.image">{{ t('Görselin köşelerini sürükleyerek boyutlandırın') }}</span
      ><span v-else-if="state.table">{{ t('Tablo · Hücreler arasında Tab ile ilerleyin') }}</span
      ><span v-else>{{ state.block === 'p' ? t('Paragraf') : state.block.toUpperCase() }}</span
      ><button
        @click="fullscreen = !fullscreen"
        :title="fullscreen ? t('Tam ekrandan çık') : t('Düzenleme alanını genişlet')"
        :aria-label="t('Düzenleme alanını genişlet')"
      >
        <Maximize2 :size="13" />
      </button>
    </div>

    <TemplateLibrary v-if="dialog === 'templates'" :engine="engine" @close="dialog = null" />
    <PrintDialog
      v-if="dialog === 'print'"
      :html="engine?.getHTML() || modelValue"
      @close="dialog = null"
    />
    <CellFormatDialog
      v-if="dialog === 'cellFormat' && cellFormatSession"
      :engine="engine"
      :session="cellFormatSession"
      @close="dialog = null"
    />
    <ImageEditor
      v-if="dialog === 'imageEdit' && imageTarget"
      :src="imageTarget.currentSrc || imageTarget.src"
      :alt="imageTarget.alt"
      :apply="applyImageEdit"
      @close="dialog = null"
    />
    <AppDialog v-if="dialog === 'link'" :title="t('Bağlantı')" @close="dialog = null">
      <form id="link-form" class="native-form" @submit.prevent="applyLink">
        <label class="field-label"
          >{{ t('Bağlantı adresi')
          }}<input
            v-model="linkForm.href"
            class="text-input"
            :aria-label="t('Bağlantı adresi')"
            :placeholder="t('https://ornek.com')"
            required
            autofocus /></label
        ><label class="field-label"
          >{{ t('Görünen metin')
          }}<input v-model="linkForm.text" class="text-input" :aria-label="t('Görünen metin')"
        /></label>
        <p class="muted">{{ t('Seçili metin varsa biçimlendirmesi korunur.') }}</p>
        <label class="native-checkbox"
          ><input v-model="linkForm.blank" type="checkbox" /> {{ t('Yeni sekmede aç') }}</label
        >
        <p v-if="error" class="error-banner" role="alert">{{ t(error) }}</p>
      </form>
      <template #footer
        ><button v-if="state.link" class="button" @click="removeLink">
          {{ t('Bağlantıyı kaldır') }}</button
        ><button class="button" @click="dialog = null">{{ t('Vazgeç') }}</button
        ><button class="button primary" form="link-form" type="submit">
          <Check :size="16" /> {{ t('Bağlantıyı uygula') }}
        </button></template
      >
    </AppDialog>
    <AppDialog v-if="dialog === 'table'" :title="t('Tablo ekle')" @close="dialog = null"
      ><form id="table-form" class="native-form" @submit.prevent="applyTable">
        <div class="native-form-row">
          <label class="field-label"
            >{{ t('Satır sayısı')
            }}<input
              v-model="tableForm.rows"
              class="text-input"
              type="number"
              min="1"
              max="20"
              required
              :aria-label="t('Satır sayısı')" /></label
          ><label class="field-label"
            >{{ t('Sütun sayısı')
            }}<input
              v-model="tableForm.columns"
              class="text-input"
              type="number"
              min="1"
              max="10"
              required
              :aria-label="t('Sütun sayısı')"
          /></label>
        </div>
        <label class="native-checkbox"
          ><input v-model="tableForm.header" type="checkbox" />
          {{ t('İlk satır başlık olsun') }}</label
        >
        <p class="muted">
          {{
            t(
              'Hücreler arasında Tab ile ilerleyin. Tabloya tıklayarak satır ve sütun işlemlerine ulaşın.',
            )
          }}
        </p>
      </form>
      <template #footer
        ><button class="button" @click="dialog = null">{{ t('Vazgeç') }}</button
        ><button class="button primary" form="table-form" type="submit">
          <Table2 :size="16" /> {{ t('Tabloyu oluştur') }}
        </button></template
      ></AppDialog
    >
    <AppDialog v-if="dialog === 'image'" :title="t('Görsel özellikleri')" @close="dialog = null"
      ><form id="image-form" class="native-form" @submit.prevent="applyImage">
        <label class="field-label"
          >{{ t('Alternatif metin')
          }}<input
            v-model="imageForm.alt"
            class="text-input"
            :aria-label="t('Görsel alternatif metni')" /></label
        ><label class="field-label"
          >{{ t('Genişlik')
          }}<input
            v-model="imageForm.width"
            class="text-input"
            :aria-label="t('Görsel genişliği')"
            :placeholder="t('Örn. 480px veya 100%')"
            pattern="[0-9]{1,4}(px|%)?"
        /></label>
        <p class="muted">{{ t('Oranlar korunur. Doğal boyut için genişliği boş bırakın.') }}</p>
      </form>
      <template #footer
        ><button class="button" @click="dialog = null">{{ t('Vazgeç') }}</button
        ><button class="button primary" type="submit" form="image-form">
          {{ t('Görseli güncelle') }}
        </button></template
      ></AppDialog
    >
    <AppDialog v-if="dialog === 'code'" :title="t('Kod bloğu ekle')" @close="dialog = null"
      ><form id="code-form" class="native-form" @submit.prevent="applyCode">
        <label class="field-label"
          >{{ t('Dil')
          }}<select v-model="codeForm.language" class="text-input" :aria-label="t('Kod dili')">
            <option
              v-for="language in [
                'javascript',
                'html',
                'css',
                'json',
                'sql',
                'php',
                'python',
                'bash',
              ]"
              :key="language"
              :value="language"
            >
              {{ language }}
            </option>
          </select></label
        ><label class="field-label"
          >{{ t('Kod')
          }}<textarea
            v-model="codeForm.code"
            class="native-code-input"
            :aria-label="t('Eklenecek kod')"
            rows="10"
            required
            spellcheck="false"
          ></textarea>
        </label>
        <p class="muted">{{ t('Kod, çalıştırılmadan metin olarak belgeye eklenir.') }}</p>
      </form>
      <template #footer
        ><button class="button" @click="dialog = null">{{ t('Vazgeç') }}</button
        ><button class="button primary" type="submit" form="code-form">
          {{ t('Kod bloğunu ekle') }}
        </button></template
      ></AppDialog
    >
  </section>
</template>
