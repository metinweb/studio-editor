import { computed, inject, onBeforeUnmount, provide, ref } from 'vue'

const themeKey = Symbol('studio-editor-theme')
export const editorThemes = ['light', 'dark', 'auto']
export const normalizeTheme = (value) => (editorThemes.includes(value) ? value : 'light')

/** Resolves 'auto' with prefers-color-scheme and follows system changes while mounted. */
export function useResolvedTheme(source) {
  const media =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null
  const prefersDark = ref(!!media?.matches)
  const changed = (event) => (prefersDark.value = event.matches)
  media?.addEventListener?.('change', changed)
  onBeforeUnmount(() => media?.removeEventListener?.('change', changed))
  return computed(() => {
    const theme = normalizeTheme(source())
    return theme === 'auto' ? (prefersDark.value ? 'dark' : 'light') : theme
  })
}
/** Teleported menus read the theme because they render outside the editor root. */
export function provideEditorTheme(resolved) {
  provide(themeKey, resolved)
}
export function useEditorTheme() {
  return inject(
    themeKey,
    computed(() => undefined),
  )
}
