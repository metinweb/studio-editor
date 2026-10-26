import { inject } from 'vue'

/** Shared state and commands of one RichEditor instance, provided to its toolbar and panels. */
export const richEditorKey = Symbol('studio-rich-editor')
export function useRichEditor() {
  const context = inject(richEditorKey, null)
  if (!context) throw new Error('Rich editor parts must be rendered inside RichEditor.')
  return context
}
