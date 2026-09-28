<script setup>
import { ref, shallowRef, onBeforeUnmount } from 'vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import {
  captureAssistance,
  replaceAssistance,
  validateAssistanceResult,
} from '../lib/assistance.js'
const props = defineProps({ engine: Object, adapter: Object, kind: String })
const emit = defineEmits(['close'])
const { locale } = useEditorLocale()
const c = (en, tr) => (locale.value === 'tr' ? tr : en)
const snapshot = shallowRef(null),
  error = ref(''),
  busy = ref(false),
  result = ref(null)
const instruction = ref(''),
  action = ref('rewrite'),
  language = ref(locale.value)
let controller,
  generation = 0,
  timeout
try {
  snapshot.value = captureAssistance(props.engine)
} catch (failure) {
  error.value = failure.message
}
function cancel() {
  generation++
  controller?.abort()
  clearTimeout(timeout)
  busy.value = false
}
onBeforeUnmount(cancel)
async function run() {
  cancel()
  const epoch = generation
  error.value = ''
  result.value = null
  busy.value = true
  controller = new AbortController()
  timeout = setTimeout(() => {
    cancel()
    error.value = c(
      'The service timed out. Try again.',
      'Servis zaman aşımına uğradı. Yeniden deneyin.',
    )
  }, 120000)
  try {
    const input = {
      text: snapshot.value.text,
      language: language.value,
      ...(props.kind === 'ai' ? { action: action.value, instruction: instruction.value } : {}),
    }
    const method = props.kind === 'ai' ? props.adapter?.generate : props.adapter?.check
    if (!method)
      throw new Error(
        c(
          'Connect an assistance adapter in your CMS first.',
          'Önce CMS içinde bir yardım servisi adaptörü bağlayın.',
        ),
      )
    const response = await method.call(props.adapter, input, { signal: controller.signal })
    if (epoch !== generation) return
    result.value = validateAssistanceResult(response, props.kind, input.text)
  } catch (failure) {
    if (epoch === generation) error.value = failure.message || 'Service error.'
  } finally {
    if (epoch === generation) {
      busy.value = false
      clearTimeout(timeout)
    }
  }
}
function apply(text, issue = null) {
  if (!replaceAssistance(props.engine, snapshot.value, text, issue)) {
    error.value = c(
      'The document changed. Close this window and select the text again.',
      'Belge değişti. Pencereyi kapatıp metni yeniden seçin.',
    )
    return
  }
  emit('close')
}
</script>
<template>
  <AppDialog
    :title="
      kind === 'ai'
        ? c('AI writing assistant', 'AI yazım yardımcısı')
        : c('Spelling and grammar', 'Yazım ve dil bilgisi')
    "
    wide
    @close="emit('close')"
  >
    <div class="native-form assistance-form">
      <p class="muted">
        {{
          c(
            'Only the selected text is sent when you press Run. Review the result before applying it.',
            'Yalnızca Çalıştır düğmesine bastığınızda seçili metin gönderilir. Uygulamadan önce sonucu inceleyin.',
          )
        }}
      </p>
      <p v-if="adapter?.label">
        <strong>{{ c('Service', 'Servis') }}:</strong> {{ adapter.label }}
      </p>
      <p v-if="!adapter" role="status">
        {{
          c(
            'Your CMS must supply an assistanceAdapter. No service is connected in this standalone demo.',
            'CMS uygulamanız assistanceAdapter sağlamalıdır. Bu bağımsız demoda bağlı bir servis yoktur.',
          )
        }}
      </p>
      <details v-if="snapshot">
        <summary>
          {{ c('Selected text to send', 'Gönderilecek seçili metin') }} ({{ snapshot.text.length }})
        </summary>
        <pre class="assistance-text">{{ snapshot.text }}</pre>
      </details>
      <div v-if="snapshot" class="assistance-options">
        <label v-if="kind === 'ai'"
          >{{ c('Action', 'İşlem')
          }}<select v-model="action" class="text-input">
            <option value="rewrite">{{ c('Rewrite', 'Yeniden yaz') }}</option>
            <option value="summarize">{{ c('Summarize', 'Özetle') }}</option>
            <option value="translate">{{ c('Translate', 'Çevir') }}</option>
            <option value="shorten">{{ c('Shorten', 'Kısalt') }}</option>
            <option value="expand">{{ c('Expand', 'Genişlet') }}</option>
          </select></label
        >
        <label
          >{{ c('Language', 'Dil') }}<input class="text-input" v-model="language" maxlength="40"
        /></label>
      </div>
      <label v-if="kind === 'ai'"
        >{{ c('Additional instructions', 'Ek talimatlar')
        }}<textarea class="text-input" rows="2" v-model="instruction" maxlength="2000"></textarea>
      </label>
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
      <p v-if="busy" role="status">
        {{ c('Waiting for your service…', 'Servis yanıtı bekleniyor…') }}
      </p>
      <template v-if="result">
        <h3>{{ c('Review result', 'Sonucu inceleyin') }}</h3>
        <textarea
          v-if="kind === 'ai'"
          class="text-input"
          rows="8"
          v-model="result.text"
          :aria-label="c('AI result', 'AI sonucu')"
          maxlength="100000"
        ></textarea>
        <template v-else>
          <p v-if="!result.issues.length">
            {{ c('No issues reported by the service.', 'Servis bir sorun bildirmedi.') }}
          </p>
          <div v-for="(issue, index) in result.issues" :key="index" class="assistance-issue">
            <strong>{{ snapshot.text.slice(issue.offset, issue.offset + issue.length) }}</strong>
            <p>{{ issue.message }}</p>
            <button
              v-for="replacement in issue.replacements"
              :key="replacement"
              class="button"
              type="button"
              @click="apply(replacement, issue)"
            >
              {{ replacement || c('Remove', 'Kaldır') }}
            </button>
          </div>
          <p class="muted">
            {{
              c(
                'Apply one correction, then recheck the updated selection.',
                'Bir düzeltmeyi uygulayıp güncel seçimi yeniden denetleyin.',
              )
            }}
          </p>
        </template>
      </template>
    </div>
    <template #footer>
      <button class="button" type="button" @click="busy ? cancel() : emit('close')">
        {{ c('Cancel', 'İptal') }}
      </button>
      <button
        class="button"
        type="button"
        :disabled="busy || !snapshot || !(kind === 'ai' ? adapter?.generate : adapter?.check)"
        @click="run"
      >
        {{ c('Run', 'Çalıştır') }}
      </button>
      <button
        v-if="kind === 'ai' && result"
        class="button primary"
        type="button"
        :disabled="busy || !result.text.trim()"
        @click="apply(result.text)"
      >
        {{ c('Replace selection', 'Seçimi değiştir') }}
      </button>
    </template>
  </AppDialog>
</template>
<style>
.assistance-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.assistance-options label {
  flex: 1;
  min-width: 140px;
}
.assistance-text {
  white-space: pre-wrap;
  max-height: 180px;
  overflow: auto;
  overflow-wrap: anywhere;
}
.assistance-issue {
  padding: 12px 0;
  border-bottom: 1px solid #e2e8f0;
}
.assistance-issue .button {
  margin: 3px;
}
</style>
