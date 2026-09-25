import { computed, inject, provide } from 'vue'
import { translateMessage } from './locales.js'

const localeKey = Symbol('studio-editor-locale')
const fallback = { locale: { value: 'tr' }, t: (key) => key }
export function provideEditorLocale(props) {
  const locale = computed(() => (props.locale === 'en' ? 'en' : 'tr'))
  const context = { locale, t: (key) => translateMessage(locale.value, props.messages, key) }
  provide(localeKey, context)
  return context
}
export function useEditorLocale() {
  return inject(localeKey, fallback)
}
