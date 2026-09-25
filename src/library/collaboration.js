export { createSharedDocument } from '../editor/shared-document.js'
import { IndexeddbPersistence } from 'y-indexeddb'
export { openSharedRoom, connectSharedRoom } from '../lib/shared-transport.js'
export function persistSharedDocument(name, shared) {
  return new IndexeddbPersistence(name, shared.doc)
}
export function bindSharedDocument(editor, shared, { onError = () => {} } = {}) {
  let applying = false,
    disposed = false
  const buffered = []
  function render(model) {
    if (disposed) return
    applying = true
    try {
      editor.setModel(model)
      editor.setSharedHistory(shared)
    } catch (error) {
      onError(error)
    } finally {
      applying = false
    }
  }
  render(shared.getModel())
  const stopShared = shared.subscribe((model) => {
    if (!applying) render(model)
  })
  const stopEditor = editor.subscribeTransactions(() => {
    if (applying || disposed) return
    applying = true
    try {
      shared.setModel(editor.getModel())
      editor.setSharedHistory(shared)
    } catch (error) {
      onError(error)
    } finally {
      applying = false
    }
    for (const bytes of buffered.splice(0)) {
      try {
        shared.applyUpdate(bytes)
      } catch (error) {
        onError(error)
      }
    }
  })
  return {
    receive(bytes) {
      if (disposed) return
      if (editor.isComposing()) buffered.push(new Uint8Array(bytes))
      else shared.applyUpdate(bytes)
    },
    dispose() {
      disposed = true
      buffered.length = 0
      stopShared()
      stopEditor()
      editor.setSharedHistory(null)
    },
  }
}
