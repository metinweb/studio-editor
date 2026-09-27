<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppDialog from './AppDialog.vue'
import MoleculeSketcher from './MoleculeSketcher.vue'
import { useEditorLocale } from '../lib/editor-locale'
import {
  readScience,
  moleculePreset,
  moleculeSvg,
  sciencePng,
  applyScience,
} from '../lib/science.js'
const { t } = useEditorLocale()
const props = defineProps({
  engine: Object,
  target: Object,
  kind: { type: String, default: 'math' },
})
const emit = defineEmits(['close'])
const initial = readScience(props.target)
const kind = ref(initial?.kind || props.kind)
const math = ref(
  initial?.kind === 'math' ? initial.source : 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
)
const chemistry = ref(initial?.kind === 'chemistry' ? initial.source : '2H2 + O2 -> 2H2O')
const graph = ref(initial?.graph || moleculePreset('benzene'))
const alt = ref(
  initial && initial.kind !== 'molecule' && props.target?.alt === initial.source.slice(0, 500)
    ? ''
    : props.target?.alt || '',
)
const source = computed({
  get: () => (kind.value === 'chemistry' ? chemistry.value : math.value),
  set: (v) => {
    if (kind.value === 'chemistry') chemistry.value = v
    else math.value = v
  },
})
const rendered = ref(null),
  error = ref(''),
  busy = ref(false),
  rendering = ref(false)
let timer,
  generation = 0,
  closed = false
