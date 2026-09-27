<script setup>
import { ref } from 'vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import { readCondition } from '../lib/conditional-fields.js'
import { escapeHtml } from '../lib/content'
const props = defineProps({ engine: Object, target: Object })
const emit = defineEmits(['close'])
const { t } = useEditorLocale()
const form = ref(
  readCondition(props.target?.dataset.studioCondition) || {
    key: 'Customer.Type',
    operator: 'equals',
    match: 'business',
    yes: 'Business customer',
    no: 'Individual customer',
  },
)
const error = ref('')
const revision = props.engine.revision
const bookmark = props.engine.rememberSelection()
function apply() {
  if (
    !props.engine.editable ||
    props.engine.destroyed ||
    props.engine.revision !== revision ||
    (props.target && !props.target.isConnected)
  ) {
    error.value = 'Belge değişti. İşlemi yeniden açın.'
    return
  }
  const condition = readCondition({ ...form.value, key: form.value.key.trim() })
  if (!condition) {
    error.value = 'Geçerli bir değişken adı ve koşul metinleri girin.'
    return
  }
  if (props.target)
    props.engine.transaction(() => {
      props.target.dataset.studioCondition = JSON.stringify(condition)
    }, 'conditionalField')
  else {
    props.engine.restoreSelection(bookmark)
    props.engine.insert(
      `<span data-studio-condition="${escapeHtml(JSON.stringify(condition))}"></span>&nbsp;`,
    )
  }
  emit('close')
}
</script>
<template>
  <AppDialog class="writing-tool-dialog" :title="t('Koşullu alan')" @close="emit('close')">
    <form id="conditional-field" class="native-form" @submit.prevent="apply">
      <p class="muted">
        {{
          t(
            'Değişken alanlarını doldurduğunuzda koşula göre iki metinden biri kullanılır. Düzenlemek için alana çift tıklayın.',
          )
        }}
      </p>
      <label class="field-label"
        >{{ t('Değişken adı')
        }}<input
          class="text-input"
          v-model="form.key"
          :aria-label="t('Değişken adı')"
          maxlength="80"
          required
      /></label>
      <label class="field-label"
        >{{ t('Koşul')
        }}<select class="text-input" v-model="form.operator" :aria-label="t('Koşul')">
          <option value="equals">{{ t('Eşittir') }}</option>
          <option value="notEmpty">{{ t('Boş değil') }}</option>
        </select></label
      >
      <label v-if="form.operator === 'equals'" class="field-label"
        >{{ t('Karşılaştırılacak değer')
        }}<input
          class="text-input"
          v-model="form.match"
          :aria-label="t('Karşılaştırılacak değer')"
          maxlength="2000"
      /></label>
      <label class="field-label"
        >{{ t('Koşul doğruysa')
        }}<textarea
          class="text-input"
          v-model="form.yes"
          :aria-label="t('Koşul doğruysa')"
          maxlength="2000"
          rows="3"
        ></textarea>
      </label>
      <label class="field-label"
        >{{ t('Koşul yanlışsa')
        }}<textarea
          class="text-input"
          v-model="form.no"
          :aria-label="t('Koşul yanlışsa')"
          maxlength="2000"
          rows="3"
        ></textarea>
      </label>
      <p v-if="error" role="alert" class="error-banner">{{ t(error) }}</p>
    </form>
    <template #footer
      ><button class="button" @click="emit('close')">{{ t('Vazgeç') }}</button
      ><button class="button primary" type="submit" form="conditional-field">
        {{ t(target ? 'Güncelle' : 'Ekle') }}
      </button></template
    >
  </AppDialog>
</template>
