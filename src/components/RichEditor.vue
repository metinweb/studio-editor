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
  FlaskConical,
  ListChecks,
  Palette,
  ALargeSmall,
  ArrowDownUp,
  Clock,
  Smile,
  Pilcrow,
  CircleHelp,
  FileUp,
  Bookmark,
  Braces,
  Eye,
  Printer,
  WholeWord,
  SquareDashed,
  TextCursorInput,
} from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import EditorPopover from './EditorPopover.vue'
import EditorMenu from './EditorMenu.vue'
import SelectionToolbar from './SelectionToolbar.vue'
import EditingGuides from './EditingGuides.vue'
import { listStyles, lineHeights, symbolGroups } from '../lib/menu-options.js'
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
import { documentCss, escapeHtml, renderDocument } from '../lib/content'
import { useEditorMedia } from '../stores/editor-media'
import { assetUrl } from '../lib/media-service'
import { includesOption, menuNames } from '../lib/editor-options'
import { readScience } from '../lib/science.js'
import { defaultWritingPreferences, defaultPen } from '../lib/writing-preferences.js'
import './rich-editor.css'
import './content-tools.css'
import './image-editor.css'
const TemplateLibrary = defineAsyncComponent(() => import('./TemplateLibrary.vue'))
const ImageEditor = defineAsyncComponent(() => import('./ImageEditor.vue'))
const PrintDialog = defineAsyncComponent(() => import('./PrintDialog.vue'))
const MediaEmbedDialog = defineAsyncComponent(() => import('./MediaEmbedDialog.vue'))
const ScienceDialog = defineAsyncComponent(() => import('./ScienceDialog.vue'))
const WordImportDialog = defineAsyncComponent(() => import('./WordImportDialog.vue'))
const DocumentFieldsDialog = defineAsyncComponent(() => import('./DocumentFieldsDialog.vue'))
const MarkdownDialog = defineAsyncComponent(() => import('./MarkdownDialog.vue'))
const WritingSettingsDialog = defineAsyncComponent(() => import('./WritingSettingsDialog.vue'))
const TableFormulaDialog = defineAsyncComponent(() => import('./TableFormulaDialog.vue'))
const ConditionalFieldDialog = defineAsyncComponent(() => import('./ConditionalFieldDialog.vue'))

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
const writingPreferences = ref(defaultWritingPreferences())
const permanentPen = ref(defaultPen())
function applyWritingSettings(value) {
  if (locked.value) return
  if (dialog.value === 'pen') {
    permanentPen.value = value
    engine.value.permanentPen = value
  } else {
    writingPreferences.value = value
    engine.value.writingPreferences = value
  }
}
function stopPen() {
  permanentPen.value = { ...permanentPen.value, enabled: false }
  engine.value.permanentPen = permanentPen.value
}
const writingMenu = ref(null)
const mentionMenu = ref(null)
const outlineOpen = ref(false)
const frame = ref(null)
const contextMenu = ref(null)
const tableControls = ref(null)
const cellFormatSession = shallowRef(null)
const conditionalTarget = shallowRef(null)
const imageTarget = shallowRef(null)
const embedTarget = shallowRef(null)
const scienceTarget = shallowRef(null)
function openScience(target = null) {
  if (locked.value || !engine.value?.editable || engine.value.destroyed) return
  rememberSelection()
  scienceTarget.value = target
  popup.value = null
  dialog.value = 'science'
}
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
const visualBlocks = ref(false),
  invisibleCharacters = ref(false),
  quickToolbar = ref(true),
  editorZoom = ref(100)
