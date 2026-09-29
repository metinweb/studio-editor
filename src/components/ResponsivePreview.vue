<script setup>
import { ref, computed } from 'vue'
import { useEditorLocale } from '../lib/editor-locale'
const props = defineProps({ html: String })
const srcdoc = computed(() => props.html?.replaceAll('href="#', 'href="about:srcdoc#'))
const { locale } = useEditorLocale()
const c = (en, tr) => (locale.value === 'tr' ? tr : en)
const size = ref('desktop'),
  landscape = ref(false)
const width = computed(() =>
  size.value === 'desktop'
    ? '100%'
    : `${size.value === 'mobile' ? (landscape.value ? 844 : 390) : landscape.value ? 1024 : 768}px`,
)
</script>
<template>
  <div
    class="responsive-preview-controls"
    role="group"
    :aria-label="c('Preview viewport', 'Önizleme ekranı')"
  >
    <button
      v-for="[id, en, tr] in [
        ['desktop', 'Desktop', 'Masaüstü'],
        ['tablet', 'Tablet', 'Tablet'],
        ['mobile', 'Mobile', 'Telefon'],
      ]"
      :key="id"
      type="button"
      class="button"
      :aria-pressed="size === id"
      @click="size = id"
    >
      {{ c(en, tr) }}
    </button>
    <button
      v-if="size !== 'desktop'"
      type="button"
      class="button"
      :aria-pressed="landscape"
      @click="landscape = !landscape"
    >
      {{ c('Landscape', 'Yatay') }}
    </button>
    <span>{{ size === 'desktop' ? c('Fit container', 'Alana sığdır') : width }}</span>
  </div>
  <div class="responsive-preview-scroll">
    <iframe
      class="document-preview-frame"
      :style="{ width, minWidth: width }"
      sandbox=""
      :title="c('Document preview content', 'Belge önizleme içeriği')"
      :srcdoc="srcdoc"
    ></iframe>
  </div>
</template>
<style>
.responsive-preview-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
  padding: 12px 20px;
}
.responsive-preview-controls [aria-pressed='true'] {
  background: #edf2ff;
  border-color: #2563eb;
  color: #1d4ed8;
}
.responsive-preview-scroll {
  overflow: auto;
  background: #e8edf4;
  padding: 12px;
}
.responsive-preview-scroll .document-preview-frame {
  display: block;
  margin: auto;
  border: 0;
  background: white;
  max-width: none;
}
</style>
