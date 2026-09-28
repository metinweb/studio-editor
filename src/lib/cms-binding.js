import { createAutosaveSession } from './autosave.js'

/** Call after editor ready. The host owns the adapter and the editor lifecycle. */
export async function bindDocumentSession(
  editor,
  { adapter, id, delay, onChange, warnOnUnload = true, signal },
) {
  const session = createAutosaveSession(adapter, { delay, onChange })
  const revision = editor.getDocument()?.revision
  let applying = false,
    disposed = false,
    unsubscribe = () => {}
  function apply(record) {
    applying = true
    try {
      editor.setHTML(record.html)
    } finally {
      applying = false
    }
  }
  function unload(event) {
    if (!session.state.dirty) return
    event.preventDefault()
    event.returnValue = ''
  }
  function dispose() {
    disposed = true
    unsubscribe()
    session.dispose()
    signal?.removeEventListener('abort', dispose)
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', unload)
  }
  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    signal?.addEventListener('abort', dispose, { once: true })
    await session.load(id)
    if (disposed) throw new DOMException('Aborted', 'AbortError')
    if (editor.getDocument()?.revision !== revision)
      throw new Error('The editor changed while loading. Local edits are preserved.')
    apply(session.state.record)
    unsubscribe = editor.subscribeTransactions(() => {
      if (applying || disposed) return
      const document = editor.getDocument()
      if (document) session.update({ html: document.html, blockIds: document.blockIds })
    })
    if (warnOnUnload && typeof window !== 'undefined')
      window.addEventListener('beforeunload', unload)
  } catch (error) {
    dispose()
    throw error
  }
  return {
    session,
    dispose,
  }
}