const fontSizeInput = ref(16)
const previewHtml = ref('')
const metrics = ref(null)
const anchorOptions = computed(() => {
  state.value
  return [...(engine.value?.root.querySelectorAll('[id]') || [])]
    .filter((node) => !node.closest('[data-studio-footnotes],[data-studio-footnote-ref]'))
    .map((node) => ({ id: node.id, label: node.textContent.trim().slice(0, 60) || node.id }))
})
function openPreview() {
  popup.value = null
  previewHtml.value = renderDocument({
    title: 'Studio',
    content: engine.value?.getHTML() || '',
    locale: activeLocale.value,
  })
  dialog.value = 'preview'
}
function openMetrics() {
  const count = (text) => ({
    words: [
      ...new Intl.Segmenter(activeLocale.value, { granularity: 'word' }).segment(text),
    ].filter((part) => part.isWordLike).length,
    characters: [...text].length,
    noSpaces: [...text.replace(/\s/gu, '')].length,
  })
  metrics.value = {
    document: count(engine.value?.root.innerText || ''),
    selection: count(engine.value?.doc.getSelection()?.toString() || ''),
  }
  popup.value = null
  dialog.value = 'metrics'
}
function applyFontSize() {
  const size = Number(fontSizeInput.value)
  if (!Number.isFinite(size) || size < 8 || size > 200) return
  popup.value = null
  command('inline', null, { fontSize: `${size}px` })
}
watch(
  () => [visualBlocks.value, editorZoom.value],
  () => {
    if (!engine.value) return
    engine.value.root.dataset.visualBlocks = String(visualBlocks.value)
    engine.value.root.style.zoom = `${editorZoom.value}%`
  },
)
const dialog = ref(null)
const listForm = ref({ start: 1, reversed: false })
const symbolGroup = ref('Simgeler')
const commandQuery = ref('')
const listTag = computed(() => (popup.value === 'bulletStyles' ? 'ul' : 'ol'))
function applyListStyle(tag, value) {
  popup.value = null
  command('list', tag, value)
}
function removeCurrentList() {
  const tag = listTag.value
  popup.value = null
  command('list', tag)
}
function openListProperties() {
  listForm.value = { start: state.value.listStart, reversed: state.value.listReversed }
  openDialog('listProperties')
}
function applyListProperties() {
  command('listProperties', Number(listForm.value.start), listForm.value.reversed)
  dialog.value = null
}
function insertSymbol(value) {
  insert(escapeHtml(value))
  dialog.value = null
}
function insertDate(kind) {
  const date = new Date()
  const value =
    kind === 'iso'
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      : kind === 'time'
        ? date.toLocaleTimeString(activeLocale.value, { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString(activeLocale.value, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
  insert(escapeHtml(value))
}
function selectAll() {
  const range = engine.value.doc.createRange()
  range.selectNodeContents(engine.value.root)
  engine.value.root.focus()
  const selection = engine.value.doc.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  rememberSelection()
}
function openCommandSearch() {
  rememberSelection()
  popupAnchor.value = menubar.value?.querySelector('.native-command-search') || popupAnchor.value
  popup.value = null
  commandQuery.value = ''
  dialog.value = 'commands'
}
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
const wholeWord = ref(false)
const ignoreAccents = ref(false)
const matchPreviews = ref([])
const replaceNotice = ref('')
const searchOptions = () => ({ wholeWord: wholeWord.value, ignoreAccents: ignoreAccents.value })
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
  { label: 'Başlık 5', value: 'h5', size: '14px' },
  { label: 'Başlık 6', value: 'h6', size: '12px' },
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
    { label: 'Markdown içe aktar', icon: FileUp, action: () => openDialog('markdownImport') },
    {
      label: 'Markdown dışa aktar',
      icon: FileText,
      action: () => {
        popup.value = null
        dialog.value = 'markdownExport'
      },
    },
    { label: 'Word dosyası içe aktar', icon: FileUp, action: () => openDialog('importWord') },
    { label: 'Belge önizlemesi', icon: Eye, action: openPreview },
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
    { label: 'Tümünü seç', shortcut: 'Ctrl A', action: selectAll },
  ],
  Görünüm: [
    { label: 'Belge önizlemesi', icon: Eye, action: openPreview },
    {
      label: 'Blok sınırlarını göster',
      icon: SquareDashed,
      active: visualBlocks.value,
      action: () => {
        visualBlocks.value = !visualBlocks.value
      },
    },
    {
      label: 'Görünmeyen karakterleri göster',
      icon: Pilcrow,
      active: invisibleCharacters.value,
      action: () => {
        invisibleCharacters.value = !invisibleCharacters.value
      },
    },
    {
      label: 'Seçili metin araçları',
      icon: TextCursorInput,
      active: quickToolbar.value,
      action: () => {
        quickToolbar.value = !quickToolbar.value
      },
    },
    {
      label: 'Yakınlaştırma',
      icon: Search,
      children: [75, 100, 125, 150, 200].map((value) => ({
        label: `${value}%`,
        active: editorZoom.value === value,
        action: () => {
          editorZoom.value = value
        },
      })),
    },
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
    {
      label: 'Bağlantı hedefleri',
      icon: Bookmark,
      section: 'Belge öğeleri',
      action: () => openDialog('anchor'),
    },
    { label: 'Dipnotlar', icon: Superscript, action: () => openDialog('footnote') },
    { label: 'Şablon değişkenleri', icon: Braces, action: () => openDialog('fields') },
    {
      label: 'Koşullu alan',
      icon: Braces,
      action: () => {
        conditionalTarget.value = null
        openDialog('condition')
      },
    },
    { label: 'Şablon kütüphanesi', icon: LayoutTemplate, action: () => openDialog('templates') },
    { label: 'Yorum ekle', icon: MessageSquare, action: () => openReview('comments') },
    { label: 'İçindekiler ekle / güncelle', icon: ListTree, action: insertContents },
    { label: 'Görsel veya medya', icon: Image, action: openMedia },
    { label: 'Bağlantıdan medya ekle', icon: Film, action: () => openEmbed() },
    { label: 'Matematik ve kimya', icon: FlaskConical, action: () => openScience() },
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
    {
      label: 'Özel karakterler ve emoji',
      icon: Smile,
      section: 'Belge öğeleri',
      action: () => openDialog('symbols'),
    },
    {
      label: 'Tarih ve saat',
      icon: Clock,
      children: [
        { label: 'Tarih', action: () => insertDate('date') },
        { label: 'Saat', action: () => insertDate('time') },
        { label: 'ISO tarihi', action: () => insertDate('iso') },
      ],
    },
    { label: 'Bölünemez boşluk', action: () => insert('&nbsp;') },
    {
      label: 'Sayfa sonu',
      icon: FileText,
      action: () =>
        insert(
          '<hr data-studio-page-break="true" style="break-after:page;page-break-after:always"><p><br></p>',
        ),
    },
  ],
  Biçim: [
    {
      label: 'Paragraf biçimleri',
      icon: Pilcrow,
      section: 'Paragraf ve listeler',
      children: blocks.map((item) => ({
        label: item.label,
        active: state.value.block === item.value,
        action: () => command('block', item.value),
      })),
    },
    {
      label: 'Hizalama',
      icon: AlignLeft,
      children: alignButtons.map((item) => ({
        label: item.title,
        icon: item.icon,
        active: state.value.align === item.value,
        action: () => command('align', item.value),
      })),
    },
    ...['ul', 'ol'].map((tag) => ({
      label: tag === 'ul' ? 'Madde işareti stilleri' : 'Numaralandırma stilleri',
      icon: tag === 'ul' ? List : ListOrdered,
      children: listStyles[tag].map((item) => ({
        label: item.label,
        active: state.value.list === tag && state.value.listStyle === item.value,
        action: () => applyListStyle(tag, item.value),
      })),
    })),
    {
      label: 'Liste özellikleri',
      icon: ListOrdered,
      disabled: state.value.list !== 'ol',
      action: openListProperties,
    },
    {
      label: 'Satır aralığı',
      icon: ArrowDownUp,
      children: lineHeights.map((value) => ({
        label: value || 'Varsayılan aralık',
        active: state.value.lineHeight === value,
        action: () => command('blockStyle', 'lineHeight', value),
      })),
    },
    {
      label: 'Metin yönü',
      icon: ALargeSmall,
      children: [
        {
          label: 'Soldan sağa',
          active: state.value.direction === 'ltr',
          action: () => command('blockStyle', 'direction', 'ltr'),
        },
        {
          label: 'Sağdan sola',
          active: state.value.direction === 'rtl',
          action: () => command('blockStyle', 'direction', 'rtl'),
        },
      ],
    },
    { label: 'Biçimi kopyala', icon: Paintbrush, action: copyFormat },
    {
      label: 'Kalıcı kalem',
      icon: Paintbrush,
      active: permanentPen.value.enabled,
      action: () => openDialog('pen'),
    },
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
    {
      label: 'Başlık biçiminde harfler',
      icon: ALargeSmall,
      disabled: !state.value.selectedText,
      action: () => command('changeCase', 'title'),
    },
    {
      label: 'Cümle biçiminde harfler',
      icon: ALargeSmall,
      disabled: !state.value.selectedText,
      action: () => command('changeCase', 'sentence'),
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
    {
      label: 'Tablo formülü',
      icon: Table2,
      disabled: !state.value.table,
      action: () => openDialog('formula'),
    },
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
    {
      label: 'Otomatik düzeltme ve metin kısayolları',
      icon: TextCursorInput,
      active: writingPreferences.value.enabled,
      action: () => openDialog('writingSettings'),
    },
    { label: 'Sözcük sayımı', icon: WholeWord, action: openMetrics },
    { label: 'Tipografiyi iyileştir', icon: ALargeSmall, action: () => command('typography') },
    { label: 'Belge yorumları', icon: MessageSquare, action: () => openReview('comments') },
    { label: 'Erişilebilirlik denetimi', icon: ScanEye, action: () => openReview('check') },
    { label: 'Şablon kütüphanesi', icon: LayoutTemplate, action: () => openDialog('templates') },
    { label: 'İçindekiler ekle / güncelle', icon: ListTree, action: insertContents },
    { label: 'Komut bul', icon: Search, action: openCommandSearch },
  ],
  Yardım: [
    { label: 'Komut bul', icon: Search, action: openCommandSearch },
    {
      label: 'Klavye kısayolları',
      icon: CircleHelp,
      action: () => {
        dialog.value = 'help'
      },
    },
  ],
}))
const menuSections = {
  'Sayfa düzeni ve dışa aktarım': 'Belge işlemleri',
  'Yapıştır: biçimi koru': 'Yapıştırma',
  'Geri al': 'Düzenleme',
  'Belge başlıkları': 'Belgede gezinme',
  'Şablon kütüphanesi': 'Belge öğeleri',
  'Görsel veya medya': 'Medya ve bağlantılar',
  'Biçimi kopyala': 'Metin biçimi',
  'Tablo yapıştır: hedef biçimini koru': 'Yapıştırma',
  'Hücre biçimi': 'Hücre işlemleri',
  'Tablo ekle': 'Tablo yapısı',
  'Belge yorumları': 'İnceleme',
}
const menus = computed(() =>
  Object.fromEntries(
    Object.entries(menuNames)
      .filter(([id]) => includesOption(props.menubar, id))
      .map(([, name]) => [
        name,
        allMenus.value[name]
          .filter(
            (item) =>
              !locked.value ||
              [
                'Belgeyi kaydet',
                'Markdown dışa aktar',
                'HTML kaynak kodu',
                'Bul ve değiştir',
                'Tam ekran',
                'Tam ekrandan çık',
                'Belge başlıkları',
                'Komut bul',
                'Klavye kısayolları',
                'Belge önizlemesi',
                'Sözcük sayımı',
                'Yakınlaştırma',
                'Blok sınırlarını göster',
                'Görünmeyen karakterleri göster',
              ].includes(item.label),
          )
          .map((item) => ({ ...item, section: item.section || menuSections[item.label] })),
      ])
      .filter(([, items]) => items.length),
  ),
)
const foundCommands = computed(() => {
  const found = []
  const seen = new Set()
  const visit = (items, section) =>
    items.forEach((item) => {
      if (item.children) visit(item.children, `${section} / ${t(item.label)}`)
      else if (item.label !== 'Komut bul' && !seen.has(item.label)) {
        seen.add(item.label)
        found.push({ ...item, trail: section })
      }
    })
  Object.entries(menus.value).forEach(([name, items]) => visit(items, t(name)))
  const query = commandQuery.value.trim().toLocaleLowerCase(activeLocale.value)
  return found.filter((item) =>
    `${t(item.label)} ${item.trail}`.toLocaleLowerCase(activeLocale.value).includes(query),
  )
})
function runFoundCommand(item) {
  dialog.value = null
  runMenu(item)
}
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
  if (!engine.value.root.querySelector('h1,h2,h3,h4,h5,h6')) {
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
  if (name === 'sizes') fontSizeInput.value = parseFloat(state.value.fontSize) || 16
  popup.value = popup.value === name ? null : name
}
function hoverMenu(name, event) {
  if (
    !menus.value[popup.value] ||
    popup.value === name ||
    event.pointerType === 'touch' ||
    window.innerWidth < 720
  )
    return
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
  if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return
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
        .toLocaleLowerCase(activeLocale.value)
        .startsWith(event.key.toLocaleLowerCase(activeLocale.value)),
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
  else if (id === 'science') openScience()
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
      stopPen()
      fullscreen.value = false
      searchOpen.value = false
    }
  })
  engine.value.writingPreferences = writingPreferences.value
  engine.value.permanentPen = permanentPen.value
  engine.value.listen(engine.value.root, 'click', (event) => {
    if (locked.value) return
    if (event.target.closest?.('[data-studio-thread]')) reviewTab.value = 'comments'
  })
  engine.value.listen(engine.value.root, 'dblclick', (event) => {
    if (locked.value) return
    const conditional = event.target.closest?.('[data-studio-condition]')
    if (conditional) {
      conditionalTarget.value = conditional
      openDialog('condition')
      return
    }
    if (event.target.closest?.('[data-studio-formula]')) {
      openDialog('formula')
      return
    }
    if (event.target.closest?.('[data-studio-footnote-ref], [data-studio-footnote]')) {
      openDialog('footnote')
      return
    }
    if (event.target.closest?.('[data-studio-field]')) {
      openDialog('fields')
      return
    }
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
  root.dataset.visualBlocks = String(visualBlocks.value)
  root.style.zoom = `${editorZoom.value}%`
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
  if (readScience(target)) return openScience(target)
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
function changeSearchQuery() {
  replaceNotice.value = ''
  refreshSearch()
}
function refreshSearch() {
  const matches = engine.value?.matches(query.value, caseSensitive.value, searchOptions()) || []
  searchResults.value = {
    index: -1,
    count: matches.length,
  }
  matchPreviews.value = matches.slice(0, 100).map((range) => {
    const block = range.startContainer.parentElement.closest('p,h1,h2,h3,h4,h5,h6,li,td,th,pre,div')
    const prefix = range.cloneRange()
    prefix.selectNodeContents(block || range.startContainer.parentElement)
    prefix.setEnd(range.startContainer, range.startOffset)
    const before = prefix.toString()
    const text = (block || range.startContainer.parentElement).textContent
    return {
      before: before.slice(-45),
      match: range.toString(),
      after: text.slice(
        before.length + range.toString().length,
        before.length + range.toString().length + 65,
      ),
    }
  })
  const win = engine.value?.doc.defaultView
  if (win?.CSS?.highlights && win.Highlight) {
    win.CSS.highlights.delete('studio-search')
    if (searchOpen.value && matches.length)
      win.CSS.highlights.set('studio-search', new win.Highlight(...matches.slice(0, 1000)))
  }
}
function find(direction = 1, index = null) {
  searchResults.value = engine.value.find(
    query.value,
    index ??
      (searchResults.value.index < 0 && direction < 0 ? -1 : searchResults.value.index + direction),
    caseSensitive.value,
    searchOptions(),
  )
}
function replaceFound(all = false) {
  if (locked.value) return
  const count = engine.value.replaceMatches(
    query.value,
    replacement.value,
    all,
    caseSensitive.value,
    searchOptions(),
  )
  refreshSearch()
  replaceNotice.value = t('{count} eşleşme değiştirildi.', { count })
}
watch(searchOpen, (open) => {
  if (open) {
    refreshSearch()
    nextTick(() => searchInput.value?.focus())
  } else engine.value?.doc.defaultView.CSS?.highlights?.delete('studio-search')
})
watch(
  () => props.locale,
  () => {
    if (searchOpen.value) refreshSearch()
  },
)
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
  openScience: () => openScience(),
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
      <button
        class="native-command-search"
        :aria-label="t('Komut bul')"
        :title="t('Komut bul')"
        @pointerdown.prevent
        @click="openCommandSearch"
      >
        <Search :size="16" /><span>{{ t('Komut bul') }}</span>
      </button>
    </div>
    <EditorPopover
      v-if="menus[popup]"
      :key="popup"
      :anchor="popupAnchor"
      :label="t(popup)"
      @close="popup = null"
    >
      <EditorMenu :items="menus[popup]" :label="popup" @select="runMenu" @navigate="switchMenu" />
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
      <form v-if="popup === 'sizes'" class="font-size-form" @submit.prevent="applyFontSize">
        <input
          v-model="fontSizeInput"
          type="number"
          min="8"
          max="200"
          step="0.5"
          required
          :aria-label="t('Özel yazı boyutu')"
        /><span>px</span
        ><button type="submit" :aria-label="t('Yazı boyutunu uygula')"><Check :size="16" /></button>
      </form>
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
    <EditorPopover
      v-if="['bulletStyles', 'numberStyles'].includes(popup)"
      :key="popup"
      :anchor="popupAnchor"
      :label="t(listTag === 'ul' ? 'Madde işareti stilleri' : 'Numaralandırma stilleri')"
      @close="popup = null"
    >
      <div class="list-style-menu" role="menu" @keydown="menuKeys">
        <div class="editor-menu-section">
          {{ t(listTag === 'ul' ? 'Madde işareti stilleri' : 'Numaralandırma stilleri') }}
        </div>
        <div class="list-style-grid">
          <button
            v-for="item in listStyles[listTag]"
            :key="item.value"
            role="menuitemradio"
            :aria-label="t(item.label)"
            :aria-checked="
              state.list === listTag && state.listStyle === item.value && !state.taskList
            "
            @click="applyListStyle(listTag, item.value)"
          >
            <span class="list-style-preview" aria-hidden="true"
              ><span v-for="(marker, index) in item.markers" :key="index"
                ><b>{{ marker }}</b
                ><i></i></span
            ></span>
            <span>{{ t(item.label) }}</span>
          </button>
        </div>
        <div class="editor-menu list-style-actions">
          <button
            v-if="listTag === 'ol'"
            role="menuitem"
            :disabled="state.list !== 'ol'"
            @click="openListProperties"
          >
            <ListOrdered :size="16" />{{ t('Liste özellikleri') }}
          </button>
          <button role="menuitem" :disabled="state.list !== listTag" @click="removeCurrentList">
            <RemoveFormatting :size="16" />{{ t('Listeyi kaldır') }}
          </button>
        </div>
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
        <div v-if="tools('insert')" class="native-tool-group native-document-tools">
          <button
            class="native-tool"
            :aria-label="t('Word dosyası içe aktar')"
            :title="t('Word dosyası içe aktar')"
            @pointerdown.prevent
            @click="openDialog('importWord')"
          >
            <FileUp :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Belge önizlemesi')"
            :title="t('Belge önizlemesi')"
            @pointerdown.prevent
            @click="openPreview"
          >
            <Eye :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Yazdır / PDF')"
            :title="t('Yazdır / PDF')"
            @pointerdown.prevent
            @click="dialog = 'print'"
          >
            <Printer :size="17" />
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
          <div
            v-for="tag in ['ul', 'ol']"
            :key="tag"
            class="native-list-split"
            :class="{ active: state.list === tag && !state.taskList }"
          >
            <button
              class="native-tool"
              :aria-label="t(tag === 'ul' ? 'Madde işaretli liste' : 'Numaralı liste')"
              :title="t(tag === 'ul' ? 'Madde işaretli liste' : 'Numaralı liste')"
              :aria-pressed="state.list === tag && !state.taskList"
              @pointerdown.prevent
              @click="command('list', tag)"
            >
              <component :is="tag === 'ul' ? List : ListOrdered" :size="17" />
            </button>
            <button
              class="native-tool native-list-arrow"
              :aria-label="t(tag === 'ul' ? 'Madde işareti stilleri' : 'Numaralandırma stilleri')"
              :title="t(tag === 'ul' ? 'Madde işareti stilleri' : 'Numaralandırma stilleri')"
              aria-haspopup="menu"
              :aria-expanded="popup === (tag === 'ul' ? 'bulletStyles' : 'numberStyles')"
              @pointerdown.prevent
              @click="togglePopup(tag === 'ul' ? 'bulletStyles' : 'numberStyles', $event)"
            >
              <ChevronDown :size="12" />
            </button>
          </div>
          <button
            class="native-tool"
            :aria-label="t('Girintiyi artır')"
            :title="t('Liste girintisini artır · Tab')"
            :disabled="!state.block"
            @pointerdown.prevent
            @click="command('indent')"
          >
            <IndentIncrease :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Girintiyi azalt')"
            :title="t('Liste girintisini azalt · Shift + Tab')"
            :disabled="!state.block"
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
          <button
            class="native-tool"
            :aria-label="t('Matematik ve kimya')"
            :title="t('Matematik ve kimya')"
            @pointerdown.prevent
            @click="openScience()"
          >
            <FlaskConical :size="17" />
          </button>
        </div>
        <div v-if="tools('insert')" class="native-tool-group">
          <button
            class="native-tool"
            :aria-label="t('Bağlantı hedefleri')"
            :title="t('Bağlantı hedefleri')"
            @pointerdown.prevent
            @click="openDialog('anchor')"
          >
            <Bookmark :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Dipnotlar')"
            :title="t('Dipnotlar')"
            @pointerdown.prevent
            @click="openDialog('footnote')"
          >
            <Superscript :size="17" />
          </button>
          <button
            class="native-tool"
            :aria-label="t('Şablon değişkenleri')"
            :title="t('Şablon değişkenleri')"
            @pointerdown.prevent
            @click="openDialog('fields')"
          >
            <Braces :size="17" />
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
            maxlength="2000"
            :aria-label="t('Aranacak metin')"
            :placeholder="t('Belgede ara…')"
            @input="changeSearchQuery"
            @keydown.enter.prevent="find($event.shiftKey ? -1 : 1)"
            @keydown.escape.prevent="searchOpen = false" /></label
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
      <div class="search-options">
        <label class="case-check"
          ><input v-model="wholeWord" type="checkbox" @change="refreshSearch" />{{
            t('Tam sözcük')
          }}</label
        >
        <label class="case-check"
          ><input v-model="ignoreAccents" type="checkbox" @change="refreshSearch" />{{
            t('Aksanları yok say')
          }}</label
        >
        <span>{{ t('Korumalı alanlar aramaya dahil edilmez.') }}</span>
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
      <p v-if="replaceNotice" class="search-feedback" role="status">{{ replaceNotice }}</p>
      <p v-if="searchResults.count >= 10000" class="search-feedback" role="status">
        {{ t('İlk 10.000 eşleşme gösteriliyor. Aramayı daraltın.') }}
      </p>
      <details v-if="matchPreviews.length" class="search-previews">
        <summary>
          {{ t('Eşleşme önizlemeleri') }} ({{ matchPreviews.length }} / {{ searchResults.count }})
        </summary>
        <div class="search-preview-list">
          <button
            v-for="(item, index) in matchPreviews"
            :key="index"
            :aria-current="searchResults.index === index ? 'location' : undefined"
            @click="find(0, index)"
          >
            <small>{{ index + 1 }}</small
            ><span
              >{{ item.before }}<mark>{{ item.match }}</mark
              >{{ item.after }}</span
            >
          </button>
        </div>
      </details>
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
        :readonly="locked"
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
          :suspended="!!dialog || !!popup || outlineOpen || searchOpen || !!reviewTab"
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
    <EditingGuides :engine="engine" :state="state" :visible="invisibleCharacters" />
    <SelectionToolbar
      v-if="
        engine && !locked && quickToolbar && (tools('format') || tools('insert') || tools('review'))
      "
      :engine="engine"
      :format-enabled="tools('format')"
      :insert-enabled="tools('insert')"
      :review-enabled="tools('review')"
      :state="state"
      :frame="frame"
      :suspended="
        !!dialog ||
        !!popup ||
        !!reviewTab ||
        outlineOpen ||
        searchOpen ||
        !!state.table ||
        !!state.image ||
        !!state.mediaEmbed
      "
      @command="command"
      @link="openDialog('link')"
      @comment="openReview('comments')"
    />
    <WordImportDialog v-if="dialog === 'importWord'" :engine="engine" @close="dialog = null" />
    <DocumentFieldsDialog
      v-if="['anchor', 'footnote', 'fields'].includes(dialog)"
      :kind="dialog"
      :engine="engine"
      @close="dialog = null"
    />
    <AppDialog
      v-if="dialog === 'preview'"
      :title="t('Belge önizlemesi')"
      wide
      @close="dialog = null"
      ><iframe
        class="document-preview-frame"
        sandbox=""
        :title="t('Belge önizleme içeriği')"
        :srcdoc="previewHtml"
      ></iframe
      ><template #footer
        ><button class="button" @click="dialog = null">{{ t('Kapat') }}</button
        ><button class="button primary" @click="dialog = 'print'">
          {{ t('Yazdır / PDF') }}
        </button></template
      ></AppDialog
    >
    <AppDialog
      v-if="dialog === 'metrics' && metrics"
      :title="t('Sözcük sayımı')"
      @close="dialog = null"
      ><table class="document-metrics">
        <thead>
          <tr>
            <th></th>
            <th>{{ t('Belgenin tamamı') }}</th>
            <th>{{ t('Seçili metin') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="[key, label] in [
              ['words', 'Sözcükler'],
              ['characters', 'Karakterler'],
              ['noSpaces', 'Boşluksuz karakterler'],
            ]"
            :key="key"
          >
            <th>{{ t(label) }}</th>
            <td>{{ metrics.document[key] }}</td>
            <td>{{ metrics.selection[key] }}</td>
          </tr>
        </tbody>
      </table></AppDialog
    >
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
    <ScienceDialog
      v-if="dialog === 'science'"
      :engine="engine"
      :target="scienceTarget"
      @close="dialog = null"
    />
    <div class="native-statusbar">
      <button
        v-if="permanentPen.enabled && !locked"
        class="pen-active"
        :aria-label="t('Kalıcı kalemi kapat')"
        @pointerdown.prevent
        @click="stopPen"
      >
        <Paintbrush :size="14" />{{ t('Kalıcı kalem açık · Esc') }}
      </button>
      <button :aria-label="t('Sözcük sayımı')" @pointerdown.prevent @click="openMetrics">
        <WholeWord :size="14" />{{ t('Sözcük sayımı') }}
      </button>
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
    <TableFormulaDialog v-if="dialog === 'formula'" :engine="engine" @close="dialog = null" />
    <ConditionalFieldDialog
      v-if="dialog === 'condition'"
      :engine="engine"
      :target="conditionalTarget"
      @close="dialog = null"
    />
    <MarkdownDialog
      v-if="dialog === 'markdownImport' || dialog === 'markdownExport'"
      :engine="engine"
      :mode="dialog === 'markdownExport' ? 'export' : 'import'"
      @close="dialog = null"
    />
    <WritingSettingsDialog
      v-if="dialog === 'pen' || dialog === 'writingSettings'"
      :kind="dialog === 'pen' ? 'pen' : 'correction'"
      :preferences="writingPreferences"
      :pen="permanentPen"
      @apply="applyWritingSettings"
      @close="dialog = null"
    />
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
    <AppDialog
      v-if="dialog === 'listProperties'"
      :title="t('Liste özellikleri')"
      @close="dialog = null"
    >
      <form id="list-properties" class="native-form" @submit.prevent="applyListProperties">
        <label class="field-label"
          >{{ t('Başlangıç numarası')
          }}<input
            v-model="listForm.start"
            class="text-input"
            type="number"
            min="-999999"
            max="999999"
            step="1"
            required
            :aria-label="t('Başlangıç numarası')"
        /></label>
        <label class="native-checkbox"
          ><input v-model="listForm.reversed" type="checkbox" />{{
            t('Ters numaralandırma')
          }}</label
        >
        <p class="muted">{{ t('Seçili listeye uygulanır.') }}</p>
      </form>
      <template #footer
        ><button class="button" @click="dialog = null">{{ t('Vazgeç') }}</button
        ><button class="button primary" form="list-properties" type="submit">
          {{ t('Uygula') }}
        </button></template
      >
    </AppDialog>
    <AppDialog
      v-if="dialog === 'symbols'"
      :title="t('Özel karakterler ve emoji')"
      @close="dialog = null"
    >
      <div class="native-form">
        <div class="symbol-tabs" role="group" :aria-label="t('Karakter grupları')">
          <button
            v-for="(_, name) in symbolGroups"
            :key="name"
            :aria-pressed="symbolGroup === name"
            @click="symbolGroup = name"
          >
            {{ t(name) }}
          </button>
        </div>
        <div class="symbol-grid">
          <button
            v-for="symbol in symbolGroups[symbolGroup]"
            :key="symbol"
            :aria-label="symbol"
            @click="insertSymbol(symbol)"
          >
            {{ symbol }}
          </button>
        </div>
      </div>
    </AppDialog>
    <AppDialog v-if="dialog === 'commands'" :title="t('Komut bul')" @close="dialog = null">
      <div class="native-form command-search-panel">
        <input
          v-model="commandQuery"
          class="text-input"
          :placeholder="t('Komut veya özellik ara')"
          :aria-label="t('Komut veya özellik ara')"
          autofocus
          @keydown.down.prevent="
            $event.currentTarget.nextElementSibling?.querySelector('button:not(:disabled)')?.focus()
          "
        />
        <div class="command-results" @keydown="menuKeys">
          <button
            v-for="item in foundCommands"
            :key="item.label"
            :disabled="item.disabled"
            @click="runFoundCommand(item)"
          >
            <span>{{ t(item.label) }}</span
            ><small>{{ item.trail }}</small>
          </button>
          <p v-if="!foundCommands.length" class="muted">{{ t('Komut bulunamadı.') }}</p>
        </div>
      </div>
    </AppDialog>
    <AppDialog v-if="dialog === 'help'" :title="t('Klavye kısayolları')" @close="dialog = null">
      <dl class="editor-shortcuts native-form">
        <template
          v-for="[label, key] in [
            ['Geri al', 'Ctrl / ⌘ Z'],
            ['Yinele', 'Ctrl / ⌘ Shift Z'],
            ['Kalın', 'Ctrl / ⌘ B'],
            ['İtalik', 'Ctrl / ⌘ I'],
            ['Altı çizili', 'Ctrl / ⌘ U'],
            ['Bul ve değiştir', 'Ctrl / ⌘ F'],
            ['Belgeyi kaydet', 'Ctrl / ⌘ S'],
            ['Tümünü seç', 'Ctrl / ⌘ A'],
            ['Menüde gezinme', '↑ ↓ Home End'],
            ['Alt menüyü aç / geri dön', '→ / ←'],
            ['Menüyü kapat', 'Esc'],
          ]"
          :key="label"
          ><dt>{{ t(label) }}</dt>
          <dd>
            <kbd>{{ key }}</kbd>
          </dd></template
        >
      </dl>
    </AppDialog>
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
        <label v-if="anchorOptions.length" class="field-label"
          >{{ t('Belge içindeki hedef')
          }}<select
            class="text-input"
            :aria-label="t('Belge içindeki hedef')"
            @change="linkForm.href = $event.target.value"
          >
            <option value="">{{ t('Hedef seçin') }}</option>
            <option v-for="anchor in anchorOptions" :key="anchor.id" :value="'#' + anchor.id">
              #{{ anchor.id }} — {{ anchor.label }}
            </option>
          </select></label
        >
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
