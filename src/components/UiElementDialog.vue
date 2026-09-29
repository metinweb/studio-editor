<script setup>
import { computed, ref, nextTick, onBeforeUnmount } from 'vue'
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
} from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import {
  newUiElement,
  readUiElement,
  normalizeUiElement,
  uiElementHtml,
  uiFieldTypes,
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
  selected.value = items.value.length - 1
  tab.value = 'design'
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
  selected.value++
}
function remove() {
  if (items.value.length <= 1) return
  items.value.splice(selected.value, 1)
  selected.value = Math.min(selected.value, items.value.length - 1)
}
function move(from, to) {
  if (from === to || to < 0 || to >= items.value.length) return
  const [value] = items.value.splice(from, 1)
  items.value.splice(to, 0, value)
  selected.value = to
  notice.value = c(`Moved to position ${to + 1}`, `${to + 1}. sıraya taşındı`)
}
let drag = null
const dragIndex = ref(-1),
  dropIndex = ref(-1)
function stopDrag() {
  drag = null
  dragIndex.value = -1
  dropIndex.value = -1
}
onBeforeUnmount(stopDrag)
function beginDrag(event, index) {
  if (event.button !== 0) return
  event.preventDefault()
  event.currentTarget.setPointerCapture(event.pointerId)
  drag = { from: index, to: index }
  dragIndex.value = index
  selected.value = index
}
function dragMove(event) {
  if (!drag) return
  const row = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-ui-row]')
  if (!row) return
  drag.to = Number(row.dataset.uiRow)
  dropIndex.value = drag.to
}
function drop() {
  if (drag) move(drag.from, drag.to)
  stopDrag()
}
function validated() {
  try {
    const value = normalizeUiElement(JSON.parse(JSON.stringify(draft.value)))
    error.value = ''
    return value
  } catch (failure) {
    error.value = c(
      failure.message,
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
      }[failure.message] || failure.message,
    )
    return null
  }
}
function showPreview() {
  const config = validated()
  if (!config) return
  // The sandbox has no form or script permission. Native inputs are testable here.
  preview.value = `<!doctype html><html lang="${locale.value}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:12px;background:#f1f5f9}*{box-sizing:border-box}</style></head><body>${uiElementHtml(config, 'public').replaceAll('href="#', 'href="about:srcdoc#')}</body></html>`
  tab.value = 'preview'
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
  <AppDialog
    class="ui-element-dialog"
    :title="c(...labels[draft.kind])"
    wide
    @close="emit('close')"
  >
    <div class="ui-builder">
      <div class="ui-builder-tabs">
        <button type="button" :aria-pressed="tab === 'design'" @click="tab = 'design'">
          <LayoutTemplate :size="16" />{{ c('Build', 'Oluştur') }}
        </button>
        <button type="button" :aria-pressed="tab === 'settings'" @click="tab = 'settings'">
          {{ c('Settings', 'Ayarlar') }}
        </button>
        <button type="button" :aria-pressed="tab === 'preview'" @click="showPreview">
          <MousePointer2 :size="16" />{{ c('Try preview', 'Önizlemeyi dene') }}
        </button>
        <span>{{ items.length }} / {{ limit }}</span>
      </div>
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
      <div v-if="tab === 'design'" class="ui-builder-layout">
        <aside class="ui-palette">
          <h3>
            {{ draft.kind === 'form' ? c('Add a field', 'Alan ekle') : c('Items', 'Öğeler') }}
          </h3>
          <template v-if="draft.kind === 'form'"
            ><button
              v-for="type in uiFieldTypes"
              :key="type"
              type="button"
              :disabled="items.length >= limit"
              @click="add(type)"
            >
              <Plus :size="14" />{{ c(...fieldNames[type]) }}
            </button></template
          >
          <button v-else type="button" :disabled="items.length >= limit" @click="add()">
            <Plus :size="16" />{{ c('Add item', 'Öğe ekle') }}
          </button>
          <p>
            {{
              c(
                'Drag a handle to reorder. Arrow buttons also work on touch and keyboard.',
                'Sıralamak için tutamacı sürükleyin. Ok düğmeleri dokunmatik ve klavyeyle de çalışır.',
              )
            }}
          </p>
        </aside>
        <section class="ui-field-list" :aria-label="c('Element order', 'Öğe sırası')">
          <div
            v-for="(entry, index) in items"
            :key="index"
            :data-ui-row="index"
            class="ui-field-row"
            :class="{
              selected: selected === index,
              dragging: dragIndex === index,
              'drop-target': dropIndex === index,
            }"
          >
            <button
              class="ui-drag"
              type="button"
              :aria-label="c(`Drag item ${index + 1}`, `${index + 1}. öğeyi sürükle`)"
              @pointerdown="beginDrag($event, index)"
              @pointermove="dragMove"
              @pointerup="drop"
              @pointercancel="stopDrag"
              @lostpointercapture="stopDrag"
            >
              <GripVertical :size="18" />
            </button>
            <button
              class="ui-field-select"
              type="button"
              :aria-pressed="selected === index"
              @click="selected = index"
            >
              <small
                >{{ String(index + 1).padStart(2, '0') }} ·
                {{ entry.type ? c(...fieldNames[entry.type]) : c('Item', 'Öğe') }}</small
              ><strong
                >{{ entry.label || entry.title || c('Untitled', 'Başlıksız')
                }}{{ entry.required ? ' *' : '' }}</strong
              ><span v-if="draft.kind === 'form'">{{ entry.placeholder || '…' }}</span>
            </button>
            <div class="ui-row-arrows">
              <button
                type="button"
                :disabled="index === 0"
                :aria-label="c(`Move item ${index + 1} up`, `${index + 1}. öğeyi yukarı taşı`)"
                @click="move(index, index - 1)"
              >
                <ArrowUp :size="14" /></button
              ><button
                type="button"
                :disabled="index === items.length - 1"
                :aria-label="c(`Move item ${index + 1} down`, `${index + 1}. öğeyi aşağı taşı`)"
                @click="move(index, index + 1)"
              >
                <ArrowDown :size="14" />
              </button>
            </div>
          </div>
          <p class="ui-builder-announcement" aria-live="polite">{{ notice }}</p>
        </section>
        <section
          class="ui-properties native-form"
          :aria-label="c('Item properties', 'Öğe ayarları')"
        >
          <h3>{{ c('Item properties', 'Öğe ayarları') }}</h3>
          <template v-if="draft.kind === 'form'">
            <label
              >{{ c('Label', 'Etiket')
              }}<input class="text-input" v-model="item.label" maxlength="200"
            /></label>
            <label
              >{{ c('Field name', 'Alan adı')
              }}<input class="text-input" v-model="item.name" maxlength="64" spellcheck="false"
            /></label>
            <label
              >{{ c('Type', 'Tür')
              }}<select class="text-input" v-model="item.type">
                <option v-for="type in uiFieldTypes" :key="type" :value="type">
                  {{ c(...fieldNames[type]) }}
                </option>
              </select></label
            >
            <label
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
            <label v-if="['select', 'radio'].includes(item.type)"
              >{{ c('Options (one per line)', 'Seçenekler (her satıra bir tane)')
              }}<textarea class="text-input" v-model="options" rows="4"></textarea>
            </label>
            <div v-if="['number', 'range'].includes(item.type)" class="ui-number-grid">
              <label
                >{{ c('Minimum', 'Alt sınır')
                }}<input class="text-input" type="number" v-model="item.min" /></label
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
              ><input type="checkbox" v-model="item.required" />{{
                c('Required', 'Zorunlu')
              }}</label
            >
            <label class="ui-check"
              ><input type="checkbox" v-model="item.fullWidth" />{{
                c('Full width', 'Tam genişlik')
              }}</label
            >
          </template>
          <template v-else>
            <label
              >{{ c('Item title', 'Öğe başlığı')
              }}<input class="text-input" v-model="item.title" maxlength="200"
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
                  placeholder="https://…"
                  maxlength="2048"
              /></label>
              <label
                >{{ c('Alternative text', 'Alternatif metin')
                }}<input class="text-input" v-model="item.alt" maxlength="200"
              /></label>
              <label
                >{{ c('Link URL', 'Bağlantı adresi')
                }}<input
                  class="text-input"
                  v-model="item.link"
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
      </div>
      <div v-else-if="tab === 'settings'" class="ui-settings native-form">
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
      <div v-else class="ui-preview-area">
        <div class="ui-preview-toolbar">
          <button type="button" class="button" :aria-pressed="!mobile" @click="mobile = false">
            <Monitor :size="16" />{{ c('Desktop', 'Masaüstü') }}</button
          ><button type="button" class="button" :aria-pressed="mobile" @click="mobile = true">
            <Smartphone :size="16" />{{ c('Mobile', 'Telefon') }}</button
          ><span>{{
            c('Preview only · submissions blocked', 'Yalnızca önizleme · gönderim kapalı')
          }}</span>
        </div>
        <iframe
          :srcdoc="preview"
          sandbox=""
          :title="c('UI element preview', 'UI öğesi önizlemesi')"
          :style="{ width: mobile ? 'min(390px,100%)' : '100%' }"
        ></iframe>
      </div>
    </div>
    <template #footer
      ><button v-if="target" type="button" class="button" @click="save(true)">
        <Trash2 :size="14" />{{ c('Remove element', 'Öğeyi kaldır') }}</button
      ><button type="button" class="button" @click="emit('close')">
        {{ c('Cancel', 'İptal') }}</button
      ><button type="button" class="button primary" @click="save()">
        {{
          target ? c('Apply changes', 'Değişiklikleri uygula') : c('Insert element', 'Öğeyi ekle')
        }}
      </button></template
    >
  </AppDialog>
