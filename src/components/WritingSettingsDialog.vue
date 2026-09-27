<script setup>
import { ref, computed, toRaw } from 'vue'
import AppDialog from './AppDialog.vue'
import WritingProfiles from './WritingProfiles.vue'
import { useEditorLocale } from '../lib/editor-locale'
import {
  defaultWritingPreferences,
  normalizeWritingPreferences,
  normalizePen,
  penStyles,
} from '../lib/writing-preferences.js'
const props = defineProps({ kind: String, preferences: Object, pen: Object })
const emit = defineEmits(['close', 'apply'])
const { t } = useEditorLocale()
const settings = ref(structuredClone(toRaw(props.kind === 'pen' ? props.pen : props.preferences)))
const from = ref(''),
  to = ref(''),
  error = ref('')
const title = computed(() =>
  props.kind === 'pen' ? 'Kalıcı kalem' : 'Otomatik düzeltme ve metin kısayolları',
)
function add() {
  error.value = ''
  const key = from.value.trim()
  if (
    !key ||
    /\s/u.test(key) ||
    key.length > 60 ||
    !to.value ||
    to.value.length > 1000 ||
    settings.value.rules.some((r) => r.from === key) ||
    settings.value.rules.length >= 100
  ) {
    error.value =
      'Boşluksuz ve benzersiz bir kısayol ile bir karşılık girin. En fazla 100 kural eklenebilir.'
    return
  }
  settings.value.rules.push({ from: key, to: to.value })
  from.value = to.value = ''
}
function apply() {
  emit(
    'apply',
    props.kind === 'pen'
      ? normalizePen(settings.value)
      : normalizeWritingPreferences(settings.value),
  )
  emit('close')
}
</script>
<template>
  <AppDialog class="writing-tool-dialog" :title="t(title)" wide @close="emit('close')">
    <div class="native-form writing-settings">
      <WritingProfiles :kind="kind" :value="settings" @load="settings = $event" />
      <label class="writing-check"
        ><input type="checkbox" v-model="settings.enabled" :aria-label="t('Etkinleştir')" />{{
          t('Etkinleştir')
        }}</label
      >
      <template v-if="kind === 'pen'">
        <p class="muted">
          {{
            t(
              'Kalem açıkken yeni yazılan metin bu biçimi kullanır. Mevcut metin değişmez; yapıştırma, kod, bağlantı ve IME girişi kendi biçimini korur.',
            )
          }}
        </p>
        <div class="writing-pen-grid">
          <label
            >{{ t('Metin rengi')
            }}<input type="color" v-model="settings.color" :aria-label="t('Metin rengi')"
          /></label>
          <label
            >{{ t('Vurgu rengi')
            }}<input type="color" v-model="settings.backgroundColor" :aria-label="t('Vurgu rengi')"
          /></label>
          <label
            >{{ t('Yazı boyutu')
            }}<input
              class="text-input"
              type="number"
              min="8"
              max="200"
              v-model.number="settings.fontSize"
              :aria-label="t('Kalem yazı boyutu')"
          /></label>
        </div>
        <div class="writing-pen-options">
          <label
            v-for="[key, label] in [
              ['bold', 'Kalın'],
              ['italic', 'İtalik'],
              ['underline', 'Altı çizili'],
              ['highlight', 'Vurgulamayı kullan'],
            ]"
            :key="key"
            class="writing-check"
            ><input type="checkbox" v-model="settings[key]" />{{ t(label) }}</label
          >
        </div>
        <div class="writing-pen-preview" :style="penStyles(settings)">
          {{ t('Kalıcı kalem önizlemesi') }}
        </div>
      </template>
      <template v-else>
        <p class="muted">
          {{
            t(
              'Boşluk yazınca tam kısayol değiştirilir. Büyük/küçük harf duyarlıdır. Kod, bağlantı, yorum ve korumalı alanlarda çalışmaz. Geri al ile son düzeltmeyi geri çevirebilirsiniz.',
            )
          }}
        </p>
        <label class="writing-check"
          ><input type="checkbox" v-model="settings.smartSymbols" />{{
            t('Akıllı simgeler: (c), (tm), ..., --, ->')
          }}</label
        >
        <form class="writing-rule-form" @submit.prevent="add">
          <label
            >{{ t('Kısayol')
            }}<input
              class="text-input"
              v-model="from"
              :aria-label="t('Kısayol')"
              placeholder=";signature"
              maxlength="60"
          /></label>
          <label
            >{{ t('Yerine yazılacak metin')
            }}<textarea
              class="text-input"
              v-model="to"
              :aria-label="t('Yerine yazılacak metin')"
              maxlength="1000"
              rows="2"
            ></textarea>
          </label>
          <button class="button" type="submit">{{ t('Kural ekle') }}</button>
        </form>
        <p v-if="error" role="alert" class="error-banner">{{ t(error) }}</p>
        <div class="writing-rule-list">
          <div v-for="(rule, index) in settings.rules" :key="rule.from" class="writing-rule-row">
            <code>{{ rule.from }}</code
            ><span>{{ rule.to }}</span
            ><button
              class="button"
              :aria-label="t('Kuralı kaldır: {name}', { name: rule.from })"
              @click="settings.rules.splice(index, 1)"
            >
              {{ t('Kaldır') }}
            </button>
          </div>
        </div>
        <button class="button" @click="settings.rules = defaultWritingPreferences().rules">
          {{ t('Varsayılan kuralları yükle') }}
        </button>
      </template>
      <p class="muted">
        {{ t('Ayarlar bu editör oturumu için geçerlidir; belge içeriğine eklenmez.') }}
      </p>
    </div>
    <template #footer
      ><button class="button" @click="emit('close')">{{ t('Vazgeç') }}</button
      ><button class="button primary" @click="apply">{{ t('Ayarları uygula') }}</button></template
    >
  </AppDialog>
</template>
