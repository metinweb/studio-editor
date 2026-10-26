import { computed, ref, watch } from 'vue'

// Restricted editing and track changes. A host prop enforces a mode; otherwise the
// standalone workspace can switch it from the menus. Both lock structural tools.
const restrictedDialogs = ['commands', 'help', 'metrics', 'preview', 'print', 'symbols', 'link']
const trackDialogs = [
  'commands',
  'help',
  'metrics',
  'preview',
  'print',
  'symbols',
  'ai',
  'language',
  'cmsHistory',
  'markdownExport',
]

export function useEditingModes({
  props,
  t,
  locked,
  engine,
  popup,
  dialog,
  reviewTab,
  contextMenu,
}) {
  const restrictedPreview = ref(false)
  const restrictedMode = computed(() => props.restricted || restrictedPreview.value)
  const trackLocal = ref(false)
  const trackMode = computed(() => props.trackChanges || trackLocal.value)
  const structureLocked = computed(() => restrictedMode.value || trackMode.value)
  const currentUser = computed(() => ({
    id: String(props.user?.id || 'local').slice(0, 100),
    name: String(props.user?.name || t('Ben')).slice(0, 100),
  }))
  function toggleRestricted() {
    if (props.restricted || locked.value) return
    restrictedPreview.value = !restrictedPreview.value
  }
  function toggleTrackChanges(value = !trackLocal.value) {
    if (props.trackChanges || locked.value) return
    trackLocal.value = !!value
  }
  /** Whether a dialog may open in the current mode. */
  function dialogAllowed(name) {
    if (restrictedMode.value && !restrictedDialogs.includes(name)) return false
    return !trackMode.value || trackDialogs.includes(name)
  }
  /** Whether a toolbar group is shown in the current mode. */
  function groupAllowed(group) {
    if (restrictedMode.value && !['history', 'format'].includes(group)) return false
    return !trackMode.value || ['history', 'review', 'tools'].includes(group)
  }
  function closeTools() {
    popup.value = null
    if (dialog.value && !dialogAllowed(dialog.value)) dialog.value = null
    contextMenu.value?.close()
  }
  watch(restrictedMode, (value) => {
    engine.value?.setRestricted(value)
    reviewTab.value = null
    closeTools()
  })
  watch(trackMode, (value) => {
    engine.value?.setTrackChanges(value)
    closeTools()
  })
  watch(currentUser, (value) => {
    if (engine.value) engine.value.user = value
  })
  /** Applies the current modes to a newly created engine. */
  function applyModes(instance) {
    instance.setRestricted(restrictedMode.value)
    instance.user = currentUser.value
    instance.setTrackChanges(trackMode.value)
  }
  return {
    restrictedMode,
    trackMode,
    structureLocked,
    toggleRestricted,
    toggleTrackChanges,
    dialogAllowed,
    groupAllowed,
    applyModes,
    focusEditableRegion: (backward) => engine.value?.focusEditableRegion(backward),
    resolveAllChanges: (accept) => {
      if (!locked.value) engine.value?.resolveAllChanges(accept)
    },
  }
}
