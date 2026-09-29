<script setup>
import { computed, ref, nextTick, watch, onBeforeUnmount } from 'vue'
import {
  Plus,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  LayoutTemplate,
  MousePointer2,
  Smartphone,
  Monitor,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Undo2,
  Image,
  ListChecks,
  Type,
  Mail,
  Phone,
  Link,
  Hash,
  Calendar,
  AlignLeft,
  ChevronDown,
  CircleDot,
  SquareCheck,
  SlidersHorizontal,
} from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import {
  newUiElement,
  readUiElement,
  normalizeUiElement,
  uiElementHtml,
  uiFieldTypes,
  uiUrl,
} from '../lib/ui-elements.js'
import { inheritBlockId } from '../editor/identity.js'
import { caretAfter } from '../editor/selection.js'
const props = defineProps({ engine: Object, kind: String, target: Object, revision: Number })
const emit = defineEmits(['close'])
const { locale } = useEditorLocale()
const c = (en, tr) => (locale.value === 'tr' ? tr : en)
const draft = ref(
  structuredClone(readUiElement(props.target) || newUiElement(props.kind, locale.value)),
)
const selected = ref(0),
  error = ref(''),
  mobile = ref(false),
  tab = ref('design'),
  preview = ref(''),
  notice = ref('')
const panel = ref('edit'),
  palette = ref(false),
  search = ref(''),
  deleted = ref(null)
const discard = ref(false),
  submitted = ref(false),
  list = ref(null),
  workspace = ref(null)
