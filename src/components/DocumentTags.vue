<script setup>
import { useEditorLocale } from '../lib/editor-locale'
const { t, locale } = useEditorLocale()
import { computed, ref } from 'vue'
import { Plus, X } from '@lucide/vue'
import AppDialog from './AppDialog.vue'
import { normalizeTags, searchKey, tagLength, tagLimit } from '../lib/document-library'

const props = defineProps({ document: { type: Object, required: true } })
const emit = defineEmits(['close', 'update'])
const draft = ref('')
const message = ref('')
const input = ref(null)
const tags = computed(() => normalizeTags(props.document.tags))
function add() {
  const value = draft.value.normalize('NFC').trim().replace(/\s+/gu, ' ')
  if (!value) return
  if (value.length > tagLength) {
    message.value = t('Etiket en fazla {count} karakter olabilir.', { count: tagLength })
    return
  }
  if (tags.value.some((tag) => searchKey(tag) === searchKey(value))) {
    message.value = 'Bu etiket zaten ekli.'
    return
  }
  if (tags.value.length >= tagLimit) {
    message.value = t('Bir belgeye en fazla {count} etiket ekleyebilirsiniz.', { count: tagLimit })
    return
  }
  emit('update', { tags: [...tags.value, value] })
  draft.value = ''
  message.value = 'Etiket eklendi.'
  input.value?.focus()
}
function remove(tag) {
  emit('update', { tags: tags.value.filter((value) => value !== tag) })
  message.value = 'Etiket kaldırıldı.'
  input.value?.focus()
}
</script>

<template>
  <AppDialog :title="t('Belge etiketleri')" @close="emit('close')">
    <div class="document-tags-panel">
      <p>
        {{
          t('“{title}” için etiket ekleyin. Etiketler otomatik kaydedilir.', {
            title: document.title || t('Başlıksız belge'),
          })
        }}
      </p>
      <form class="tag-form" @submit.prevent="add">
        <label for="document-tag-input">{{ t('Yeni etiket') }}</label>
        <div>
          <input
            id="document-tag-input"
            ref="input"
            v-model="draft"
            :placeholder="t('Örn. Proje, toplantı, kişisel')"
            autocomplete="off"
            :maxlength="tagLength"
          />
          <button class="button primary" type="submit" :disabled="!draft.trim()">
            <Plus :size="16" /> {{ t('Ekle') }}
          </button>
        </div>
      </form>
      <div class="document-tag-list" :aria-label="t('Belge etiketleri')">
        <span v-for="tag in tags" :key="tag" class="document-tag">
          {{ tag
          }}<button
            type="button"
            :aria-label="t('{tag} etiketini kaldır', { tag })"
            @click="remove(tag)"
          >
            <X :size="14" />
          </button>
        </span>
        <p v-if="!tags.length" class="muted">{{ t('Henüz etiket eklenmedi.') }}</p>
      </div>
      <p class="muted">
        {{ tags.length }} / {{ tagLimit }} {{ t('etiket · Etiket başına') }} {{ tagLength }}
        {{ t('karakter') }}
      </p>
      <p class="tag-message" role="status">{{ t(message) }}</p>
    </div>
    <template #footer
      ><button class="button primary" @click="emit('close')">{{ t('Tamam') }}</button></template
    >
  </AppDialog>
</template>
