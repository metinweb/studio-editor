import { ref, watch } from 'vue'
import { translateMessage } from './locales.js'

function initialLocale() {
  if (typeof window === 'undefined') return 'en'
  const requested = new URLSearchParams(window.location.search).get('lang')
  if (requested === 'en' || requested === 'tr') return requested
  try {
    return localStorage.getItem('studio-locale') === 'tr' ? 'tr' : 'en'
  } catch {
    return 'en'
  }
}

export const workspaceLocale = ref(initialLocale())
export const workspaceT = (key, values) =>
  translateMessage(workspaceLocale.value, null, key, values)

watch(
  workspaceLocale,
  (locale) => {
    if (typeof window === 'undefined') return
    document.documentElement.lang = locale
    document.title = workspaceT('Studio — İçerik çalışma alanı')
    try {
      localStorage.setItem('studio-locale', locale)
    } catch {
      /* Storage can be disabled. */
    }
    // A language link only sets the initial preference; subsequent choices own it.
    const url = new URL(window.location.href)
    if (url.searchParams.has('lang')) {
      url.searchParams.delete('lang')
      window.history.replaceState(null, '', url)
    }
  },
  { immediate: true },
)
