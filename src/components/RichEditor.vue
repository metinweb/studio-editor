<script setup>
import { provideEditorLocale } from '../lib/editor-locale'
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onMounted,
  onBeforeUnmount,
  provide,
  ref,
  shallowRef,
  watch,
} from 'vue'
import {
  Search,
  Link,
  Unlink,
  X,
  Maximize2,
  Paintbrush,
  WholeWord,
  Lock,
  GitCompareArrows,
} from '@lucide/vue'
import SelectionToolbar from './SelectionToolbar.vue'
import EditingGuides from './EditingGuides.vue'
import ImageControls from './ImageControls.vue'
import TableControls from './TableControls.vue'
import CellFormatDialog from './CellFormatDialog.vue'
import EditorContextMenu from './EditorContextMenu.vue'
import ReviewPanel from './ReviewPanel.vue'
import WritingMenu from './WritingMenu.vue'
import BlockControls from './BlockControls.vue'
import MediaEmbedControls from './MediaEmbedControls.vue'
import MentionMenu from './MentionMenu.vue'
import DocumentOutline from './DocumentOutline.vue'
import PageView from './PageView.vue'
import RemoteCursors from './RemoteCursors.vue'
import EditorToolbar from './rich-editor/EditorToolbar.vue'
import EditorPopups from './rich-editor/EditorPopups.vue'
import EditorFormDialogs from './rich-editor/EditorFormDialogs.vue'
import FindReplacePanel from './rich-editor/FindReplacePanel.vue'
import { richEditorKey } from './rich-editor/context.js'
import { createEditorMenus } from './rich-editor/menus.js'
import { menuKeys, toolbarKeys, keepSelection } from './rich-editor/keyboard.js'
import { useContentCss } from './rich-editor/content-css.js'
import { useEditingModes } from './rich-editor/modes.js'
import { blocks, fonts, fontSizes, frameDocument } from './rich-editor/options.js'
import { StudioEditor } from '../editor/engine'
import { escapeHtml, renderDocument } from '../lib/content'
import { useEditorMedia } from '../stores/editor-media'
import { assetUrl } from '../lib/media-service'
import { includesOption } from '../lib/editor-options'
import { featureEnabled, dialogFeatures } from '../lib/feature-policy.js'
import { readScience } from '../lib/science.js'
import { readDiagram } from '../lib/diagram.js'
import { portableSelection, presenceColor, validPortableSelection } from '../editor/presence.js'
import { inlineContentHtml } from '../lib/inline-css.js'
import { readUiElement } from '../lib/ui-elements.js'
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
const ContentStylesDialog = defineAsyncComponent(() => import('./ContentStylesDialog.vue'))
const AssistanceDialog = defineAsyncComponent(() => import('./AssistanceDialog.vue'))
const PageEmbedDialog = defineAsyncComponent(() => import('./PageEmbedDialog.vue'))
const UiElementDialog = defineAsyncComponent(() => import('./UiElementDialog.vue'))
const CmsHistoryDialog = defineAsyncComponent(() => import('./CmsHistoryDialog.vue'))
const DiagramDialog = defineAsyncComponent(() => import('./DiagramDialog.vue'))

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
  contentCss: { type: [String, Array], default: () => [] },
  allowContentCss: { type: Boolean, default: true },
  assistanceAdapter: Object,
  bodyClass: { type: String, default: '' },
  features: { type: Object, default: () => ({}) },
  documentSession: Object,
  /** Only marked regions are editable; set by the host, so users cannot leave the mode. */
  restricted: Boolean,
  /** Record edits as suggestions; set by the host, so users cannot turn it off. */
  trackChanges: Boolean,
  /** Author of tracked changes. */
  user: Object,
})
const { t, locale: activeLocale } = provideEditorLocale(props)
const locked = computed(() => props.readonly || props.disabled)
let editEpoch = 0
const allowed = (feature) => featureEnabled(props.features, feature)
const tools = (group) =>
  !locked.value &&
  groupAllowed(group) &&
  includesOption(props.toolbar, group) &&
  allowed(
    { typography: 'formatting', format: 'formatting', color: 'formatting', align: 'formatting' }[
      group
    ] || group,
  )
