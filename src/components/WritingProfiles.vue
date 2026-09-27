<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useEditorLocale } from '../lib/editor-locale'
import {
  loadWritingProfiles,
  saveWritingProfiles,
  parseWritingProfile,
} from '../lib/writing-profiles.js'
const props = defineProps({ kind: String, value: Object })
const emit = defineEmits(['load'])
const { t } = useEditorLocale()
const entries = ref([]),
  name = ref(''),
  selected = ref(''),
  error = ref(''),
  message = ref('')
const matching = computed(() => entries.value.filter((item) => item.kind === props.kind))
let disposed = false,
  importEpoch = 0
onBeforeUnmount(() => {
  disposed = true
})
onMounted(() => {
  try {
    entries.value = loadWritingProfiles(localStorage)
  } catch {
    error.value = 'Yazma profilleri okunamadı.'
  }
})
function save() {
  error.value = ''
  message.value = ''
  try {
    const profile = parseWritingProfile({
      schemaVersion: 1,
      kind: props.kind,
      name: name.value,
      value: props.value,
    })
    const current = loadWritingProfiles(localStorage)
    if (current.some((item) => item.kind === props.kind && item.name === profile.name)) {
      error.value = 'Bu adla bir profil var. Yeni bir ad kullanın.'
      return
    }
    entries.value = saveWritingProfiles(localStorage, [...current, profile])
    selected.value = profile.name
    name.value = ''
    message.value = 'Profil bu tarayıcıya kaydedildi.'
  } catch (e) {
    error.value = e.message.startsWith('En fazla')
      ? e.message
      : 'Profil kaydedilemedi. JSON olarak dışa aktarabilirsiniz.'
  }
}
function load() {
  const profile = matching.value.find((item) => item.name === selected.value)
  if (profile) {
    emit('load', structuredClone(JSON.parse(JSON.stringify(profile.value))))
    message.value = 'Profil yüklendi. Kullanmak için ayarları uygulayın.'
  }
}
function remove() {
  try {
    entries.value = saveWritingProfiles(
      localStorage,
      loadWritingProfiles(localStorage).filter(
        (item) => !(item.kind === props.kind && item.name === selected.value),
      ),
    )
    selected.value = ''
    error.value = ''
    message.value = ''
  } catch {
    error.value = 'Profil kaydedilemedi. JSON olarak dışa aktarabilirsiniz.'
  }
}
function download() {
  const profile = parseWritingProfile({
    schemaVersion: 1,
    kind: props.kind,
    name: name.value.trim() || selected.value || 'Writing profile',
    value: props.value,
  })
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'writing-profile.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function read(event) {
  const run = ++importEpoch
  error.value = ''
  const file = event.target.files?.[0]
  if (!file) return
  try {
    if (file.size > 800000) throw new Error()
    const profile = parseWritingProfile(JSON.parse(await file.text()))
    if (disposed || run !== importEpoch) return
    if (profile.kind !== props.kind) throw new Error()
    emit('load', profile.value)
    name.value = profile.name
    message.value = 'Profil yüklendi. Kullanmak için ayarları uygulayın.'
  } catch {
    if (!disposed && run === importEpoch) error.value = 'Geçerli bir yazma profili seçin.'
  }
  event.target.value = ''
}
</script>
<template>
  <details class="writing-profiles">
    <summary>{{ t('Yazma profilleri') }}</summary>
    <div class="profile-body">
      <p class="muted">
        {{
          t(
            'Adlandırılmış profilleri bu tarayıcıda saklayın veya JSON ile taşıyın. Profil yüklemek ayarları otomatik uygulamaz.',
          )
        }}
      </p>
      <label
        >{{ t('Profil adı')
        }}<input class="text-input" v-model="name" :aria-label="t('Profil adı')" maxlength="80"
      /></label>
      <button type="button" class="button" :disabled="!name.trim()" @click="save">
        {{ t('Profili kaydet') }}
      </button>
      <label
        >{{ t('Kayıtlı profiller')
        }}<select class="text-input" v-model="selected" :aria-label="t('Kayıtlı profiller')">
          <option value="">{{ t('Profil seçin') }}</option>
          <option v-for="item in matching" :key="item.name" :value="item.name">
            {{ item.name }}
          </option>
        </select></label
      >
      <div class="profile-actions">
        <button type="button" class="button" :disabled="!selected" @click="load">
          {{ t('Profili yükle') }}</button
        ><button type="button" class="button" :disabled="!selected" @click="remove">
          {{ t('Profili sil') }}</button
        ><button type="button" class="button" @click="download">
          {{ t('Profil JSON indir') }}
        </button>
      </div>
      <label
        >{{ t('Profil JSON içe aktar')
        }}<input
          type="file"
          accept=".json,application/json"
          :aria-label="t('Profil JSON içe aktar')"
          @change="read"
      /></label>
      <p v-if="error" role="alert" class="error-banner">{{ t(error) }}</p>
      <p v-if="message" role="status">{{ t(message) }}</p>
    </div>
  </details>
</template>
