<script setup>
import { useEditorLocale } from '../lib/editor-locale'
const { t, locale } = useEditorLocale()
import { computed, ref } from 'vue'
import {
  MessageSquare,
  Check,
  X,
  ScanEye,
  CornerDownRight,
  ArrowUpRight,
  Trash2,
} from '@lucide/vue'
const props = defineProps({ engine: Object, state: Object, tab: String })
const emit = defineEmits(['close', 'tab'])
const draft = ref('')
const error = ref('')
const replies = ref({})
const fixes = ref({})
const showResolved = ref(false)
const proposed = ref('')
const suggestions = computed(() => {
  props.state
  return props.engine?.suggestions() || []
})
function suggest() {
  error.value = props.engine.suggestText(proposed.value, locale.value === 'en' ? 'Me' : 'Ben')
    ? ''
    : t('Tek paragrafta yorum veya öneri içermeyen bir metin seçin.')
  if (!error.value) proposed.value = ''
}
function resolveSuggestion(id, accept) {
  error.value = props.engine.resolveSuggestion(id, accept)
    ? ''
    : t('Önerilen bölüm değişti. Yeni metni inceleyip öneriyi yeniden oluşturun.')
}
const threads = computed(() => {
  props.state
  return props.engine?.threads() || []
})
const visibleThreads = computed(() =>
  threads.value.filter((t) => showResolved.value || !t.resolved),
)
const issues = computed(() => {
  props.state
  return props.engine?.accessibilityIssues() || []
})
function add() {
  if (!props.engine.addComment(draft.value)) {
    error.value =
      'Önce belgede yorum eklemek istediğiniz metni seçin. Yorumlu bir bölüme mevcut konuşmadan yanıt verebilirsiniz.'
    return
  }
  draft.value = ''
  error.value = ''
}
function reply(thread) {
  props.engine.updateComment(thread.id, 'reply', replies.value[thread.id])
  replies.value[thread.id] = ''
}
function fix(issue, index) {
  props.engine.fixIssue(issue, fixes.value[index] || '')
  fixes.value = {}
}
</script>
<template>
  <aside class="review-panel" :aria-label="t('Belge inceleme')">
    <header>
      <div>
        <span class="review-eyebrow"> {{ t('BELGE İNCELEME') }} </span>
        <h3>{{ tab === 'comments' ? t('Birlikte düşünün.') : t('Yayına hazırlayın.') }}</h3>
      </div>
      <button class="icon-button" :aria-label="t('İnceleme panelini kapat')" @click="emit('close')">
        <X :size="17" />
      </button>
    </header>
    <div class="review-tabs">
      <button :aria-pressed="tab === 'suggestions'" @click="emit('tab', 'suggestions')">
        {{ t('Öneriler') }} <b>{{ suggestions.length }}</b>
      </button>
      <button :aria-pressed="tab === 'comments'" @click="emit('tab', 'comments')">
        <MessageSquare :size="14" /> {{ t('Yorumlar') }}
        <b>{{ threads.filter((t) => !t.resolved).length }}</b></button
      ><button :aria-pressed="tab === 'check'" @click="emit('tab', 'check')">
        <ScanEye :size="15" /> {{ t('Denetim') }} <b>{{ issues.length }}</b>
      </button>
    </div>
    <div class="review-scroll" v-if="tab === 'comments'">
      <p class="review-note">{{ t('Bu belgedeki notlar tarayıcınıza kaydedilir.') }}</p>
      <form class="comment-compose" @submit.prevent="add">
        <label for="comment-draft"> {{ t('Seçili metne yorum ekleyin') }} </label>
        <blockquote v-if="state.selectedText">{{ state.selectedText }}</blockquote>
        <textarea
          id="comment-draft"
          v-model="draft"
          maxlength="4000"
          rows="3"
          :placeholder="t('Neyi geliştirebiliriz?')"
          required
          :aria-label="t('Yeni yorum')"
        />
        <button class="button primary" type="submit" :disabled="!draft.trim()">
          <MessageSquare :size="14" /> {{ t('Yorum ekle') }}
        </button>
        <p v-if="error" class="review-error" role="alert">{{ t(error) }}</p>
      </form>
      <label class="review-filter"
        ><input v-model="showResolved" type="checkbox" /> {{ t('Çözülenleri göster') }}
      </label>
      <div v-if="!visibleThreads.length" class="review-empty">
        <MessageSquare :size="28" /><strong>{{
          threads.length ? t('Açık yorum kalmadı') : t('İlk notu siz ekleyin')
        }}</strong>
        <p>
          {{
            t(
              'Belgede bir metin seçip yorum yazın. Notlarınızı yanıtlayabilir ve çözüldü olarak işaretleyebilirsiniz.',
            )
          }}
        </p>
      </div>
      <article
        v-for="thread in visibleThreads"
        :key="thread.id"
        class="comment-card"
        :class="{ resolved: thread.resolved }"
      >
        <button class="comment-quote" @click="engine.focusComment(thread.id)">
          <span>“{{ thread.quote.slice(0, 120) }}”</span><ArrowUpRight :size="14" />
        </button>
        <div v-for="(message, index) in thread.messages" :key="index" class="comment-message">
          <div class="comment-author">
            <span> {{ t('Ben') }} </span
            ><time>{{
              new Date(message.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
            }}</time>
          </div>
          <p>{{ message.text }}</p>
        </div>
        <div class="comment-actions">
          <button @click="engine.updateComment(thread.id, 'resolve')">
            <Check :size="14" />{{ thread.resolved ? t('Yeniden aç') : t('Çözüldü') }}</button
          ><button :aria-label="t('Yorumu sil')" @click="engine.updateComment(thread.id, 'delete')">
            <Trash2 :size="13" />
          </button>
        </div>
        <form v-if="!thread.resolved" class="comment-reply" @submit.prevent="reply(thread)">
          <input
            v-model="replies[thread.id]"
            maxlength="4000"
            :placeholder="t('Yanıt yazın…')"
            :aria-label="t('Yoruma yanıt')"
            required
          /><button
            type="submit"
            :aria-label="t('Yanıtı ekle')"
            :disabled="!replies[thread.id]?.trim()"
          >
            <CornerDownRight :size="16" />
          </button>
        </form>
      </article>
    </div>
    <div class="review-scroll" v-else-if="tab === 'suggestions'">
      <p class="review-note">
        {{ t('Seçili metin için bir değişiklik önerin. Kabul edilene kadar belge metni korunur.') }}
      </p>
      <form class="comment-compose" @submit.prevent="suggest">
        <label
          >{{ t('Önerilen metin')
          }}<textarea
            v-model="proposed"
            maxlength="4000"
            rows="3"
            :aria-label="t('Önerilen metin')"
          />
        </label>
        <button class="button primary" type="submit">{{ t('Değişiklik öner') }}</button>
        <p v-if="error" role="alert">{{ error }}</p>
      </form>
      <article v-for="item in suggestions" :key="item.id" class="comment-card">
        <div class="comment-author">
          {{ item.author }} · {{ new Date(item.date).toLocaleDateString(locale) }}
        </div>
        <p>
          <del>{{ item.before }}</del>
        </p>
        <p>
          <ins>{{ item.after || t('(Silme önerisi)') }}</ins>
        </p>
        <p v-if="item.stale" role="status">{{ t('Bu bölüm öneriden sonra değişti.') }}</p>
        <div class="comment-actions">
          <button @click="engine.focusSuggestion(item.id)">{{ t('Belgede göster') }}</button>
          <button :disabled="item.stale" @click="resolveSuggestion(item.id, true)">
            {{ t('Kabul et') }}
          </button>
          <button @click="resolveSuggestion(item.id, false)">{{ t('Reddet') }}</button>
        </div>
      </article>
    </div>
    <div class="review-scroll" v-else>
      <div class="check-summary">
        <ScanEye :size="24" />
        <div>
          <strong>{{
            issues.length ? `${issues.length} öneri` : t('Kontrol edilen alanlar temiz')
          }}</strong>
          <p>{{ t('Görsel açıklamaları, bağlantı adları, tablo başlıkları ve başlık sırası.') }}</p>
        </div>
      </div>
      <p class="review-note">
        {{
          t(
            'Bu temel denetim tüm erişilebilirlik ölçütlerini kapsamaz. Renk kontrastı ve klavye akışı ayrıca incelenmelidir.',
          )
        }}
      </p>
      <article v-for="(issue, index) in issues" :key="`${index}-${issue.type}`" class="check-card">
        <span class="check-number">{{ index + 1 }}</span>
        <h4>{{ t(issue.title) }}</h4>
        <p>{{ t(issue.help) }}</p>
        <button class="review-text-button" @click="engine.focusIssue(issue)">
          {{ t('Belgede göster') }} <ArrowUpRight :size="13" />
        </button>
        <form
          v-if="['alt', 'link', 'header'].includes(issue.type)"
          @submit.prevent="fix(issue, index)"
        >
          <input
            v-if="issue.type !== 'header'"
            v-model="fixes[index]"
            :required="issue.type === 'link'"
            :aria-label="issue.type === 'alt' ? t('Görsel açıklaması') : t('Bağlantı metni')"
            :placeholder="
              issue.type === 'alt' ? t('Açıklama (dekoratifse boş)') : t('Bağlantının amacı')
            "
          />
          <button class="button" type="submit">
            <Check :size="13" />{{
              issue.type === 'header' ? t('İlk satırı başlık yap') : t('Düzeltmeyi uygula')
            }}
          </button>
        </form>
      </article>
    </div>
  </aside>
</template>