const revision = props.engine.revision
const examples = computed(() =>
  kind.value === 'chemistry'
    ? ['H2O', '2H2 + O2 -> 2H2O', 'CH2=CH2', 'HC#CH', 'NH4+ + OH- <=> NH3 + H2O']
    : [
        'E = mc^2',
        '\\frac{a}{b}',
        '\\int_0^1 x^2\\,dx = \\frac{1}{3}',
        '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}',
        '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
      ],
)
watch(
  [kind, source, graph],
  () => {
    clearTimeout(timer)
    const token = ++generation
    rendered.value = null
    error.value = ''
    rendering.value = true
    if (kind.value === 'molecule' && !graph.value.atoms.length) {
      rendering.value = false
      return
    }
    timer = setTimeout(async () => {
      try {
        const diagram =
          kind.value === 'molecule'
            ? moleculeSvg(graph.value)
            : (await import('../lib/science-renderer.js')).equationSvg(source.value, kind.value)
        const png = await sciencePng(diagram)
        if (token === generation && !closed) rendered.value = png
      } catch {
        if (token === generation && !closed)
          error.value = t('Önizleme oluşturulamadı. Formülü veya çizimi kontrol edin.')
      } finally {
        if (token === generation && !closed) rendering.value = false
      }
    }, 250)
  },
  { immediate: true, deep: true },
)
function save() {
  if (!rendered.value || rendering.value || busy.value) return
  busy.value = true
  if (
    props.engine.revision !== revision ||
    !applyScience(props.engine, props.target, {
      ...rendered.value,
      kind: kind.value,
      source: kind.value === 'molecule' ? JSON.stringify(graph.value) : source.value,
      alt: alt.value || (kind.value === 'molecule' ? t('Molekül çizimi') : source.value),
    })
  ) {
    error.value = t('Belge değişti. Pencereyi kapatıp yeniden açın.')
    busy.value = false
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
  <AppDialog :title="t('Matematik ve kimya')" wide @close="emit('close')">
    <div class="science-dialog-body" :class="{ 'science-molecule': kind === 'molecule' }">
      <div class="science-tabs" role="group" :aria-label="t('İçerik türü')">
        <button
          v-for="item in [
            ['math', 'Matematik'],
            ['chemistry', 'Kimyasal formül'],
            ['molecule', 'Molekül çizimi'],
          ]"
          :key="item[0]"
          class="button"
          :aria-pressed="kind === item[0]"
          @click="kind = item[0]"
        >
          {{ t(item[1]) }}
        </button>
      </div>
      <MoleculeSketcher v-if="kind === 'molecule'" v-model="graph" />
      <template v-else>
        <label class="science-label"
          >{{ t(kind === 'math' ? 'LaTeX denklemi' : 'Kimyasal ifade')
          }}<textarea
            v-model="source"
            class="text-input science-source"
            maxlength="4000"
            rows="3"
            spellcheck="false"
          />
        </label>
        <p class="science-help">
          {{
            t(
              kind === 'math'
                ? 'LaTeX yazın; örneğin kesir, kök, integral veya matris. Dolar işaretlerini eklemeyin.'
                : 'mhchem sözdizimi kullanın; örneğin H2O, C=C veya A -> B. İfade otomatik olarak ce içine alınır.',
            )
          }}
        </p>
        <div class="science-examples">
          <button
            v-for="example in examples"
            :key="example"
            class="button"
            @click="source = example"
          >
            {{ example }}
          </button>
        </div>
      </template>
      <div
        class="science-preview"
        :aria-label="t('Bilimsel içerik önizlemesi')"
        :aria-busy="rendering"
      >
        <span v-if="kind === 'molecule'" class="science-preview-label">{{
          t('Belgedeki görünüm')
        }}</span>
        <span v-if="rendering" role="status">{{ t('Önizleme hazırlanıyor…') }}</span>
        <img
          v-else-if="rendered"
          :src="rendered.src"
          :style="{ width: rendered.width + 'px' }"
          :alt="alt || (kind === 'molecule' ? t('Molekül çizimi') : source)"
        />
      </div>
      <label class="science-label"
        >{{ t('Erişilebilir açıklama')
        }}<input
          v-model="alt"
          class="text-input"
          maxlength="500"
          :placeholder="t('İsteğe bağlı açıklama')"
      /></label>
      <p class="science-help">
        {{
          t(
            'Düzenlemek için belgedeki öğeye çift tıklayın. Word ve PDF çıktılarında görsel olarak korunur.',
          )
        }}
      </p>
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
    </div>
    <template #footer
      ><button class="button" @click="emit('close')">{{ t('İptal') }}</button
      ><button
        class="button primary"
        :disabled="!rendered || rendering || busy || !engine.editable"
        @click="save"
      >
        {{ t(target ? 'Güncelle' : 'Ekle') }}
      </button></template
    >
  </AppDialog>
</template>
<style>
.science-dialog-body {
  padding: 20px;
  min-width: 0;
}
.science-tabs,
.molecule-tools,
.science-examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.science-tabs [aria-pressed='true'],
.molecule-tools [aria-pressed='true'] {
  background: #ede6ff;
  border-color: #8964cb;
  color: #4d298b;
}
.science-label {
  display: grid;
  gap: 7px;
  font-weight: 600;
  font-size: 13px;
}
.science-source {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  font-family: monospace;
}
.science-help {
  color: #657185;
  font-size: 12px;
  line-height: 1.6;
}
.science-preview {
  min-height: 90px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: auto;
  background: white;
  border: 1px solid #dfe4ee;
  border-radius: 10px;
  padding: 15px;
  margin: 16px 0;
}
.science-preview img {
  max-width: 100%;
  max-height: 150px;
  object-fit: contain;
  height: auto;
}
.science-examples .button {
  font-family: monospace;
  font-size: 11px;
  overflow-wrap: anywhere;
  white-space: normal;
}
.science-molecule .science-preview {
  height: 84px;
  min-height: 84px;
  box-sizing: border-box;
  padding: 8px 14px;
  justify-content: space-between;
  margin: 12px 0;
}
.science-molecule .science-preview img {
  max-height: 66px;
  max-width: 65%;
}
.science-preview-label {
  font-size: 11px;
  color: #758499;
}
@media (max-width: 480px) {
  .science-dialog-body {
    padding: 12px;
  }
  .science-tabs .button {
    flex: 1 1 auto;
  }
}
</style>
