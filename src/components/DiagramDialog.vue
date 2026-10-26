<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import {
  applyDiagram,
  diagramExample,
  diagramKinds,
  readDiagram,
  renderDiagram,
} from '../lib/diagram.js'

const props = defineProps({ engine: Object, target: Object })
const emit = defineEmits(['close'])
const { t, locale } = useEditorLocale()
const initial = readDiagram(props.target)
const source = ref(initial?.source || diagramExample('flowchart', locale.value))
const alt = ref(
  initial && props.target?.alt !== initial.source.split('\n')[0] ? props.target.alt : '',
)
const rendered = ref(null),
  error = ref(''),
  rendering = ref(false)
const revision = props.engine.revision
const kindLabels = {
  flowchart: 'Akış şeması',
  sequence: 'Sıralama diyagramı',
  gantt: 'Gantt',
  class: 'Sınıf diyagramı',
  state: 'Durum diyagramı',
  pie: 'Pasta grafik',
}
let timer,
  generation = 0,
  closed = false
watch(
  source,
  () => {
    clearTimeout(timer)
    const token = ++generation
    rendering.value = true
    error.value = ''
    timer = setTimeout(async () => {
      try {
        const image = await renderDiagram(source.value)
        if (token === generation && !closed) rendered.value = image
      } catch (failure) {
        if (token !== generation || closed) return
        rendered.value = null
        // Mermaid parse errors are plain text; show only the first lines.
        error.value = String(failure?.message || failure || '')
          .split('\n')
          .slice(0, 4)
          .join('\n')
          .slice(0, 600)
      } finally {
        if (token === generation && !closed) rendering.value = false
      }
    }, 300)
  },
  { immediate: true },
)
function save() {
  if (!rendered.value || rendering.value) return
  if (
    props.engine.revision !== revision ||
    !applyDiagram(props.engine, props.target, {
      ...rendered.value,
      source: source.value.trim(),
      alt: alt.value.trim(),
    })
  ) {
    error.value = t('Belge değişti. Pencereyi kapatıp yeniden açın.')
    return
  }
  emit('close')
}
onBeforeUnmount(() => {
  closed = true
  generation++
  clearTimeout(timer)
})
</script>

<template>
  <AppDialog :title="t('Diyagram (Mermaid)')" wide @close="emit('close')">
    <div class="native-form diagram-dialog">
      <div class="diagram-editor">
        <div class="diagram-examples" role="group" :aria-label="t('Diyagram örnekleri')">
          <button
            v-for="kind in diagramKinds"
            :key="kind"
            class="button"
            type="button"
            @click="source = diagramExample(kind, locale)"
          >
            {{ t(kindLabels[kind]) }}
          </button>
        </div>
        <label class="field-label"
          >{{ t('Mermaid kaynağı')
          }}<textarea
            v-model="source"
            class="text-input diagram-source"
            rows="12"
            maxlength="20000"
            spellcheck="false"
            :aria-label="t('Mermaid kaynağı')"
          ></textarea>
        </label>
        <label class="field-label"
          >{{ t('Alternatif metin')
          }}<input
            v-model="alt"
            class="text-input"
            maxlength="500"
            :placeholder="t('Diyagramın kısa açıklaması')"
            :aria-label="t('Diyagram alternatif metni')"
        /></label>
        <p class="muted">
          {{
            t(
              'Diyagram görsel olarak kaydedilir ve kaynağı belgede saklanır; düzenlemek için çift tıklayın.',
            )
          }}
        </p>
      </div>
      <figure class="diagram-preview" :aria-busy="rendering">
        <figcaption>{{ t('Önizleme') }}</figcaption>
        <img v-if="rendered" :src="rendered.src" :alt="t('Diyagram önizlemesi')" />
        <p v-else-if="rendering" role="status">{{ t('Diyagram çiziliyor…') }}</p>
        <pre v-if="error" class="error-banner diagram-error" role="alert">{{ error }}</pre>
      </figure>
    </div>
    <template #footer
      ><button class="button" @click="emit('close')">{{ t('Vazgeç') }}</button
      ><button class="button primary" :disabled="!rendered || rendering" @click="save">
        {{ target ? t('Diyagramı güncelle') : t('Diyagramı ekle') }}
      </button></template
    >
  </AppDialog>
</template>

<style>
.diagram-dialog {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
}
.diagram-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.diagram-source {
  width: 100%;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  resize: vertical;
}
.diagram-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 240px;
  margin: 0;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: white;
  overflow: auto;
}
.diagram-preview figcaption {
  color: #64748b;
  font-size: 12px;
}
.diagram-preview img {
  max-width: 100%;
  height: auto;
  align-self: center;
}
.diagram-error {
  white-space: pre-wrap;
  font-size: 12px;
}
@media (max-width: 760px) {
  .diagram-dialog {
    grid-template-columns: 1fr;
  }
}
</style>