const initial = JSON.stringify(draft.value)
const dirty = computed(() => JSON.stringify(draft.value) !== initial)
const keyMap = new WeakMap()
let nextKey = 0
function itemKey(entry) {
  if (!keyMap.has(entry)) keyMap.set(entry, ++nextKey)
  return keyMap.get(entry)
}
const revision = props.revision
const items = computed(() => (draft.value.kind === 'form' ? draft.value.fields : draft.value.items))
const item = computed(() => items.value[selected.value])
const options = computed({
  get: () => (item.value?.options || []).join('\n'),
  set: (value) => {
    item.value.options = value.split('\n')
  },
})
const fieldNames = {
  text: ['Short text', 'Kısa metin'],
  email: ['Email', 'E-posta'],
  tel: ['Phone', 'Telefon'],
  url: ['Website', 'Web sitesi'],
  number: ['Number', 'Sayı'],
  date: ['Date', 'Tarih'],
  textarea: ['Long text', 'Uzun metin'],
  select: ['Dropdown', 'Açılır liste'],
  radio: ['Single choice', 'Tek seçim'],
  checkbox: ['Checkbox / consent', 'Onay kutusu'],
  range: ['Range slider', 'Değer kaydırıcısı'],
}
const labels = {
  form: ['Form builder', 'Form oluşturucu'],
  slider: ['Slider builder', 'Slider oluşturucu'],
  accordion: ['Accordion builder', 'Akordeon oluşturucu'],
}
const icons = {
  text: Type,
  email: Mail,
  tel: Phone,
  url: Link,
  number: Hash,
  date: Calendar,
  textarea: AlignLeft,
  select: ChevronDown,
  radio: CircleDot,
  checkbox: SquareCheck,
  range: SlidersHorizontal,
}
const filteredTypes = computed(() =>
  uiFieldTypes.filter((type) =>
    `${type} ${fieldNames[type].join(' ')}`
      .toLocaleLowerCase(locale.value)
      .includes(search.value.toLocaleLowerCase(locale.value)),
  ),
)
const noun = computed(() =>
  draft.value.kind === 'form'
    ? c('Fields', 'Alanlar')
    : draft.value.kind === 'slider'
      ? c('Slides', 'Slaytlar')
      : c('Sections', 'Bölümler'),
)
const addLabel = computed(() =>
  draft.value.kind === 'form'
    ? c('Add a field', 'Alan ekle')
    : draft.value.kind === 'slider'
      ? c('Add slide', 'Slayt ekle')
      : c('Add section', 'Bölüm ekle'),
)
function translatedError(message) {
  return c(
    message,
    {
      'Use an HTTPS or root-relative form action.':
        'HTTPS veya / ile başlayan bir gönderim adresi kullanın.',
      'Field names must be unique: letters, numbers and underscores; start with a letter.':
        'Alan adları benzersiz olmalı; harfle başlamalı, harf, sayı ve alt çizgi içermelidir.',
      'Every field needs a label.': 'Her alana bir etiket ekleyin.',
      'Every item needs a title.': 'Her öğeye bir başlık ekleyin.',
      'Add 1–30 distinct, nonempty options (up to 120 characters).':
        '1–30 farklı, boş olmayan seçenek ekleyin (en fazla 120 karakter).',
      'Use valid minimum, maximum and a positive step.':
        'Geçerli alt/üst sınırlar ve pozitif bir adım girin.',
      'Use HTTPS or root-relative image/link URLs.':
        'Görsel/bağlantı için HTTPS veya / ile başlayan adres kullanın.',
      'Add alternative text for each image.': 'Her görsel için alternatif metin ekleyin.',
    }[message] || message,
  )
}
// Use the same schema as publishing, but validate items independently to locate the problem.
const problems = computed(() => {
  const result = [],
    names = new Set()
  const value = JSON.parse(JSON.stringify(draft.value))
  if (value.kind === 'form' && uiUrl(value.action) === null)
    result.push({
      index: -1,
      control: 'action',
      message: translatedError('Use an HTTPS or root-relative form action.'),
    })
  items.value.forEach((entry, index) => {
    try {
      if (value.kind === 'form' && names.has(entry.name))
        throw new Error(
          'Field names must be unique: letters, numbers and underscores; start with a letter.',
        )
      names.add(entry.name)
      normalizeUiElement({
        ...value,
        action: '',
        [value.kind === 'form' ? 'fields' : 'items']: [entry],
      })
    } catch (failure) {
      const message = failure.message
      const control = /names/.test(message)
        ? 'name'
        : /label/.test(message)
          ? 'label'
          : /title/.test(message)
            ? 'title'
            : /options/.test(message)
              ? 'options'
              : /minimum/.test(message)
                ? 'min'
                : /alternative/.test(message)
                  ? 'alt'
                  : /URLs/.test(message)
                    ? uiUrl(entry.image) === null
                      ? 'image'
                      : 'link'
                    : 'type'
      result.push({ index, control, message: translatedError(message) })
    }
  })
  return result
})
const selectedProblem = computed(() =>
  submitted.value ? problems.value.find((problem) => problem.index === selected.value) : null,
)
function invalid(control) {
  return selectedProblem.value?.control === control || undefined
}
async function selectItem(index, focus = false) {
  selected.value = index
  panel.value = 'edit'
  palette.value = false
  await nextTick()
  list.value?.querySelector(`[data-ui-row="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  if (focus) workspace.value?.querySelector('.ui-properties input')?.focus()
}
async function openPalette() {
  palette.value = !palette.value
  search.value = ''
  await nextTick()
  if (palette.value) workspace.value?.querySelector('.ui-palette-search input')?.focus()
}
function closePalette(restoreFocus = true) {
  palette.value = false
  if (restoreFocus) nextTick(() => workspace.value?.querySelector('.ui-add-button')?.focus())
}
function dismissPalette(event) {
  if (palette.value && !event.target.closest('.ui-palette, .ui-add-button')) closePalette(false)
}
function requestClose() {
  if (!dirty.value) return emit('close')
  discard.value = true
  nextTick(() => workspace.value?.parentElement?.querySelector('[data-keep-editing]')?.focus())
}
function showSettings() {
  tab.value = 'settings'
  palette.value = false
}
const limit = computed(() => (draft.value.kind === 'form' ? 40 : 20))
function add(type = 'text') {
  if (items.value.length >= limit.value) return
  if (draft.value.kind === 'form') {
    let number = items.value.length + 1
    while (items.value.some((field) => field.name === `field_${number}`)) number++
    items.value.push({
      type,
      name: `field_${number}`,
      label: c(...fieldNames[type]),
      help: '',
      placeholder: '',
      required: false,
      fullWidth: type === 'textarea',
      options: [c('Option 1', 'Seçenek 1'), c('Option 2', 'Seçenek 2')],
      min: 0,
      max: 100,
      step: 1,
    })
  } else
    items.value.push({
      title: `${c('Item', 'Öğe')} ${items.value.length + 1}`,
      text: '',
      image: '',
      alt: '',
      link: '',
      linkLabel: c('Read more', 'Devamını oku'),
      open: false,
    })
  tab.value = 'design'
  selectItem(items.value.length - 1, true)
}
function duplicate() {
  if (items.value.length >= limit.value) return
  const clone = structuredClone(JSON.parse(JSON.stringify(item.value)))
  if (draft.value.kind === 'form') {
    let n = 1
    const base = clone.name.slice(0, 50)
    while (items.value.some((field) => field.name === `${base}_copy${n}`)) n++
    clone.name = `${base}_copy${n}`
  }
  items.value.splice(selected.value + 1, 0, clone)
  selectItem(selected.value + 1, true)
}
function remove() {
  if (items.value.length <= 1) return
  deleted.value = { entry: items.value[selected.value], index: selected.value }
  items.value.splice(selected.value, 1)
  selected.value = Math.min(selected.value, items.value.length - 1)
  notice.value = c('Item deleted', 'Öğe silindi')
}
function undoDelete() {
  if (!deleted.value || items.value.length >= limit.value) return
  const index = Math.min(deleted.value.index, items.value.length)
  const entry = deleted.value.entry
  if (draft.value.kind === 'form' && items.value.some((field) => field.name === entry.name)) {
    const base = entry.name.slice(0, 50)
    let n = 1
    while (items.value.some((field) => field.name === `${base}_restored${n}`)) n++
    entry.name = `${base}_restored${n}`
  }
  items.value.splice(index, 0, deleted.value.entry)
  deleted.value = null
  selectItem(index, true)
  notice.value = c('Item restored', 'Öğe geri getirildi')
}
function move(from, to) {
  if (from === to || to < 0 || to >= items.value.length) return
  const focused = document.activeElement
  const keepFocus = list.value?.contains(focused)
  const [value] = items.value.splice(from, 1)
  items.value.splice(to, 0, value)
  selected.value = to
  notice.value = c(`Moved to position ${to + 1}`, `${to + 1}. sıraya taşındı`)
  nextTick(() => {
    if (keepFocus) {
      const target =
        focused?.isConnected && !focused.disabled
          ? focused
          : list.value?.querySelector(`[data-ui-row="${to}"] .ui-drag`)
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'nearest' })
    }
  })
}
let drag = null
let dragFrame = 0
const dragIndex = ref(-1),
  dropIndex = ref(-1)
function stopDrag() {
  cancelAnimationFrame(dragFrame)
  drag = null
  dragIndex.value = -1
  dropIndex.value = -1
}
function beginDrag(event, index) {
  if (event.button !== 0) return
  event.preventDefault()
  event.currentTarget.setPointerCapture(event.pointerId)
  drag = { from: index, to: index, x: event.clientX, y: event.clientY }
  dragIndex.value = index
  selected.value = index
  dragFrame = requestAnimationFrame(autoScroll)
}
function autoScroll() {
  if (!drag || !list.value) return
  const box = list.value.getBoundingClientRect()
  if (drag.y < box.top + 38) list.value.scrollTop -= 9
  else if (drag.y > box.bottom - 38) list.value.scrollTop += 9
  updateDrop()
  dragFrame = requestAnimationFrame(autoScroll)
}
function updateDrop() {
  const row = document.elementFromPoint(drag.x, drag.y)?.closest('[data-ui-row]')
  if (!row || !list.value?.contains(row)) return
  drag.to = Number(row.dataset.uiRow)
  dropIndex.value = drag.to
}
function dragMove(event) {
  if (!drag) return
  drag.x = event.clientX
  drag.y = event.clientY
  updateDrop()
}
function drop() {
  if (drag) move(drag.from, drag.to)
  stopDrag()
}
function validated() {
  submitted.value = true
  try {
    const value = normalizeUiElement(JSON.parse(JSON.stringify(draft.value)))
    error.value = ''
    return value
  } catch (failure) {
    error.value = translatedError(failure.message)
    const problem = problems.value[0]
    if (problem) {
      tab.value = problem.index < 0 ? 'settings' : 'design'
      panel.value = 'edit'
      palette.value = false
      if (problem.index >= 0) selected.value = problem.index
      nextTick(() => workspace.value?.querySelector(`[data-control="${problem.control}"]`)?.focus())
    }
    return null
  }
}
let previewTimer = 0
const previewPending = ref(false)
function updatePreview() {
  if (problems.value.length) {
    previewPending.value = false
    return
  }
  const config = normalizeUiElement(JSON.parse(JSON.stringify(draft.value)))
  // The sandbox has no form or script permission. The endpoint is only for testable controls.
  if (config.kind === 'form' && !config.action) config.action = '/'
  preview.value = `<!doctype html><html lang="${locale.value}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;background:#fff}*{box-sizing:border-box}figure{margin:0!important;box-shadow:none!important}</style></head><body>${uiElementHtml(config, 'public').replaceAll('href="#', 'href="about:srcdoc#')}</body></html>`
  previewPending.value = false
}
watch(
  draft,
  () => {
    clearTimeout(previewTimer)
    if (submitted.value && !problems.value.length) error.value = ''
    previewPending.value = true
    previewTimer = setTimeout(updatePreview, 250)
  },
  { deep: true },
)
updatePreview()
onBeforeUnmount(() => {
  stopDrag()
  clearTimeout(previewTimer)
})
function showPreview() {
  if (!validated()) return
  clearTimeout(previewTimer)
  updatePreview()
  tab.value = 'preview'
  palette.value = false
}
function changeType() {
  if (['select', 'radio'].includes(item.value.type) && !item.value.options?.length)
    item.value.options = [c('Option 1', 'Seçenek 1'), c('Option 2', 'Seçenek 2')]
}
function addOption() {
  if ((item.value.options?.length || 0) >= 30) return
  let n = (item.value.options?.length || 0) + 1
  while (item.value.options.includes(c(`Option ${n}`, `Seçenek ${n}`))) n++
  item.value.options.push(c(`Option ${n}`, `Seçenek ${n}`))
  nextTick(() => workspace.value?.querySelector('.ui-option-row:last-of-type input')?.focus())
}
async function save(removeElement = false) {
  if (!props.engine.editable || props.engine.features?.uiElements === false) return
  if (
    props.engine.revision !== revision ||
    (props.target && !props.engine.root.contains(props.target))
  ) {
    error.value = c(
      'The document changed. Reopen the builder.',
      'Belge değişti. Oluşturucuyu yeniden açın.',
    )
    return
  }
  const config = removeElement ? null : validated()
  if (!removeElement && !config) return
  if (props.target)
    props.engine.transaction(() => {
      const template = props.engine.doc.createElement('template')
      template.innerHTML = removeElement ? '<p><br></p>' : uiElementHtml(config, 'editor')
      const node = template.content.firstElementChild
      inheritBlockId(props.target, node)
      props.target.replaceWith(node)
      caretAfter(props.engine.root, node)
    }, 'uiElement')
  else props.engine.insert(uiElementHtml(config) + '<p><br></p>')
  await nextTick()
  emit('close')
}
</script>
<template>
  <AppDialog class="ui-element-dialog" :title="c(...labels[draft.kind])" wide @close="requestClose">
    <template #eyebrow
      ><span class="ui-eyebrow">{{ c('CONTENT ELEMENTS', 'İÇERİK ÖĞELERİ') }}</span></template
    >
    <div class="ui-builder" ref="workspace" @pointerdown.capture="dismissPalette">
      <div class="ui-builder-tabs">
        <div class="ui-mode-switch" :aria-label="c('Builder view', 'Oluşturucu görünümü')">
          <button type="button" :aria-pressed="tab === 'design'" @click="tab = 'design'">
            <LayoutTemplate :size="16" />{{ c('Build', 'Oluştur') }}
          </button>
          <button type="button" :aria-pressed="tab === 'settings'" @click="showSettings">
            <SlidersHorizontal :size="16" />{{ c('Settings', 'Ayarlar') }}
          </button>
          <button type="button" :aria-pressed="tab === 'preview'" @click="showPreview">
            <MousePointer2 :size="16" />{{ c('Try preview', 'Önizlemeyi dene') }}
          </button>
        </div>
        <button
          v-if="tab === 'design'"
          class="ui-add-button"
          type="button"
          :disabled="items.length >= limit"
          :aria-expanded="draft.kind === 'form' ? palette : undefined"
          @click="draft.kind === 'form' ? openPalette() : add()"
        >
          <Plus :size="16" />{{ addLabel }}
        </button>
      </div>
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
      <div v-if="tab === 'design'" class="ui-mobile-switch">
        <button type="button" :aria-pressed="panel === 'list'" @click="panel = 'list'">
          {{ noun }} <span>{{ items.length }}</span>
        </button>
        <button type="button" :aria-pressed="panel === 'edit'" @click="panel = 'edit'">
          {{ c('Edit item', 'Öğeyi düzenle') }}
        </button>
      </div>
      <div
        class="ui-workbench"
        :class="{ 'settings-mode': tab === 'settings', 'preview-mode': tab === 'preview' }"
      >
        <aside
          v-show="tab === 'design'"
          class="ui-outline"
          :class="{ 'mobile-hidden': panel !== 'list' }"
        >
          <div class="ui-outline-heading">
            <h3>
              {{ noun }} <span>{{ items.length }} / {{ limit }}</span>
            </h3>
            <p>
              {{
                c(
                  'Select to edit · drag to reorder',
                  'Düzenlemek için seç · sıralamak için sürükle',
                )
              }}
            </p>
          </div>
          <section ref="list" class="ui-field-list" :aria-label="c('Element order', 'Öğe sırası')">
            <div
              v-for="(entry, index) in items"
              :key="itemKey(entry)"
              :data-ui-row="index"
              class="ui-field-row"
              :class="{
                selected: selected === index,
                dragging: dragIndex === index,
                'drop-target': dropIndex === index && dragIndex !== index,
                'drop-after': dragIndex < index,
                'has-error': submitted && problems.some((problem) => problem.index === index),
              }"
            >
              <button
                class="ui-drag"
                type="button"
                :aria-label="c(`Drag item ${index + 1}`, `${index + 1}. öğeyi sürükle`)"
                :title="c('Drag, or use ↑ / ↓ to reorder', 'Sürükleyin veya ↑ / ↓ ile sıralayın')"
                @pointerdown="beginDrag($event, index)"
                @pointermove="dragMove"
                @pointerup="drop"
                @pointercancel="stopDrag"
                @lostpointercapture="stopDrag"
                @keydown.up.prevent="move(index, index - 1)"
                @keydown.down.prevent="move(index, index + 1)"
              >
                <GripVertical :size="16" />
              </button>
              <button
                class="ui-field-select"
                type="button"
                :aria-pressed="selected === index"
                @click="selectItem(index)"
              >
                <span class="ui-entry-icon" :class="{ 'slide-thumbnail': draft.kind === 'slider' }"
                  ><component
                    :is="
                      entry.type ? icons[entry.type] : draft.kind === 'slider' ? Image : AlignLeft
                    "
                    :size="17" /><img
                    v-if="draft.kind === 'slider' && entry.image && uiUrl(entry.image)"
                    :src="uiUrl(entry.image)"
                    alt=""
                    loading="lazy"
                    @error="$event.target.style.opacity = '0'"
                    @load="$event.target.style.opacity = '1'"
                /></span>
                <span class="ui-entry-copy"
                  ><strong
                    >{{ entry.label || entry.title || c('Untitled', 'Başlıksız')
                    }}<b v-if="entry.required"> *</b></strong
                  ><small
                    >{{ String(index + 1).padStart(2, '0') }} ·
                    {{
                      entry.type
                        ? c(...fieldNames[entry.type])
                        : draft.kind === 'slider'
                          ? c('Slide', 'Slayt')
                          : entry.open
                            ? c('Initially open', 'Başlangıçta açık')
                            : c('Collapsed', 'Kapalı')
                    }}</small
                  ></span
                >
              </button>
              <div class="ui-row-arrows">
                <button
                  type="button"
                  :disabled="index === 0"
                  :aria-label="c(`Move item ${index + 1} up`, `${index + 1}. öğeyi yukarı taşı`)"
                  @click="move(index, index - 1)"
                >
                  <ArrowUp :size="13" /></button
                ><button
                  type="button"
                  :disabled="index === items.length - 1"
                  :aria-label="c(`Move item ${index + 1} down`, `${index + 1}. öğeyi aşağı taşı`)"
                  @click="move(index, index + 1)"
                >
                  <ArrowDown :size="13" />
                </button>
              </div>
            </div>
          </section>
          <div class="ui-outline-note">
            <GripVertical :size="14" />{{
              c(
                'Tip: arrow keys work on drag handles.',
                'İpucu: tutamaçlarda ok tuşları da çalışır.',
              )
            }}
          </div>
        </aside>
        <div v-if="palette" class="ui-palette" @keydown.esc.stop.prevent="closePalette()">
          <div class="ui-palette-title">
            <h3>{{ c('Choose a field', 'Alan türünü seç') }}</h3>
            <button
              type="button"
              :aria-label="c('Close field picker', 'Alan seçiciyi kapat')"
              @click="closePalette()"
            >
              <X :size="16" />
            </button>
          </div>
          <label class="ui-palette-search"
            ><Search :size="16" /><input
              v-model="search"
              :placeholder="c('Search fields…', 'Alan ara…')"
              :aria-label="c('Search fields', 'Alan ara')"
          /></label>
          <div class="ui-palette-grid">
            <button v-for="type in filteredTypes" :key="type" type="button" @click="add(type)">
              <component :is="icons[type]" :size="18" /><span>{{ c(...fieldNames[type]) }}</span
              ><Plus :size="13" />
            </button>
          </div>
          <p v-if="!filteredTypes.length">
            {{
              c(
                'No matching fields. Try another search.',
                'Alan bulunamadı. Başka bir arama deneyin.',
              )
            }}
          </p>
        </div>
        <section
          v-show="tab === 'design'"
          class="ui-properties native-form"
          :class="{ 'mobile-hidden': panel !== 'edit' }"
          :aria-label="c('Item properties', 'Öğe ayarları')"
        >
          <div class="ui-property-heading">
            <div>
              <small
                >{{ c('EDITING', 'DÜZENLENİYOR') }} {{ selected + 1 }} / {{ items.length }}</small
              >
              <h3>{{ item.label || item.title || c('Untitled', 'Başlıksız') }}</h3>
            </div>
            <div class="ui-item-nav">
              <button
                type="button"
                :disabled="selected === 0"
                :aria-label="c('Previous item', 'Önceki öğe')"
                @click="selectItem(selected - 1)"
              >
                <ChevronLeft :size="16" /></button
              ><button
                type="button"
                :disabled="selected === items.length - 1"
                :aria-label="c('Next item', 'Sonraki öğe')"
                @click="selectItem(selected + 1)"
              >
                <ChevronRight :size="16" />
              </button>
            </div>
          </div>
          <p v-if="selectedProblem" class="ui-inline-error">{{ selectedProblem.message }}</p>
          <div class="ui-properties-body">
            <template v-if="draft.kind === 'form'">
              <label
                >{{ c('Label', 'Etiket')
                }}<input
                  class="text-input"
                  v-model="item.label"
                  data-control="label"
                  :aria-invalid="invalid('label')"
                  maxlength="200"
              /></label>
              <label
                >{{ c('Field name', 'Alan adı')
                }}<input
                  class="text-input"
                  v-model="item.name"
                  data-control="name"
                  :aria-invalid="invalid('name')"
                  maxlength="64"
                  spellcheck="false"
              /></label>
              <label
                >{{ c('Type', 'Tür')
                }}<select
                  class="text-input"
                  v-model="item.type"
                  data-control="type"
                  @change="changeType"
                >
                  <option v-for="type in uiFieldTypes" :key="type" :value="type">
                    {{ c(...fieldNames[type]) }}
                  </option>
                </select></label
              >
              <label
                v-if="['text', 'email', 'tel', 'url', 'number', 'textarea'].includes(item.type)"
                >{{ c('Placeholder', 'Yer tutucu')
                }}<input class="text-input" v-model="item.placeholder" maxlength="200"
              /></label>
              <label
                >{{ c('Help text', 'Yardım metni')
                }}<textarea
                  class="text-input"
                  v-model="item.help"
                  rows="2"
                  maxlength="500"
                ></textarea>
              </label>
              <fieldset v-if="['select', 'radio'].includes(item.type)" class="ui-option-editor">
                <legend>
                  {{ c('Choices', 'Seçenekler') }}
                  <small>{{ item.options?.length || 0 }} / 30</small>
                </legend>
                <div v-for="(option, index) in item.options" :key="index" class="ui-option-row">
                  <CircleDot v-if="item.type === 'radio'" :size="14" /><span v-else>{{
                    index + 1
                  }}</span>
                  <input
                    class="text-input"
                    v-model="item.options[index]"
                    :data-control="index === 0 ? 'options' : undefined"
                    :aria-label="c(`Option ${index + 1}`, `${index + 1}. seçenek`)"
                    maxlength="120"
                    :aria-invalid="invalid('options')"
                  />
                  <button
                    type="button"
                    :disabled="item.options.length <= 1"
                    :aria-label="c(`Remove option ${index + 1}`, `${index + 1}. seçeneği kaldır`)"
                    @click="item.options.splice(index, 1)"
                  >
                    <X :size="15" />
                  </button>
                </div>
                <button
                  class="ui-text-action"
                  type="button"
                  :disabled="item.options?.length >= 30"
                  @click="addOption"
                >
                  <Plus :size="14" />{{ c('Add option', 'Seçenek ekle') }}
                </button>
                <details class="ui-bulk-options">
                  <summary>{{ c('Edit choices in bulk', 'Seçenekleri toplu düzenle') }}</summary>
                  <label
                    >{{ c('Options (one per line)', 'Seçenekler (her satıra bir tane)')
                    }}<textarea class="text-input" v-model="options" rows="4"></textarea>
                  </label>
                </details>
              </fieldset>
              <div v-if="['number', 'range'].includes(item.type)" class="ui-number-grid">
                <label
                  >{{ c('Minimum', 'Alt sınır')
                  }}<input
                    class="text-input"
                    type="number"
                    v-model="item.min"
                    data-control="min"
                    :aria-invalid="invalid('min')" /></label
                ><label
                  >{{ c('Maximum', 'Üst sınır')
                  }}<input class="text-input" type="number" v-model="item.max" /></label
                ><label
                  >{{ c('Step', 'Adım')
                  }}<input
                    class="text-input"
                    type="number"
                    v-model="item.step"
                    min="0.001"
                    step="any"
                /></label>
              </div>
              <label class="ui-check"
                ><input type="checkbox" v-model="item.required" /><span
                  >{{ c('Required', 'Zorunlu')
                  }}<small>{{
                    c('Must be completed before sending', 'Göndermeden önce doldurulmalı')
                  }}</small></span
                ></label
              >
              <label class="ui-check"
                ><input type="checkbox" v-model="item.fullWidth" /><span
                  >{{ c('Full width', 'Tam genişlik')
                  }}<small>{{
                    c(
                      'Span both columns in a two-column form',
                      'İki sütunlu formda tüm satırı kaplar',
                    )
                  }}</small></span
                ></label
              >
            </template>
            <template v-else>
              <label
                >{{ c('Item title', 'Öğe başlığı')
                }}<input
                  class="text-input"
                  v-model="item.title"
                  data-control="title"
                  :aria-invalid="invalid('title')"
                  maxlength="200"
              /></label>
              <label
                >{{ c('Text', 'Metin')
                }}<textarea
                  class="text-input"
                  v-model="item.text"
                  rows="5"
                  maxlength="4000"
                ></textarea>
              </label>
              <template v-if="draft.kind === 'slider'">
                <label
                  >{{ c('Image URL', 'Görsel adresi')
                  }}<input
                    class="text-input"
                    v-model="item.image"
                    data-control="image"
                    :aria-invalid="invalid('image')"
                    placeholder="https://…"
                    maxlength="2048"
                /></label>
                <label
                  >{{ c('Alternative text', 'Alternatif metin')
                  }}<input
                    class="text-input"
                    v-model="item.alt"
                    data-control="alt"
                    :aria-invalid="invalid('alt')"
                    maxlength="200"
                /></label>
                <label
                  >{{ c('Link URL', 'Bağlantı adresi')
                  }}<input
                    class="text-input"
                    v-model="item.link"
                    data-control="link"
                    :aria-invalid="invalid('link')"
                    placeholder="/products"
                    maxlength="2048"
                /></label>
                <label
                  >{{ c('Link label', 'Bağlantı metni')
                  }}<input class="text-input" v-model="item.linkLabel" maxlength="200"
                /></label>
              </template>
              <label v-else class="ui-check"
                ><input type="checkbox" v-model="item.open" />{{
                  c('Initially open', 'Başlangıçta açık')
                }}</label
              >
            </template>
          </div>
          <div class="ui-item-actions">
            <button
              type="button"
              class="button"
              :disabled="items.length >= limit"
              @click="duplicate"
            >
              <Copy :size="14" />{{ c('Duplicate', 'Çoğalt') }}</button
            ><button type="button" class="button" :disabled="items.length === 1" @click="remove">
              <Trash2 :size="14" />{{ c('Delete item', 'Öğeyi sil') }}
            </button>
          </div>
        </section>
        <div v-show="tab === 'settings'" class="ui-settings native-form">
          <h3>{{ c('Appearance & behavior', 'Görünüm ve davranış') }}</h3>
          <p class="ui-section-help">
            {{ c('Settings apply to the whole element.', 'Ayarlar öğenin tamamına uygulanır.') }}
          </p>
          <label
            >{{ c('Title', 'Başlık')
            }}<input class="text-input" v-model="draft.title" maxlength="200"
          /></label>
          <label
            >{{ c('Description', 'Açıklama')
            }}<textarea
              class="text-input"
              v-model="draft.description"
              rows="2"
              maxlength="1000"
            ></textarea>
          </label>
          <label
            >{{ c('Accent color', 'Vurgu rengi') }}<input type="color" v-model="draft.accent"
          /></label>
          <template v-if="draft.kind === 'form'">
            <label
              >{{ c('Submit button text', 'Gönder düğmesi metni')
              }}<input class="text-input" v-model="draft.submitLabel" maxlength="200"
            /></label>
            <label
              >{{ c('Submission URL (POST)', 'Gönderim adresi (POST)')
              }}<input
                class="text-input"
                v-model="draft.action"
                data-control="action"
                :aria-invalid="
                  (submitted && problems.some((problem) => problem.index === -1)) || undefined
                "
                maxlength="2048"
                placeholder="/api/contact"
            /></label>
            <p class="muted">
              {{
                c(
                  'Connect your own form endpoint. Without a URL, the published form is disabled. The editor does not store responses or send emails.',
                  'Kendi form uç noktanızı bağlayın. Adres yoksa yayınlanan form devre dışıdır. Editör yanıtları kaydetmez ve e-posta göndermez.',
                )
              }}
            </p>
            <label
              >{{ c('Columns', 'Sütunlar')
              }}<select class="text-input" v-model="draft.columns">
                <option :value="1">1</option>
                <option :value="2">2 · {{ c('Stacks on mobile', 'Mobilde alt alta') }}</option>
              </select></label
            >
          </template>
          <template v-if="draft.kind === 'slider'">
            <label
              >{{ c('Visible cards on desktop', 'Masaüstünde görünen kartlar')
              }}<select class="text-input" v-model="draft.cards">
                <option v-for="n in 3" :key="n" :value="n">{{ n }}</option>
              </select></label
            >
            <label
              >{{ c('Image aspect ratio', 'Görsel oranı')
              }}<select class="text-input" v-model="draft.ratio">
                <option>16/9</option>
                <option>4/3</option>
                <option>1/1</option>
              </select></label
            >
            <p class="muted">
              {{
                c(
                  'Swipe, scroll horizontally, or use the numbered links. No autoplay or JavaScript is required.',
                  'Dokunarak, yatay kaydırarak veya numaralı bağlantılarla gezinilir. Otomatik oynatma veya JavaScript gerekmez.',
                )
              }}
            </p>
          </template>
        </div>
        <section
          class="ui-preview-area"
          :class="{ 'mobile-hidden': tab !== 'preview' }"
          :aria-label="c('Live preview', 'Canlı önizleme')"
        >
          <div class="ui-preview-toolbar">
            <div>
              <h3>{{ c('Live preview', 'Canlı önizleme') }}</h3>
              <span class="ui-preview-status"
                ><i :class="{ paused: problems.length }"></i
                >{{
                  problems.length
                    ? c('Waiting for valid changes', 'Geçerli değişiklikler bekleniyor')
                    : previewPending
                      ? c('Updating…', 'Güncelleniyor…')
                      : c('Up to date', 'Güncel')
                }}</span
              >
            </div>
            <div class="ui-device-switch">
              <button
                type="button"
                :aria-pressed="!mobile"
                :aria-label="c('Desktop', 'Masaüstü')"
                :title="c('Desktop', 'Masaüstü')"
                @click="mobile = false"
              >
                <Monitor :size="17" /></button
              ><button
                type="button"
                :aria-pressed="mobile"
                :aria-label="c('Mobile', 'Telefon')"
                :title="c('Mobile', 'Telefon')"
                @click="mobile = true"
              >
                <Smartphone :size="17" />
              </button>
            </div>
          </div>
          <p v-if="problems.length" class="ui-preview-paused">
            {{
              c(
                'Showing the last valid preview. Complete the pending settings to update it.',
                'Son geçerli önizleme gösteriliyor. Güncellemek için eksik ayarları tamamlayın.',
              )
            }}
          </p>
          <div class="ui-preview-canvas" :class="{ phone: mobile }">
            <iframe
              :srcdoc="preview"
              sandbox=""
              :title="c('UI element preview', 'UI öğesi önizlemesi')"
              :style="{ width: mobile ? 'min(390px,100%)' : '100%' }"
            ></iframe>
          </div>
          <p class="ui-preview-caption">
            <MousePointer2 :size="14" />{{
              c(
                'Interactive preview · no form submissions',
                'Etkileşimli önizleme · form gönderilmez',
              )
            }}
          </p>
        </section>
      </div>
      <div v-if="deleted" class="ui-undo-bar">
        <span>{{ c('Item deleted', 'Öğe silindi') }}</span
        ><button type="button" :disabled="items.length >= limit" @click="undoDelete">
          <Undo2 :size="14" />{{ c('Undo delete', 'Silmeyi geri al') }}</button
        ><button
          type="button"
          :aria-label="c('Dismiss notification', 'Bildirimi kapat')"
          @click="deleted = null"
        >
          <X :size="14" />
        </button>
      </div>
      <p class="ui-builder-announcement" aria-live="polite">{{ notice }}</p>
    </div>
    <template #footer>
      <template v-if="discard"
        ><span class="ui-discard-message" role="alert">{{
          c('Discard your unsaved changes?', 'Kaydedilmemiş değişiklikler silinsin mi?')
        }}</span
        ><button type="button" class="button" data-keep-editing @click="discard = false">
          {{ c('Keep editing', 'Düzenlemeye devam et') }}</button
        ><button type="button" class="button ui-danger" @click="emit('close')">
          {{ c('Discard changes', 'Değişiklikleri sil') }}
        </button></template
      >
      <template v-else
        ><button v-if="target" type="button" class="button ui-remove-element" @click="save(true)">
          <Trash2 :size="14" />{{ c('Remove element', 'Öğeyi kaldır') }}</button
        ><span v-else class="ui-footer-note"
          ><Check :size="14" />{{
            c('Editable after inserting', 'Ekledikten sonra düzenlenebilir')
          }}</span
        ><button type="button" class="button" @click="requestClose">
          {{ c('Cancel', 'İptal') }}</button
        ><button type="button" class="button primary" @click="save()">
          {{
            target ? c('Apply changes', 'Değişiklikleri uygula') : c('Insert element', 'Öğeyi ekle')
          }}
        </button></template
      >
    </template>
  </AppDialog>
</template>
<style src="./ui-element-dialog.css"></style>
