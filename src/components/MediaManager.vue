<script setup>
import { useEditorLocale } from '../lib/editor-locale'
const { t, locale } = useEditorLocale()
import { computed, ref } from 'vue'
import {
  Search,
  UploadCloud,
  Image,
  Film,
  Music2,
  FileText,
  Trash2,
  Plus,
  HardDrive,
} from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import { acceptedTypes, formatSize } from '../stores/media'
import { useEditorMedia } from '../stores/editor-media'
import { assetUrl } from '../lib/media-service'

const emit = defineEmits(['close', 'insert'])
const media = useEditorMedia()
const query = ref('')
const filter = ref('all')
const selectedId = ref(null)
const fileInput = ref(null)
const dragging = ref(false)
const alt = ref('')
const actionError = ref('')
const selected = computed(() => media.items.find((item) => item.id === selectedId.value))
const filtered = computed(() =>
  media.items.filter(
    (item) =>
      (filter.value === 'all' || item.type.startsWith(filter.value)) &&
      item.name.toLocaleLowerCase('tr').includes(query.value.toLocaleLowerCase('tr')),
  ),
)
const filters = [
  { id: 'all', title: 'Tümü' },
  { id: 'image', title: 'Görseller' },
  { id: 'video', title: 'Videolar' },
  { id: 'audio', title: 'Sesler' },
  { id: 'application', title: 'Belgeler' },
]
const totalSize = computed(() =>
  formatSize(media.items.reduce((total, item) => total + item.size, 0)),
)
const iconFor = (item) =>
  item.type.startsWith('video') ? Film : item.type.startsWith('audio') ? Music2 : FileText

function select(item) {
  selectedId.value = item.id
  alt.value = item.alt
  actionError.value = ''
}
async function upload(files) {
  if (media.busy) return
  const added = await media.upload(Array.from(files || []))
  if (added.length) {
    query.value = ''
    filter.value = 'all'
    select(added[0])
  }
  if (fileInput.value) fileInput.value.value = ''
}
function drop(event) {
  dragging.value = false
  upload(event.dataTransfer.files)
}
async function remove() {
  const consequence = assetUrl(selected.value).startsWith('data:')
    ? 'Belgelerdeki kopyaları korunur.'
    : 'Bu dosyayı kullanan belgelerde medya artık görünmeyebilir.'
  if (!window.confirm(`“${selected.value.name}” kütüphaneden silinsin mi? ${consequence}`)) return
  try {
    await media.remove(selectedId.value)
    selectedId.value = null
  } catch {
    actionError.value = 'Dosya silinemedi. Lütfen tekrar deneyin.'
  }
}
async function insert() {
  try {
    await media.update(selected.value, { alt: alt.value })
    emit('insert', selected.value)
  } catch {
    actionError.value = 'Dosya bilgileri kaydedilemedi. Lütfen tekrar deneyin.'
  }
}
</script>