const firstRow = computed(() => ['history', 'typography', 'format', 'color', 'insert'].some(tools))
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
  'update:contentCss',
  'content-css-status',
  'update:bodyClass',
  'crash',
  'selection-change',
])
const frame = ref(null)
const { cssUrls, cssStatus, contentBodyClass, setContentCss, applyContentCss, applyBodyClass } =
  useContentCss({ props, emit, frame, onBodyClass: () => updateFrameOptions() })
watch(
  () => props.assistanceAdapter,
  () => {
    if (['ai', 'language'].includes(dialog.value)) dialog.value = null
  },
)
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
const findPanel = ref(null)
const outlineOpen = ref(false)
const contextMenu = ref(null)
const tableControls = ref(null)
const cellFormatSession = shallowRef(null)
const conditionalTarget = shallowRef(null)
const imageTarget = shallowRef(null)
const embedTarget = shallowRef(null)
const scienceTarget = shallowRef(null)
const diagramTarget = shallowRef(null)
function openDiagram(target = null) {
  if (!allowed('diagrams') || locked.value || structureLocked.value) return
  if (!engine.value?.editable || engine.value.destroyed) return
  rememberSelection()
  diagramTarget.value = target
  popup.value = null
  dialog.value = 'diagram'
}
const pageTarget = shallowRef(null)
const uiTarget = shallowRef(null)
const uiKind = ref('form')
const uiRevision = ref(0)
function openScience(target = null) {
  if (!allowed('science')) return
  if (locked.value || !engine.value?.editable || engine.value.destroyed) return
  rememberSelection()
  scienceTarget.value = target
  popup.value = null
  dialog.value = 'science'
}
function openEmbed(target = null) {
  if (!allowed('media')) return
  if (locked.value) return
  rememberSelection()
  embedTarget.value = target
  dialog.value = 'embed'
}
const menubarElement = ref(null)
const popup = ref(null)
const popupAnchor = shallowRef(null)
const reviewTab = ref(null)
const format = ref(null)
const toolNotice = ref('')
const state = ref({ block: 'p', align: 'left' })
const commentCount = computed(() => {
  state.value
  return engine.value?.threads().filter((thread) => !thread.resolved).length || 0
})
const fullscreen = ref(false)
const toolbarExpanded = ref(false)
const visualBlocks = ref(false),
  invisibleCharacters = ref(false),
  quickToolbar = ref(true),
  editorZoom = ref(100)
