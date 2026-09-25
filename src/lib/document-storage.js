// Optimistic concurrency: adapters must atomically reject a stale expectedVersion.
export function createDocumentSession(adapter, onChange = () => {}) {
  let record = null,
    dirty = false,
    pending = Promise.resolve(),
    epoch = 0,
    editRevision = 0,
    disposed = false
  const snapshot = () => (record ? structuredClone(record) : null)
  const notify = () => onChange({ record: snapshot(), dirty })
  return {
    get record() {
      return snapshot()
    },
    get dirty() {
      return dirty
    },
    async load(id) {
      if (dirty) throw new Error('Kaydedilmemiş değişiklikler var.')
      const request = ++epoch,
        revision = editRevision,
        result = await adapter.load(id)
      if (disposed || request !== epoch || revision !== editRevision) return false
      if (
        !result ||
        result.id !== id ||
        typeof result.version !== 'string' ||
        typeof result.html !== 'string'
      )
        throw new Error('Depolama adaptörü geçersiz belge döndürdü.')
      record = structuredClone(result)
      dirty = false
      notify()
      return true
    },
    update(changes) {
      if (disposed || !record) throw new Error('Belge yüklenmedi.')
      for (const key of ['title', 'html', 'blockIds'])
        if (Object.hasOwn(changes, key)) record[key] = structuredClone(changes[key])
      editRevision++
      dirty = true
      notify()
    },
    save() {
      const work = async () => {
        if (disposed || !record || !dirty) return snapshot()
        const before = snapshot(),
          request = epoch
        const saved = await adapter.save(before, { expectedVersion: before.version })
        if (disposed || request !== epoch) return null
        if (
          !saved ||
          saved.id !== before.id ||
          typeof saved.version !== 'string' ||
          typeof saved.html !== 'string' ||
          saved.version === before.version
        )
          throw new Error('Depolama adaptörü geçerli bir sürüm döndürmedi.')
        const unchanged = JSON.stringify(record) === JSON.stringify(before)
        record.version = saved.version
        if (unchanged) {
          record = structuredClone(saved)
          dirty = false
        }
        notify()
        return snapshot()
      }
      const result = pending.then(work, work)
      pending = result.catch(() => {})
      return result
    },
    dispose() {
      disposed = true
      epoch++
    },
  }
}
