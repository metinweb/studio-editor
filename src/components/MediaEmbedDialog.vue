<script setup>
import { computed, ref } from 'vue'
import { Film, ExternalLink } from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import { parseMediaEmbed, readMediaEmbed } from '../lib/media-embed.js'
import { useEditorLocale } from '../lib/editor-locale'
const { t } = useEditorLocale()
const props = defineProps({ engine: Object, target: Object })
const emit = defineEmits(['close'])
const initial = readMediaEmbed(props.target)
const url = ref(initial?.url || '')
const caption = ref(initial?.caption || '')
const width = ref(initial?.width || 100)
const align = ref(initial?.align || 'center')
const preview = ref(false)
const error = ref('')
const media = computed(() => parseMediaEmbed(url.value))
function save() {
  if (!media.value || !props.engine.editable) return
  const options = { caption: caption.value, width: width.value, align: align.value }
  const done = props.target
    ? props.engine.updateEmbed(props.target, media.value.url, options)
    : props.engine.insertEmbed(media.value.url, options)
  if (done) emit('close')
  else error.value = t('Medya artık belgede bulunmuyor. Pencereyi yeniden açın.')
}
</script>
<template>
  <AppDialog
    :title="t(target ? 'Gömülü medyayı düzenle' : 'Bağlantıdan medya ekle')"
    wide
    @close="emit('close')"
  >
    <div class="embed-dialog-body">
      <label
        >{{ t('Medya bağlantısı') }}
        <input
          v-model="url"
          class="text-input"
          type="url"
          placeholder="https://www.youtube.com/watch?v=…"
          @input="preview = false"
        />
      </label>
      <p class="embed-help">
        {{
          t(
            'YouTube ve Vimeo bağlantılarını yapıştırın. Başlangıç zamanı ve gizli Vimeo bağlantıları desteklenir.',
          )
        }}
      </p>
      <p v-if="url.trim() && !media" role="alert" class="error-banner">
        {{ t('Geçerli bir YouTube veya Vimeo video bağlantısı girin.') }}
      </p>
      <div v-if="media" class="embed-preview">
        <iframe
          v-if="preview"
          :key="media.src"
          :src="media.src"
          :title="t('Medya önizlemesi')"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="fullscreen; picture-in-picture; encrypted-media"
          allowfullscreen
        />
        <button v-else class="embed-preview-start" @click="preview = true">
          <Film :size="36" /><strong>{{ media.provider }}</strong
          ><span>{{ t('Önizlemeyi aç') }}</span>
        </button>
      </div>
      <div class="embed-options">
        <label
          >{{ t('Medya açıklaması')
          }}<input
            v-model="caption"
            class="text-input"
            maxlength="500"
            :placeholder="t('İsteğe bağlı açıklama')"
        /></label>
        <label
          >{{ t('Genişlik (%)')
          }}<input v-model="width" class="text-input" type="number" min="25" max="100"
        /></label>
      </div>
      <div class="embed-alignment" role="group" :aria-label="t('Medya hizalaması')">
        <button
          v-for="item in [
            { id: 'left', label: 'Sola' },
            { id: 'center', label: 'Ortala' },
            { id: 'right', label: 'Sağa' },
          ]"
          :key="item.id"
          class="button"
          :aria-pressed="align === item.id"
          @click="align = item.id"
        >
          {{ t(item.label) }}
        </button>
        <a v-if="media" :href="media.url" target="_blank" rel="noopener noreferrer"
          ><ExternalLink :size="14" /> {{ t('Kaynakta aç') }}</a
        >
      </div>
      <p class="embed-help">
        {{
          t(
            'Önizleme sağlayıcıdan yüklenir. Videonun sahibi gömmeyi kısıtlamışsa kaynak bağlantısını kullanın.',
          )
        }}
      </p>
      <p v-if="error" role="alert" class="error-banner">{{ error }}</p>
    </div>
    <template #footer
      ><button class="button" @click="emit('close')">{{ t('İptal') }}</button
      ><button class="button primary" :disabled="!media || !engine.editable" @click="save">
        {{ t(target ? 'Medyayı güncelle' : 'Medyayı ekle') }}
      </button></template
    >
  </AppDialog>
</template>
<style>
.embed-dialog-body {
  padding: 22px;
}
.embed-dialog-body label {
  display: grid;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
}
.embed-dialog-body input {
  width: 100%;
  box-sizing: border-box;
}
.embed-help {
  font-size: 12px;
  color: #657185;
  line-height: 1.6;
}
.embed-preview {
  overflow: hidden;
  border-radius: 12px;
  margin: 16px 0;
  background: #111b2d;
}
.embed-preview iframe {
  display: block;
  width: 100%;
  aspect-ratio: 16/9;
  border: 0;
}
.embed-preview-start {
  display: flex;
  width: 100%;
  min-height: 175px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #111b2d;
  color: #e7edff;
  border: 0;
  cursor: pointer;
}
.embed-options {
  display: grid;
  grid-template-columns: 1fr 115px;
  gap: 16px;
}
.embed-alignment {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  align-items: center;
}
.embed-alignment [aria-pressed='true'] {
  background: #eae4fc;
  color: #5632a7;
  border-color: #9c83d9;
}
.embed-alignment a {
  display: flex;
  gap: 5px;
  margin-left: auto;
  font-size: 12px;
  color: #5632a7;
}
@media (max-width: 480px) {
  .embed-options {
    grid-template-columns: 1fr;
  }
}
</style>
