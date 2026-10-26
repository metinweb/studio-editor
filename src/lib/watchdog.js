import { ref } from 'vue'

/**
 * Restart policy for an editor instance. Each crash bumps `generation` (used as a component key)
 * until more than `limit` crashes happen within `period` ms; then the editor stays stopped
 * until `restart()` is called explicitly, so a deterministic failure cannot loop forever.
 */
export function createEditorWatchdog({ limit = 3, period = 60000, now = () => Date.now() } = {}) {
  const generation = ref(0)
  const status = ref('running')
  const lastError = ref(null)
  let crashes = []
  function crash(error) {
    const time = now()
    crashes = crashes.filter((at) => time - at < period)
    crashes.push(time)
    lastError.value = error
    if (crashes.length > limit) {
      status.value = 'failed'
      return false
    }
    status.value = 'recovered'
    generation.value++
    return true
  }
  function restart() {
    crashes = []
    lastError.value = null
    status.value = 'running'
    generation.value++
  }
  function dismiss() {
    if (status.value === 'recovered') status.value = 'running'
  }
  return { generation, status, lastError, crash, restart, dismiss }
}

/** Last readable editor HTML, falling back to the last value the editor reported. */
export function recoverableHtml(read, fallback = '') {
  try {
    const html = read()
    if (typeof html === 'string' && html) return html
  } catch {}
  return fallback || ''
}
