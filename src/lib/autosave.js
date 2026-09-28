import { createDocumentSession } from './document-storage.js'

/** Opt-in debounced persistence. Errors suspend automatic writes until retry(). */
export function createAutosaveSession(adapter, { delay = 1500, onChange = () => {} } = {}) {
  if (!Number.isFinite(delay) || delay < 100 || delay > 60000)
    throw new TypeError('Autosave delay must be 100–60000 ms.')
  let timer,
    disposed = false,
    paused = false,
    blocked = false,
    status = 'idle',
    error = null,
    inFlight = null,
    loadEpoch = 0
  const session = createDocumentSession(adapter, () => notify())
  const snapshot = () => ({ record: session.record, dirty: session.dirty, status, error })
  const notify = () => {
    if (!disposed) onChange(snapshot())
  }
  function schedule() {
    clearTimeout(timer)
    if (!disposed && !paused && !blocked && session.dirty && !inFlight)
      timer = setTimeout(() => save().catch(() => {}), delay)
  }
  async function save() {
    clearTimeout(timer)
    if (disposed) throw new Error('This session has been disposed.')
    if (inFlight) return inFlight
    if (!session.dirty) return session.record
    status = 'saving'
    error = null
    notify()
    inFlight = session
      .save()
      .then(
        (saved) => {
          if (!disposed) {
            status = session.dirty ? 'dirty' : 'saved'
            blocked = false
            notify()
          }
          return saved
        },
        (failure) => {
          if (!disposed) {
            error = failure
            status = [409, 412].includes(failure.status) ? 'conflict' : 'error'
            blocked = true
            notify()
          }
          throw failure
        },
      )
      .finally(() => {
        inFlight = null
        schedule()
      })
    return inFlight
  }
  return {
    get state() {
      return snapshot()
    },
    async load(id) {
      if (disposed || inFlight || session.dirty)
        throw new Error('Save or finish the current operation before loading another document.')
      clearTimeout(timer)
      status = 'loading'
      error = null
      notify()
      const epoch = ++loadEpoch
      try {
        const loaded = await session.load(id)
        if (!disposed && epoch === loadEpoch) {
          status = session.dirty ? 'dirty' : 'saved'
          blocked = false
          notify()
          schedule()
        }
        return loaded
      } catch (failure) {
        if (!disposed && epoch === loadEpoch) {
          error = failure
          status = 'error'
          notify()
        }
        throw failure
      }
    },
    update(changes) {
      session.update(changes)
      if (!inFlight && !blocked) status = 'dirty'
      notify()
      schedule()
    },
    save,
    retry() {
      blocked = false
      return save()
    },
    pause() {
      paused = true
      clearTimeout(timer)
    },
    resume() {
      if (error) throw new Error('Resolve the save error and retry explicitly.')
      paused = false
      schedule()
    },
    async listVersions() {
      const id = session.record?.id
      const epoch = loadEpoch
      if (disposed || !id || !adapter.listVersions)
        throw new Error('Version history is not configured.')
      const values = await adapter.listVersions(id)
      if (disposed || epoch !== loadEpoch) throw new Error('The document changed.')
      if (
        !Array.isArray(values) ||
        values.length > 1000 ||
        values.some(
          (item) => !item || typeof item.version !== 'string' || typeof item.title !== 'string',
        )
      )
        throw new Error('Invalid version history response.')
      return structuredClone(values)
    },
    async loadVersion(version) {
      const id = session.record?.id
      const epoch = loadEpoch
      if (disposed || !id || !adapter.loadVersion)
        throw new Error('Version history is not configured.')
      const value = await adapter.loadVersion(id, version)
      if (disposed || epoch !== loadEpoch) throw new Error('The document changed.')
      if (value?.id !== id || value.version !== version || typeof value.html !== 'string')
        throw new Error('Invalid document version.')
      return structuredClone(value)
    },
    dispose() {
      disposed = true
      clearTimeout(timer)
      session.dispose()
    },
  }
}