</template>
<style>
.ui-element-dialog[open] {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ui-element-dialog > .dialog-header,
.ui-element-dialog > .dialog-footer {
  flex-shrink: 0;
}
.ui-element-dialog > .ui-builder {
  min-height: 0;
  overflow: auto;
}
.ui-builder {
  color: #17253e;
}
.ui-builder-tabs {
  position: sticky;
  top: 0;
  z-index: 1;
  background: white;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 20px;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
}
.ui-builder-tabs button {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  padding: 9px 12px;
  border-radius: 8px;
  font: inherit;
  cursor: pointer;
}
.ui-builder-tabs button[aria-pressed='true'] {
  background: #edf2ff;
  color: #245bdd;
  font-weight: 600;
}
.ui-builder-tabs span {
  margin-left: auto;
  color: #64748b;
  font-size: 12px;
}
.ui-builder-layout {
  display: grid;
  grid-template-columns: 160px minmax(190px, 1fr) minmax(220px, 290px);
  min-height: 440px;
}
.ui-palette {
  padding: 16px 12px;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
}
.ui-builder h3 {
  margin: 0 0 14px;
  font-size: 13px;
}
.ui-palette button {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 9px 8px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 7px;
  margin-bottom: 6px;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.ui-palette p {
  font-size: 11px;
  color: #64748b;
  margin: 16px 0 0;
  line-height: 1.6;
}
.ui-field-list {
  background: #f1f5f9;
  padding: 18px 12px;
  max-height: 570px;
  overflow: auto;
}
.ui-field-row {
  display: flex;
  align-items: stretch;
  background: white;
  border: 1px solid #dbe2ed;
  border-radius: 10px;
  margin-bottom: 10px;
  overflow: hidden;
}
.ui-field-row.selected {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px #2563eb18;
}
.ui-field-row.dragging {
  opacity: 0.65;
}
.ui-field-row.drop-target {
  border-top: 3px solid #2563eb;
}
.ui-drag {
  touch-action: none;
  cursor: grab;
  background: transparent;
  border: 0;
  color: #94a3b8;
  padding: 4px;
}
.ui-field-select {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  padding: 12px 4px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
}
.ui-field-select small {
  color: #64748b;
  font-size: 10px;
}
.ui-field-select strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.ui-field-select span {
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  padding: 7px;
  color: #94a3b8;
  font-size: 12px;
}
.ui-row-arrows {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 4px;
}
.ui-row-arrows button {
  border: 0;
  background: transparent;
  padding: 7px;
  cursor: pointer;
  color: #52627a;
}
.ui-builder button:disabled {
  opacity: 0.4;
  cursor: default;
}
.ui-properties {
  padding: 18px !important;
  border-left: 1px solid #e2e8f0;
  max-height: 570px;
  overflow: auto;
}
.ui-properties .text-input {
  width: 100%;
  min-width: 0;
}
.ui-properties label,
.ui-settings label {
  font-size: 12px;
}
.ui-properties .ui-check {
  display: flex;
  gap: 8px;
  align-items: center;
}
.ui-number-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.ui-item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding-top: 12px;
}
.ui-item-actions .button {
  font-size: 11px;
  gap: 4px;
}
.ui-settings {
  padding: 24px;
  max-width: 650px;
  margin: auto;
}
.ui-preview-area {
  background: #e8eef5;
  padding: 16px;
}
.ui-preview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.ui-preview-toolbar span {
  font-size: 12px;
  color: #64748b;
}
.ui-preview-area iframe {
  display: block;
  margin: auto;
  border: 0;
  height: 470px;
  border-radius: 12px;
  background: #fff;
}
.ui-builder-announcement {
  font-size: 12px;
  color: #245bdd;
}
.ui-builder > .error-banner {
  margin: 12px 20px;
}
@media (max-width: 740px) {
  .ui-builder-layout {
    grid-template-columns: 1fr;
  }
  .ui-palette {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    border: 0;
  }
  .ui-palette h3,
  .ui-palette p {
    width: 100%;
    margin: 0;
  }
  .ui-palette button {
    width: auto;
    margin: 0;
  }
  .ui-field-list {
    max-height: 250px;
  }
  .ui-properties {
    max-height: none;
    border-left: 0;
    border-top: 1px solid #e2e8f0;
  }
  .ui-builder-tabs {
    padding: 10px;
  }
  .ui-settings {
    padding: 16px;
  }
}
</style>
