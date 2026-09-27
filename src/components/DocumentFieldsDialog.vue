<script setup>
import { computed, ref } from 'vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
const props = defineProps({ engine: Object, kind: String })
const emit = defineEmits(['close'])
const { t } = useEditorLocale()
const title = computed(
  () =>
    ({ anchor: 'Bağlantı hedefleri', footnote: 'Dipnotlar', fields: 'Şablon değişkenleri' })[
      props.kind
    ],
)
const existing = computed(() =>
  props.kind === 'anchor'
    ? [...props.engine.root.querySelectorAll('[id]')]
        .filter((node) => !node.closest('[data-studio-footnotes],[data-studio-footnote-ref]'))
        .map((node) => ({ id: node.id, text: node.textContent.slice(0, 70) }))
    : [...props.engine.root.querySelectorAll('li[data-studio-footnote]')].map((node) => ({
        id: node.id,
        text: node.querySelector('p')?.textContent || node.textContent,
      })),
)
const selected = ref(''),
  value = ref(''),
  error = ref(''),
  fieldValues = ref({})
const keys = [
  ...new Set(
    [...props.engine.root.querySelectorAll('[data-studio-field]')].map(
      (node) => node.dataset.studioField,
    ),
  ),
]
const revision = props.engine.revision
function pick(item) {
  selected.value = item.id
  value.value = props.kind === 'anchor' ? item.id : item.text
  error.value = ''
}
function validSession() {
  if (!props.engine.editable || props.engine.destroyed || props.engine.revision !== revision) {
    error.value = 'Belge değişti. İşlemi yeniden açın.'
    return false
  }
  return true
}
function apply() {
  if (!validSession()) return
  const ok =
    props.kind === 'anchor'
      ? props.engine.setAnchor(value.value.trim(), selected.value)
      : props.kind === 'footnote'
        ? props.engine.footnote(value.value, selected.value)
        : props.engine.insertField(value.value.trim())
  if (ok) emit('close')
  else
    error.value =
      props.kind === 'footnote'
        ? 'Dipnot metni gereklidir.'
        : 'Harfle başlayan benzersiz bir ad kullanın; boşluk kullanmayın.'
}
function remove() {
  if (!validSession()) return
  if (props.kind === 'anchor') props.engine.removeAnchor(selected.value)
  else props.engine.removeFootnote(selected.value)
  emit('close')
}
function fill() {
  if (!validSession()) return
  props.engine.fillFields(fieldValues.value)
  emit('close')
}
</script>
<template>
  <AppDialog :title="t(title)" @close="emit('close')">
    <form id="document-fields" class="native-form" @submit.prevent="apply">
      <div v-if="kind !== 'fields' && existing.length" class="document-field-items">
        <button
          v-for="item in existing"
          :key="item.id"
          type="button"
          :aria-pressed="selected === item.id"
          @click="pick(item)"
        >
          <strong>{{ kind === 'anchor' ? '#' + item.id : t('Dipnot') }}</strong
          ><span>{{ item.text }}</span>
        </button>
      </div>
      <label class="field-label"
        >{{
          t(
            kind === 'anchor' ? 'Hedef adı' : kind === 'footnote' ? 'Dipnot metni' : 'Değişken adı',
          )
        }}<textarea
          v-if="kind === 'footnote'"
          v-model="value"
          class="text-input"
          rows="4"
          maxlength="4000"
          required
          :aria-label="t('Dipnot metni')"
        ></textarea
        ><input
          v-else
          v-model="value"
          class="text-input"
          :placeholder="kind === 'fields' ? 'Customer.Name' : 'section-name'"
          maxlength="80"
          required
          :aria-label="t(kind === 'anchor' ? 'Hedef adı' : 'Değişken adı')"
      /></label>
      <p class="muted">
        {{
          t(
            kind === 'anchor'
              ? 'Bağlantı eklerken bu hedefi seçerek belge içinde gezinin.'
              : kind === 'footnote'
                ? 'Dipnotlar otomatik numaralanır; kaynak silindiğinde dipnot da kaldırılır.'
                : 'Değişkenler belge içinde korunur. Aşağıdan değerlerini doldurabilirsiniz.',
          )
        }}
      </p>
      <div v-if="kind === 'fields' && keys.length" class="field-values">
        <label v-for="key in keys" :key="key" class="field-label"
          >{{ key
          }}<input
            v-model="fieldValues[key]"
            class="text-input"
            :aria-label="key"
            maxlength="10000" /></label
        ><button
          type="button"
          class="button"
          :disabled="!Object.keys(fieldValues).length"
          @click="fill"
        >
          {{ t('Değerleri belgeye uygula') }}
        </button>
      </div>
      <p v-if="error" class="error-banner" role="alert">{{ t(error) }}</p>
    </form>
    <template #footer
      ><button v-if="selected" class="button danger" @click="remove">{{ t('Kaldır') }}</button
      ><button class="button" @click="emit('close')">{{ t('Vazgeç') }}</button
      ><button class="button primary" form="document-fields" type="submit">
        {{ t(selected ? 'Güncelle' : 'Ekle') }}
      </button></template
    >
  </AppDialog>
</template>
