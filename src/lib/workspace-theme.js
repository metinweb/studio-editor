import { ref, watch } from 'vue'
import { normalizeTheme } from './theme.js'

function initialTheme() {
  if (typeof window === 'undefined') return 'auto'
  try {
    const stored = localStorage.getItem('studio-theme')
    return stored ? normalizeTheme(stored) : 'auto'
  } catch {
    return 'auto'
  }
}

/** Standalone workspace preference: light, dark or auto (system). */
export const workspaceTheme = ref(initialTheme())
watch(workspaceTheme, (theme) => {
  try {
    localStorage.setItem('studio-theme', normalizeTheme(theme))
  } catch {
    /* Storage can be disabled. */
  }
})
