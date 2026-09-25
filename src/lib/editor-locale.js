import { computed, inject, provide } from 'vue'
import { translateMessage } from './locales.js'

const localeKey = Symbol('studio-editor-locale')
const fallback = {
  locale: { value: 'en' },
  t: (key, values) => translateMessage('en', null, key, values),
}
export function provideEditorLocale(props) {
  const locale = computed(() => (props.locale === 'tr' ? 'tr' : 'en'))
  const context = {
    locale,
    t: (key, values) => translateMessage(locale.value, props.messages, key, values),
  }
  provide(localeKey, context)
  return context
}
export function useEditorLocale() {
  return inject(localeKey, fallback)
}
