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
const issueFilter = ref('all')
const reviewQuery = ref('')
const issueKeys = new WeakMap()
let keySequence = 0
function issueKey(issue) {
  if (!issueKeys.has(issue.node)) issueKeys.set(issue.node, ++keySequence)
  return `${issueKeys.get(issue.node)}-${issue.type}`
}
const matchesQuery = (value) =>
  value.toLocaleLowerCase(locale.value).includes(reviewQuery.value.toLocaleLowerCase(locale.value))
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
  threads.value.filter(
    (t) =>
      (showResolved.value || !t.resolved) &&
      matchesQuery(t.quote + ' ' + t.messages.map((m) => m.text).join(' ')),
  ),
)
const visibleSuggestions = computed(() =>
  suggestions.value.filter((item) =>
    matchesQuery(item.before + ' ' + item.after + ' ' + item.author),
  ),
)
const issues = computed(() => {
  props.state
  return props.engine?.accessibilityIssues() || []
})
const category = (type) =>
  ({
    alt: 'images',
    link: 'links',
    anchor: 'links',
    header: 'tables',
    caption: 'tables',
    heading: 'headings',
    'empty-heading': 'headings',
  })[type]
const visibleIssues = computed(() =>
  issues.value.filter(
    (issue) => issueFilter.value === 'all' || category(issue.type) === issueFilter.value,
  ),
)
function exportReport() {
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    locale: locale.value,
    scope: t(
      'Bu rapor otomatik içerik kontrollerini, yorumları ve önerileri içerir; tam erişilebilirlik sertifikası değildir.',
    ),
    issues: issues.value.map((issue) => ({
      type: issue.type,
      title: t(issue.title),
      help: t(issue.help),
      excerpt: (issue.node.textContent || issue.node.getAttribute('src') || '').slice(0, 300),
    })),
    comments: threads.value,
    suggestions: suggestions.value,
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'studio-review-report.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
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
  error.value = props.engine.fixIssue(issue, fixes.value[issueKey(issue)] || '')
    ? ''
    : t('Belge değişti. Denetim sonuçlarını yeniden inceleyin.')
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
    <div class="review-utilities">
      <button class="button" @click="exportReport">{{ t('İnceleme raporunu indir') }}</button>
      <input
        v-if="tab !== 'check'"
        class="text-input"
        v-model="reviewQuery"
        :aria-label="t('Yorum ve önerilerde ara')"
        :placeholder="t('Yorum ve önerilerde ara')"
      />
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
          reviewQuery
            ? t('Sonuç yok')
            : threads.length
              ? t('Açık yorum kalmadı')
              : t('İlk notu siz ekleyin')
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
      <article v-for="item in visibleSuggestions" :key="item.id" class="comment-card">
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
            issues.length
              ? t('{count} öneri', { count: issues.length })
              : t('Kontrol edilen alanlar temiz')
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
      <label class="review-issue-filter"
        >{{ t('Denetim kategorisi')
        }}<select v-model="issueFilter" class="text-input" :aria-label="t('Denetim kategorisi')">
          <option value="all">{{ t('Tüm kontroller') }}</option>
          <option value="images">{{ t('Görseller') }}</option>
          <option value="links">{{ t('Bağlantılar') }}</option>
          <option value="tables">{{ t('Tablolar') }}</option>
          <option value="headings">{{ t('Başlıklar') }}</option>
        </select></label
      >
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="issues.length && !visibleIssues.length" role="status">
        {{ t('Bu kategoride öneri yok.') }}
      </p>
      <article v-for="(issue, index) in visibleIssues" :key="issueKey(issue)" class="check-card">
        <span class="check-number">{{ index + 1 }}</span>
        <h4>{{ t(issue.title) }}</h4>
        <p>{{ t(issue.help) }}</p>
        <button class="review-text-button" @click="engine.focusIssue(issue)">
          {{ t('Belgede göster') }} <ArrowUpRight :size="13" />
        </button>
        <form
          v-if="
            engine.editable && ['alt', 'link', 'header', 'caption', 'heading'].includes(issue.type)
          "
          @submit.prevent="fix(issue, index)"
        >
          <input
            v-if="!['header', 'heading'].includes(issue.type)"
            v-model="fixes[issueKey(issue)]"
            maxlength="2000"
            :required="issue.type !== 'alt'"
            :aria-label="
              issue.type === 'alt'
                ? t('Görsel açıklaması')
                : issue.type === 'caption'
                  ? t('Tablo açıklaması')
                  : t('Bağlantı metni')
            "
            :placeholder="
              issue.type === 'alt'
                ? t('Açıklama (dekoratifse boş)')
                : issue.type === 'caption'
                  ? t('Tablo açıklaması')
                  : t('Bağlantının amacı')
            "
          />
          <button class="button" type="submit">
            <Check :size="13" />{{
              issue.type === 'header'
                ? t('İlk satırı başlık yap')
                : issue.type === 'heading'
                  ? t('H{level} düzeyine getir', { level: issue.level })
                  : t('Düzeltmeyi uygula')
            }}
          </button>
        </form>
      </article>
    </div>
  </aside>
</template>