<template>
  <AppDialog :title="t('Medya kütüphanesi')" wide @close="emit('close')">
    <template #eyebrow
      ><span class="eyebrow"> {{ t('DOSYALARINIZA YER AÇIN') }} </span></template
    >
    <div class="media-body">
      <input
        ref="fileInput"
        type="file"
        multiple
        :accept="acceptedTypes.join(',')"
        hidden
        @change="upload($event.target.files)"
      />
      <button
        class="upload-zone"
        :class="{ dragging }"
        :disabled="media.busy"
        @click="fileInput.click()"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="drop"
      >
        <span class="upload-icon"><UploadCloud :size="26" /></span>
        <strong>{{
          media.busy ? t('Dosyalar yükleniyor…') : t('Dosyalarınızı buraya sürükleyin')
        }}</strong>
        <span>
          {{ t('veya') }} <b> {{ t('dosya seçin') }} </b>
          {{ t('· Görsel, video, ses ve PDF · En fazla 12 MB / dosya') }}
        </span>
      </button>
      <div v-if="media.busy && media.cancel" class="media-transfer" role="status">
        <progress :value="media.progress" max="100" :aria-label="t('Yükleme ilerlemesi')" />
        <span>%{{ media.progress }}</span>
        <button class="button" @click="media.cancel()">{{ t('Yüklemeyi iptal et') }}</button>
      </div>
      <button v-if="!media.busy && media.retryCount" class="button" @click="media.retry()">
        {{ t('Başarısız yüklemeleri tekrar dene (') }} {{ media.retryCount }})
      </button>
      <p v-if="media.error || actionError" class="error-banner" role="alert">
        {{ media.error || actionError }}
      </p>
      <div class="media-toolbar">
        <div class="filter-tabs">
          <button
            v-for="item in filters"
            :key="item.id"
            :class="{ active: filter === item.id }"
            @click="filter = item.id"
          >
            {{ t(item.title) }}
          </button>
        </div>
        <label class="search-box"
          ><Search :size="16" /><input
            v-model="query"
            :placeholder="t('Dosyalarda ara…')"
            :aria-label="t('Medya ara')"
        /></label>
      </div>
      <div class="media-content">
        <div v-if="!filtered.length" class="empty-media">
          <Image :size="38" :stroke-width="1.2" />
          <h3>
            {{ query || media.items.length ? t('Dosya bulunamadı') : t('İlk dosyanızı ekleyin') }}
          </h3>
          <p>
            {{
              query || media.items.length
                ? t('Aramanızı veya dosya türü filtresini değiştirin.')
                : t('İçeriğinize hayat verecek dosyalar burada birikir.')
            }}
          </p>
        </div>
        <div v-else class="media-grid">
          <button
            v-for="item in filtered"
            :key="item.id"
            class="media-card"
            :class="{ selected: selectedId === item.id }"
            :aria-pressed="selectedId === item.id"
            @click="select(item)"
          >
            <div class="media-thumbnail">
              <img
                v-if="item.type.startsWith('image/')"
                :src="assetUrl(item)"
                :alt="item.alt || item.name"
              /><component :is="iconFor(item)" v-else :size="38" :stroke-width="1.2" />
            </div>
            <strong :title="item.name">{{ item.name }}</strong
            ><span>{{ formatSize(item.size) }} · {{ item.type.split('/')[1].toUpperCase() }}</span>
          </button>
        </div>
        <aside v-if="selected" class="media-details">
          <h3>{{ t('Dosya ayrıntıları') }}</h3>
          <img
            v-if="selected.type.startsWith('image/')"
            class="detail-preview"
            :src="assetUrl(selected)"
            :alt="selected.alt"
          />
          <video
            v-else-if="selected.type.startsWith('video/')"
            class="detail-preview"
            :src="assetUrl(selected)"
            controls
          />
          <audio
            v-else-if="selected.type.startsWith('audio/')"
            class="detail-audio"
            :src="assetUrl(selected)"
            controls
          />
          <p class="file-name">{{ selected.name }}</p>
          <p class="muted">{{ formatSize(selected.size) }}</p>
          <label v-if="selected.type.startsWith('image/')" class="field-label">
            {{ t('Alternatif metin') }}
            <input
              v-model="alt"
              class="text-input"
              :placeholder="t('Görseli kısaca açıklayın')"
            /><small> {{ t('Ekran okuyucular için görsel açıklaması.') }} </small></label
          >
          <button class="button danger subtle" @click="remove">
            <Trash2 :size="15" /> {{ t('Kütüphaneden sil') }}
          </button>
        </aside>
      </div>
    </div>
    <template #footer
      ><p class="muted footer-note">
        <HardDrive :size="14" /> {{ media.items.length }} {{ t('dosya ·') }} {{ totalSize }} ·
        {{ media.locationLabel || t('Bu tarayıcıda saklanır') }}
      </p>
      <button class="button" @click="emit('close')">{{ t('Kapat') }}</button
      ><button class="button primary" :disabled="!selected || media.busy" @click="insert">
        <Plus :size="16" /> {{ t('Belgeye ekle') }}
      </button></template
    >
  </AppDialog>
</template>
