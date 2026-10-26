<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Search, ArrowDown, ArrowUp, X } from '@lucide/vue'
import { useEditorLocale } from '../../lib/editor-locale'

const props = defineProps({ engine: Object, locked: Boolean })
const emit = defineEmits(['close'])
const { t, locale } = useEditorLocale()
const searchInput = ref(null)
const query = ref('')
const replacement = ref('')
const caseSensitive = ref(false)
const wholeWord = ref(false)
const ignoreAccents = ref(false)
const matchPreviews = ref([])
const replaceNotice = ref('')
const searchResults = ref({ index: -1, count: 0 })
const searchOptions = () => ({ wholeWord: wholeWord.value, ignoreAccents: ignoreAccents.value })

function changeSearchQuery() {
  replaceNotice.value = ''
  refresh()
}
function refresh() {
  const matches = props.engine?.matches(query.value, caseSensitive.value, searchOptions()) || []
  searchResults.value = { index: -1, count: matches.length }
  matchPreviews.value = matches.slice(0, 100).map((range) => {
    const block = range.startContainer.parentElement.closest('p,h1,h2,h3,h4,h5,h6,li,td,th,pre,div')
    const prefix = range.cloneRange()
    prefix.selectNodeContents(block || range.startContainer.parentElement)
    prefix.setEnd(range.startContainer, range.startOffset)
    const before = prefix.toString()
    const text = (block || range.startContainer.parentElement).textContent
    return {
      before: before.slice(-45),
      match: range.toString(),
      after: text.slice(
        before.length + range.toString().length,
        before.length + range.toString().length + 65,
      ),
    }
  })
  const win = props.engine?.doc.defaultView
  if (win?.CSS?.highlights && win.Highlight) {
    win.CSS.highlights.delete('studio-search')
    if (matches.length)
      win.CSS.highlights.set('studio-search', new win.Highlight(...matches.slice(0, 1000)))
  }
}
function find(direction = 1, index = null) {
  searchResults.value = props.engine.find(
    query.value,
    index ??
      (searchResults.value.index < 0 && direction < 0 ? -1 : searchResults.value.index + direction),
    caseSensitive.value,
    searchOptions(),
  )
}
function replaceFound(all = false) {
  if (props.locked) return
  const count = props.engine.replaceMatches(
    query.value,
    replacement.value,
    all,
    caseSensitive.value,
    searchOptions(),
  )
  refresh()
  replaceNotice.value = t('{count} eşleşme değiştirildi.', { count })
}
const focus = () => searchInput.value?.focus()
watch(locale, refresh)
onMounted(() => {
  refresh()
  nextTick(focus)
})
onBeforeUnmount(() => props.engine?.doc.defaultView.CSS?.highlights?.delete('studio-search'))
defineExpose({ refresh, focus })
</script>

<template>
  <div class="native-find" role="search" :aria-label="t('Belgede bul ve değiştir')">
    <div>
      <label class="search-box"
        ><Search :size="15" /><input
          ref="searchInput"
          v-model="query"
          maxlength="2000"
          :aria-label="t('Aranacak metin')"
          :placeholder="t('Belgede ara…')"
          @input="changeSearchQuery"
          @keydown.enter.prevent="find($event.shiftKey ? -1 : 1)"
          @keydown.escape.prevent="emit('close')" /></label
      ><span class="find-count">{{
        searchResults.count
          ? `${Math.max(0, searchResults.index + 1)} / ${searchResults.count}`
          : t('Sonuç yok')
      }}</span
      ><button
        class="icon-button"
        :aria-label="t('Önceki eşleşme')"
        :disabled="!searchResults.count"
        @click="find(-1)"
      >
        <ArrowUp :size="16" /></button
      ><button
        class="icon-button"
        :aria-label="t('Sonraki eşleşme')"
        :disabled="!searchResults.count"
        @click="find(1)"
      >
        <ArrowDown :size="16" /></button
      ><label class="case-check"
        ><input v-model="caseSensitive" type="checkbox" @change="refresh" />
        {{ t('Büyük/küçük harf') }}</label
      ><button class="icon-button" :aria-label="t('Aramayı kapat')" @click="emit('close')">
        <X :size="16" />
      </button>
    </div>
    <div class="search-options">
      <label class="case-check"
        ><input v-model="wholeWord" type="checkbox" @change="refresh" />{{ t('Tam sözcük') }}</label
      >
      <label class="case-check"
        ><input v-model="ignoreAccents" type="checkbox" @change="refresh" />{{
          t('Aksanları yok say')
        }}</label
      >
      <span>{{ t('Korumalı alanlar aramaya dahil edilmez.') }}</span>
    </div>
    <div v-if="!locked">
      <input
        v-model="replacement"
        class="text-input"
        :aria-label="t('Yerine yazılacak metin')"
        :placeholder="t('Yerine yazılacak metin…')"
      /><button class="button" :disabled="searchResults.index < 0" @click="replaceFound()">
        {{ t('Değiştir') }}</button
      ><button class="button" :disabled="!searchResults.count" @click="replaceFound(true)">
        {{ t('Tümünü değiştir') }}
      </button>
    </div>
    <p v-if="replaceNotice" class="search-feedback" role="status">{{ replaceNotice }}</p>
    <p v-if="searchResults.count >= 10000" class="search-feedback" role="status">
      {{ t('İlk 10.000 eşleşme gösteriliyor. Aramayı daraltın.') }}
    </p>
    <details v-if="matchPreviews.length" class="search-previews">
      <summary>
        {{ t('Eşleşme önizlemeleri') }} ({{ matchPreviews.length }} / {{ searchResults.count }})
      </summary>
      <div class="search-preview-list">
        <button
          v-for="(item, index) in matchPreviews"
          :key="index"
          :aria-current="searchResults.index === index ? 'location' : undefined"
          @click="find(0, index)"
        >
          <small>{{ index + 1 }}</small
          ><span
            >{{ item.before }}<mark>{{ item.match }}</mark
            >{{ item.after }}</span
          >
        </button>
      </div>
    </details>
  </div>
</template>