const fontSizeInput = ref(16)
// Page view and print/DOCX export share one page setup.
const pageView = ref(false)
const pageSettings = ref({ size: 'A4', landscape: false, margin: 20, header: '', footer: '' })
const pageInfo = ref(null)
// Collaborators shown by RemoteCursors; supplied by the host's presence transport.
const remoteUsers = ref([])
let lastSelection = 'null'
function setRemoteSelections(users) {
  remoteUsers.value = (Array.isArray(users) ? users : [])
    .filter((user) => user && (typeof user.id === 'string' || typeof user.id === 'number'))
    .slice(0, 20)
    .map((user) => ({
      id: String(user.id).slice(0, 100),
      name: String(user.name || user.id).slice(0, 60),
      color: typeof user.color === 'string' ? user.color.slice(0, 40) : presenceColor(user.id),
      selection: validPortableSelection(user.selection) ? user.selection : null,
    }))
}
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
  }).replace(
    '</head>',
    cssUrls.value
      .map(
        (url) => `<link rel="stylesheet" href="${escapeHtml(url)}" referrerpolicy="no-referrer">`,
      )
      .join('') + '</head>',
  )
  previewHtml.value = previewHtml.value.replace('<body', `<body class="${contentBodyClass.value}"`)
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
watch(
  () => props.allowContentCss,
  (allowed) => {
    if (!allowed && dialog.value === 'content-styles') dialog.value = null
  },
)
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
  openDialog('listProperties')
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
  popupAnchor.value =
    menubarElement.value?.querySelector('.native-command-search') || popupAnchor.value
  popup.value = null
  commandQuery.value = ''
  dialog.value = 'commands'
}
const error = ref('')
const busy = ref(false)
const tableForm = ref({ rows: 3, columns: 3, header: true })
const searchOpen = ref(false)
const foreground = computed(() => state.value.color || '#253343')
const background = computed(() => state.value.backgroundColor || 'transparent')
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
      ? fontSizes.map((size) => ({
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
const {
  restrictedMode,
  trackMode,
  structureLocked,
  toggleRestricted,
  toggleTrackChanges,
  dialogAllowed,
  groupAllowed,
  applyModes,
  focusEditableRegion,
  resolveAllChanges,
} = useEditingModes({ props, t, locked, engine, popup, dialog, reviewTab, contextMenu })
const { menus, foundCommands } = createEditorMenus({
  props,
  state,
  emit,
  t,
  activeLocale,
  locked,
  allowed,
  popup,
  dialog,
  pasteMode,
  setPasteMode,
  tablePasteStyle,
  setTablePasteStyle,
  searchOpen,
  visualBlocks,
  invisibleCharacters,
  quickToolbar,
  editorZoom,
  outlineOpen,
  fullscreen,
  pageView,
  conditionalTarget,
  permanentPen,
  writingPreferences,
  format,
  commandQuery,
  command,
  insert,
  insertDate,
  selectAll,
  openDialog,
  openPreview,
  openReview,
  openMedia,
  openEmbed,
  openPageEmbed,
  openUiElement,
  openScience,
  openDiagram,
  openMetrics,
  openCommandSearch,
  openCellFormat,
  openListProperties,
  applyListStyle,
  restrictedMode,
  toggleRestricted,
  focusEditableRegion,
  trackMode,
  toggleTrackChanges,
  resolveAllChanges,
  insertContents,
  copyFormat,
  pasteFormat,
})
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
  popupAnchor.value = menubarElement.value.querySelectorAll('button')[next]
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
const onMenuKeys = (event) =>
  menuKeys(event, {
    popup: popup.value,
    menuOpen: !!menus.value[popup.value],
    switchMenu,
    locale: activeLocale.value,
  })
function insertPickedTable(value) {
  popup.value = null
  dialog.value = null
  tableForm.value = value
  command('insertTable', value.rows, value.columns, value.header)
}
function slashAction(id) {
  if (id === 'table') command('insertTable', 3, 3)
  else if (id === 'media') openMedia()
  else if (id === 'embed') openEmbed()
  else if (id === 'science') openScience()
  else if (id === 'diagram') openDiagram()
  else if (id === 'templates') openDialog('templates')
  else if (id.startsWith('plugin:')) emit('slash-command', id.slice(7))
}
function customTable(value) {
  popup.value = null
  tableForm.value = value
  openDialog('table')
}

function initialize() {
  // A nested iframe finishing navigation must not recreate the editor/history.
  if (engine.value?.root === frame.value.contentDocument.body && !engine.value.destroyed) return
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
      findPanel.value?.refresh()
    },
    onState: (value) => {
      state.value = value
      const selection = engine.value ? portableSelection(engine.value.root) : null
      const serialized = JSON.stringify(selection)
      if (serialized !== lastSelection) {
        lastSelection = serialized
        emit('selection-change', selection)
      }
    },
    onSave: () => emit('save'),
    onFind: () => {
      searchOpen.value = true
      setTimeout(() => findPanel.value?.focus(), 0)
    },
    onFiles: uploadFiles,
    onTransaction: (transaction) => emit('transaction', transaction),
    onError: (failure) => emit('crash', failure),
  })
  applyModes(engine.value)
  engine.value.listen(engine.value.doc, 'keydown', (event) => {
    if (event.key === 'Escape') {
      stopPen()
      fullscreen.value = false
      searchOpen.value = false
    }
  })
  engine.value.writingPreferences = writingPreferences.value
  engine.value.features = props.features
  engine.value.listen(engine.value.root, 'pointerdown', (event) => {
    const ui = event.target.closest?.('figure[data-studio-ui]')
    if (ui && !locked.value && allowed('uiElements')) {
      event.preventDefault()
      openUiElement(readUiElement(ui)?.kind, ui)
      return
    }
    const page = event.target.closest?.('figure[data-studio-page]')
    if (!locked.value && allowed('pageEmbed') && page && event.target.closest?.('figcaption')) {
      event.preventDefault()
      openPageEmbed(page)
    }
  })
  engine.value.permanentPen = permanentPen.value
  engine.value.listen(engine.value.root, 'keydown', (event) => {
    const ui = event.target.closest?.('figure[data-studio-ui]')
    if (ui && ['Enter', ' '].includes(event.key) && !locked.value && allowed('uiElements')) {
      event.preventDefault()
      openUiElement(readUiElement(ui)?.kind, ui)
    }
  })
  engine.value.listen(engine.value.root, 'click', (event) => {
    if (locked.value) return
    const page = event.target.closest?.('figure[data-studio-page]')
    if (page && event.target.closest?.('figcaption')) {
      event.preventDefault()
      openPageEmbed(page)
      return
    }
    if (event.target.closest?.('[data-studio-thread]')) reviewTab.value = 'comments'
  })
  engine.value.listen(engine.value.root, 'dblclick', (event) => {
    if (locked.value) return
    const conditional = event.target.closest?.('[data-studio-condition]')
    const page = event.target.closest?.('figure[data-studio-page]')
    if (page) return openPageEmbed(page)
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
  setContentCss(props.contentCss)
  emit('ready')
}
function updateFrameOptions() {
  const root = engine.value?.root
  if (!root) return
  root.className = contentBodyClass.value
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
watch(
  () => props.documentSession,
  () => {
    if (dialog.value === 'cmsHistory') dialog.value = null
  },
)
watch(
  () => props.features,
  () => {
    editEpoch++
    if (engine.value) engine.value.features = props.features
    dialog.value = null
    popup.value = null
    reviewTab.value = null
    contextMenu.value?.close()
  },
  { deep: true, flush: 'sync' },
)
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
  if (locked.value || !allowed('media')) return
  rememberSelection()
  emit('media')
}
function openDialog(name) {
  if (locked.value || !allowed(dialogFeatures[name])) return
  if (!dialogAllowed(name)) return
  contextMenu.value?.close()
  popup.value = null
  rememberSelection()
  error.value = ''
  dialog.value = name
}
function openPageEmbed(target = null) {
  if (locked.value || !allowed('pageEmbed')) return
  pageTarget.value = target
  openDialog('pageEmbed')
}
function openUiElement(kind = 'form', target = null) {
  if (locked.value || !allowed('uiElements') || !['form', 'slider', 'accordion'].includes(kind))
    return
  uiTarget.value = target
  uiRevision.value = engine.value.revision
  uiKind.value = kind
  openDialog('uiElement')
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
  if (readDiagram(target)) return openDiagram(target)
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
async function uploadFiles(files, position, prepared = null) {
  if (busy.value || locked.value || !allowed('media')) return
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
provide(richEditorKey, {
  engine,
  state,
  dialog,
  popup,
  popupAnchor,
  menus,
  foundCommands,
  commandQuery,
  tools,
  allowed,
  firstRow,
  secondRow,
  toolbarExpanded,
  outlineOpen,
  searchOpen,
  fullscreen,
  reviewTab,
  commentCount,
  format,
  foreground,
  background,
  fontLabel,
  blockLabel,
  typeOptions,
  fontSizeInput,
  listTag,
  tableForm,
  metrics,
  previewHtml,
  anchorOptions,
  command,
  insert,
  openDialog,
  openPreview,
  openMedia,
  openEmbed,
  openScience,
  openDiagram,
  openReview,
  openListProperties,
  togglePopup,
  runMenu,
  runFoundCommand,
  switchMenu,
  onMenuKeys,
  applyTypography,
  applyFontSize,
  applyListStyle,
  removeCurrentList,
  insertPickedTable,
  customTable,
  applyColor,
  applyNamedStyle,
  pasteFormat,
})
defineExpose({
  openUiElement: (kind = 'form') => openUiElement(kind),
  getInlineHTML: () => inlineContentHtml(engine.value?.root),
  openVersionHistory: () => {
    if (props.documentSession) openDialog('cmsHistory')
  },
  openPageEmbed: () => openPageEmbed(),
  openAssistant: (kind = 'ai') => openDialog(kind === 'language' ? 'language' : 'ai'),
  openContentStyles: () => {
    if (props.allowContentCss && !props.disabled) dialog.value = 'content-styles'
  },
  openScience: () => openScience(),
  openDiagram: () => openDiagram(),
  getSelectionAnchor: () => (engine.value ? portableSelection(engine.value.root) : null),
  setRemoteSelections,
  isRestricted: () => restrictedMode.value,
  isTrackingChanges: () => trackMode.value,
  getTrackedChanges: () => engine.value?.trackedChanges() || [],
  acceptChange: (id) => !locked.value && !!engine.value?.acceptChange(String(id)),
  rejectChange: (id) => !locked.value && !!engine.value?.rejectChange(String(id)),
  acceptAllChanges: () => !locked.value && !!engine.value?.resolveAllChanges(true),
  rejectAllChanges: () => !locked.value && !!engine.value?.resolveAllChanges(false),
  markEditableRegion: (name = 'true') =>
    !locked.value && !!engine.value?.markEditable(String(name || 'true')),
  removeEditableRegion: () => !locked.value && !!engine.value?.unmarkEditable(),
  getEditableRegions: () => engine.value?.editableRegionValues() || [],
  focusEditableRegion: (backward = false) => !!engine.value?.focusEditableRegion(backward),
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
      ref="menubarElement"
      class="native-menubar"
      :aria-label="t('Editör menüleri')"
      @keydown="menubarKeys"
    >
      <button
        v-for="(_, name) in menus"
        :key="name"
        :aria-expanded="popup === name"
        aria-haspopup="menu"
        @pointerdown="keepSelection"
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
        @pointerdown="keepSelection"
        @click="openCommandSearch"
      >
        <Search :size="16" /><span>{{ t('Komut bul') }}</span>
      </button>
    </div>
    <EditorPopups />
    <EditorToolbar />
    <div v-if="toolNotice" class="native-message" role="status">
      {{ t(toolNotice)
      }}<button class="icon-button" :aria-label="t('Bilgiyi kapat')" @click="toolNotice = ''">
        <X :size="14" />
      </button>
    </div>
    <div v-if="!locked && state.link && !state.image" class="native-context">
      <span><Link :size="14" /> {{ state.link.href?.slice(0, 70) }}</span
      ><button @pointerdown="keepSelection" @click="openDialog('link')">
        {{ t('Bağlantıyı düzenle') }}</button
      ><button @pointerdown="keepSelection" @click="command('unlink')">
        <Unlink :size="13" /> {{ t('Bağlantıyı kaldır') }}
      </button>
    </div>
    <FindReplacePanel
      v-if="searchOpen && engine"
      ref="findPanel"
      :engine="engine"
      :locked="locked || restrictedMode"
      @close="searchOpen = false"
    />
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
        v-if="engine && !locked && !structureLocked"
        ref="mentionMenu"
        :engine="engine"
        :frame="frame"
        :query="dialog || popup ? null : (state.mentionQuery ?? null)"
        :mentions="mentions"
        :allow-create="allowCreateMention"
      />
      <WritingMenu
        v-if="engine && !locked && !structureLocked"
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
          v-if="engine && !locked && !structureLocked"
          :engine="engine"
          :state="state"
          :frame="frame"
          :suspended="!!dialog || !!popup || !!state.table || !!state.image || !!state.mediaEmbed"
        />
        <ImageControls
          v-if="!locked && !structureLocked && allowed('media')"
          :engine="engine"
          :state="state"
          :frame="frame"
          @command="command"
          @edit="openImageEditor"
          @properties="openDialog('image')"
        />
        <MediaEmbedControls
          v-if="engine && !locked && !structureLocked && allowed('media')"
          :engine="engine"
          :state="state"
          :frame="frame"
          :suspended="!!dialog || !!popup"
          @edit="openEmbed"
        />
        <TableControls
          v-if="!locked && !structureLocked && allowed('tables')"
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
        :track-enforced="trackChanges"
        @track="toggleTrackChanges"
        @close="reviewTab = null"
        @tab="reviewTab = $event"
      />
    </div>
    <EditingGuides :engine="engine" :state="state" :visible="invisibleCharacters" />
    <RemoteCursors v-if="remoteUsers.length" :engine="engine" :state="state" :users="remoteUsers" />
    <PageView
      :engine="engine"
      :state="state"
      :enabled="pageView"
      :settings="pageSettings"
      @pages="pageInfo = $event"
    />
    <SelectionToolbar
      v-if="
        engine &&
        !locked &&
        !structureLocked &&
        quickToolbar &&
        (tools('format') || tools('insert') || tools('review'))
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
    <EditorContextMenu
      v-if="!structureLocked"
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
    <DiagramDialog
      v-if="dialog === 'diagram'"
      :engine="engine"
      :target="diagramTarget"
      @close="dialog = null"
    />
    <div class="native-statusbar">
      <button
        v-if="permanentPen.enabled && !locked"
        class="pen-active"
        :aria-label="t('Kalıcı kalemi kapat')"
        @pointerdown="keepSelection"
        @click="stopPen"
      >
        <Paintbrush :size="14" />{{ t('Kalıcı kalem açık · Esc') }}
      </button>
      <span
        v-if="remoteUsers.length"
        class="presence-list"
        :aria-label="t('Belgedeki diğer kişiler')"
        role="group"
      >
        <span
          v-for="user in remoteUsers"
          :key="user.id"
          class="presence-user"
          :title="user.name"
          :style="{ '--presence-color': user.color }"
          >{{ user.name }}</span
        >
      </span>
      <span v-if="pageView && pageInfo" class="page-count">{{
        t('Sayfa {current} / {total}', pageInfo)
      }}</span>
      <button :aria-label="t('Sözcük sayımı')" @pointerdown="keepSelection" @click="openMetrics">
        <WholeWord :size="14" />{{ t('Sözcük sayımı') }}
      </button>
      <span v-if="disabled">{{ t('Devre dışı') }}</span
      ><span v-else-if="readonly">{{ t('Salt okunur') }}</span
      ><span v-else-if="trackMode" class="track-status"
        ><GitCompareArrows :size="12" />{{
          t('Değişiklikler izleniyor · {count} öneri', { count: state.trackedChangeCount || 0 })
        }}</span
      ><span v-else-if="restrictedMode" class="restricted-status"
        ><Lock :size="12" />{{ t('Kısıtlı düzenleme · Tab ile sonraki alan') }}</span
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
    <ContentStylesDialog
      v-if="dialog === 'content-styles' && allowContentCss"
      :urls="cssUrls"
      :status="cssStatus"
      :body-class="contentBodyClass"
      @body-class="applyBodyClass"
      @apply="applyContentCss"
      @close="dialog = null"
    />
    <AssistanceDialog
      v-if="['ai', 'language'].includes(dialog)"
      :engine="engine"
      :adapter="assistanceAdapter"
      :kind="dialog === 'ai' ? 'ai' : 'language'"
      @close="dialog = null"
    />
    <UiElementDialog
      v-if="dialog === 'uiElement'"
      :engine="engine"
      :kind="uiKind"
      :revision="uiRevision"
      :target="uiTarget"
      @close="dialog = null"
    />
    <PageEmbedDialog
      v-if="dialog === 'pageEmbed'"
      :engine="engine"
      :target="pageTarget"
      @close="dialog = null"
    />
    <CmsHistoryDialog
      v-if="dialog === 'cmsHistory' && documentSession"
      :engine="engine"
      :session="documentSession"
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
      v-model:settings="pageSettings"
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
    <EditorFormDialogs />
  </section>
</template>
