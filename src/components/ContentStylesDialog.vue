<script setup>
import { ref } from 'vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import { normalizeContentCss } from '../lib/content-css.js'
const props = defineProps({ urls: Array, status: Array })
const emit = defineEmits(['apply', 'close'])
const { t } = useEditorLocale()
const value = ref((props.urls || []).join('\n'))
const error = ref('')
function restore() {
  value.value = ''
  error.value = ''
  emit('apply', [])
}
function apply() {
  try {
    const urls = normalizeContentCss(value.value, document.baseURI)
    error.value = ''
    emit('apply', urls)
  } catch (failure) {
    error.value = failure.message
  }
}
</script>
<template>
  <AppDialog :title="t('İçerik stili ayarları')" @close="emit('close')">
    <div class="native-form">
      <p class="muted">
        {{
          t(
            'Sitenizin CSS dosyalarını içerik alanında kullanın. Her satıra bir adres girin; dosyalar listedeki sırayla uygulanır.',
          )
        }}
      </p>
      <label
        >{{ t('Harici CSS adresleri') }}
        <textarea
          class="text-input"
          v-model="value"
          :aria-label="t('Harici CSS adresleri')"
          rows="6"
          placeholder="https://example.com/assets/article.css"
          spellcheck="false"
        ></textarea>
      </label>
      <p class="muted">
        {{
          t(
            'Yalnızca güvendiğiniz stil dosyalarını ekleyin. CSS bu içerik alanına ve önizlemeye uygulanır; kaydedilen HTML veya sitenin arayüzü değişmez.',
          )
        }}
      </p>
      <p v-if="error" class="error-banner" role="alert">{{ t(error) }}</p>
      <ul v-if="status?.length" aria-live="polite" style="overflow-wrap: anywhere">
        <li v-for="item in status" :key="item.url">
          {{ item.url }} —
          {{
            t(
              item.status === 'loaded'
                ? 'Yüklendi'
                : item.status === 'error'
                  ? 'CSS yüklenemedi'
                  : 'Yükleniyor…',
            )
          }}
        </li>
      </ul>
    </div>
    <template #footer>
      <button class="button" type="button" @click="restore">
        {{ t('Varsayılan stile dön') }}
      </button>
      <button class="button primary" type="button" @click="apply">
        {{ t('Stilleri uygula') }}
      </button>
    </template>
  </AppDialog>
</template>
