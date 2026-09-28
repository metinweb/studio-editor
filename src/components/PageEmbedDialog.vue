<script setup>
import { ref, computed } from 'vue'
import AppDialog from './AppDialog.vue'
import { useEditorLocale } from '../lib/editor-locale'
import { pageEmbedOptions, pageEmbedHtml, readPageEmbed } from '../lib/page-embed.js'
const props = defineProps({ engine: Object, target: Object })
const emit = defineEmits(['close'])
const { locale } = useEditorLocale()
const c = (en, tr) => (locale.value === 'tr' ? tr : en)
const initial = readPageEmbed(props.target)
const url = ref(initial?.url || ''),
  title = ref(initial?.title || ''),
  height = ref(initial?.height || 480),
  error = ref('')
const valid = computed(() =>
  pageEmbedOptions(url.value, { title: title.value, height: height.value }),
)
function apply(remove = false) {
  if (!props.engine.editable || props.engine.features?.pageEmbed === false) return
  if (props.target && !props.engine.root.contains(props.target)) {
    error.value = c(
      'The embed was removed. Reopen this window.',
      'Gömülü sayfa kaldırıldı. Pencereyi yeniden açın.',
    )
    return
  }
  if (!remove && !valid.value) return
  if (props.target)
    props.engine.transaction(() => {
      props.target.outerHTML = remove
        ? '<p><br></p>'
        : pageEmbedHtml(valid.value.url, valid.value, true)
    }, 'pageEmbed')
  else props.engine.insert(pageEmbedHtml(valid.value.url, valid.value) + '<p><br></p>')
  emit('close')
}
</script>
<template>
  <AppDialog :title="c('Embed web page', 'Web sayfası göm')" @close="emit('close')">
    <div class="native-form">
      <label
        >{{ c('Page URL', 'Sayfa adresi')
        }}<input
          class="text-input"
          type="url"
          v-model="url"
          placeholder="https://example.com/article"
      /></label>
      <label
        >{{ c('Accessible title', 'Erişilebilir başlık')
        }}<input class="text-input" v-model="title" maxlength="200"
      /></label>
      <label
        >{{ c('Height (px)', 'Yükseklik (px)')
        }}<input class="text-input" type="number" min="200" max="1200" v-model="height"
      /></label>
      <p class="muted">
        {{
          c(
            'HTTPS pages appear in a sandbox with scripts and forms disabled. Some sites block embedding; the link remains available. Click the caption to edit.',
            'HTTPS sayfalar, script ve formların kapalı olduğu bir alanda gösterilir. Bazı siteler gömülmeyi engeller; bağlantı kullanılabilir kalır. Düzenlemek için açıklamaya tıklayın.',
          )
        }}
      </p>
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
    </div>
    <template #footer
      ><button v-if="target" class="button" type="button" @click="apply(true)">
        {{ c('Remove', 'Kaldır') }}</button
      ><button class="button primary" type="button" :disabled="!valid" @click="apply()">
        {{ c('Apply', 'Uygula') }}
      </button></template
    >
  </AppDialog>
</template>
