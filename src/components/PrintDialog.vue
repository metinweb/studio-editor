<script setup>
import { computed, ref } from 'vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import { renderPrintDocument, printDocument } from '../lib/print-document'
const { t } = useEditorLocale()
const props = defineProps({ html: String })
defineEmits(['close'])
const options = ref({ size: 'A4', landscape: false, margin: 20, header: '', footer: '' }),
  error = ref('')
const preview = computed(() => renderPrintDocument(props.html, options.value))
async function print() {
  try {
    await printDocument(props.html, options.value)
  } catch (e) {
    error.value = e.message
  }
}
async function docx() {
  try {
    const { downloadDocx } = await import('../lib/docx-export')
    await downloadDocx(props.html, options.value)
  } catch (e) {
    error.value = e.message
  }
}
</script>
<template>
  <AppDialog :title="t('Sayfa düzeni ve dışa aktarım')" wide @close="$emit('close')">
    <div class="studio-print-layout">
      <div class="studio-print-options">
        <label
          >{{ t('Kağıt')
          }}<select v-model="options.size">
            <option>A4</option>
            <option>Letter</option>
          </select></label
        >
        <label><input v-model="options.landscape" type="checkbox" />{{ t('Yatay sayfa') }}</label>
        <label
          >{{ t('Kenar boşluğu (mm)')
          }}<input v-model.number="options.margin" type="number" min="10" max="40"
        /></label>
        <label>{{ t('Üstbilgi') }}<input v-model="options.header" maxlength="200" /></label>
        <label>{{ t('Altbilgi') }}<input v-model="options.footer" maxlength="200" /></label>
        <p>{{ t('PDF için yazdırma penceresinde PDF olarak kaydet seçeneğini kullanın.') }}</p>
        <p v-if="error" role="alert">{{ error }}</p>
      </div>
      <iframe :title="t('Yazdırma önizlemesi')" sandbox="" :srcdoc="preview" />
    </div>
    <template #footer
      ><button class="button" @click="docx">{{ t('DOCX indir') }}</button
      ><button class="button primary" @click="print">{{ t('Yazdır / PDF') }}</button></template
    >
  </AppDialog>
</template>
<style scoped>
.studio-print-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 20px;
  padding: 24px;
}
.studio-print-options {
  display: grid;
  gap: 14px;
  align-content: start;
}
.studio-print-options label {
  display: grid;
  gap: 7px;
}
.studio-print-options input,
.studio-print-options select {
  padding: 8px;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  max-width: 100%;
}
.studio-print-options input[type='checkbox'] {
  justify-self: start;
}
.studio-print-options p {
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}
iframe {
  width: 100%;
  height: 460px;
  border: 1px solid #e2e8f0;
  background: white;
}
@media (max-width: 650px) {
  .studio-print-layout {
    grid-template-columns: 1fr;
  }
  iframe {
    height: 300px;
  }
}
</style>
