import { openDB } from 'idb'

let connection
const clone = (value) => JSON.parse(JSON.stringify(value))
// Retain the original name to preserve existing installations.
export const database = () => (connection ??= connect())
async function connect() {
  const db = await openDB('tinymce-studio', 2, {
    upgrade(db, oldVersion, newVersion, transaction) {
      for (const name of ['documents', 'media', 'templates', 'versions', 'settings'])
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      const versions = transaction.objectStore('versions')
      if (!versions.indexNames.contains('documentId'))
        versions.createIndex('documentId', 'documentId')
    },
    blocking() {
      db.close()
      connection = null
    },
  })
  if (!(await db.get('settings', 'templates-migrated'))) {
    const legacy = await openDB('studio-content-tools', 1, {
      upgrade(old) {
        old.createObjectStore('templates', { keyPath: 'id' })
      },
    })
    const items = await legacy.getAll('templates')
    legacy.close()
    const tx = db.transaction(['templates', 'settings'], 'readwrite')
    for (const item of items)
      if (!(await tx.objectStore('templates').get(item.id)))
        await tx.objectStore('templates').put(item)
    await tx.objectStore('settings').put({ id: 'templates-migrated', value: true })
    await tx.done
  }
  return db
}

export const archiveStores = ['documents', 'media', 'templates', 'versions']
export const repository = {
  async all(store) {
    return (await database()).getAll(store)
  },
  async put(store, value) {
    return (await database()).put(store, clone(value))
  },
  async remove(store, id) {
    return (await database()).delete(store, id)
  },
  async snapshot() {
    const tx = (await database()).transaction(archiveStores, 'readonly')
    const entries = await Promise.all(
      archiveStores.map(async (name) => [name, await tx.objectStore(name).getAll()]),
    )
    await tx.done
    return Object.fromEntries(entries)
  },
  async importArchive(data) {
    const tx = (await database()).transaction(archiveStores, 'readwrite')
    try {
      for (const name of archiveStores)
        for (const item of data[name]) await tx.objectStore(name).add(clone(item))
      await tx.done
    } catch (error) {
      try {
        tx.abort()
      } catch {}
      await tx.done.catch(() => {})
      throw error
    }
  },
  async saveDocument(document, force = false, reason = 'Otomatik kayıt') {
    const value = clone(document)
    const tx = (await database()).transaction(['documents', 'versions'], 'readwrite')
    const store = tx.objectStore('versions')
    const versions = (await store.index('documentId').getAll(value.id)).sort(
      (a, b) => b.createdAt - a.createdAt,
    )
    const latest = versions[0]
    if (
      !latest ||
      ((force || Date.now() - latest.createdAt >= 30000) &&
        (latest.content !== value.content || latest.title !== value.title))
    ) {
      const version = {
        id: crypto.randomUUID(),
        documentId: value.id,
        title: value.title,
        locale: value.locale,
        content: value.content,
        blockIds: value.blockIds || [],
        createdAt: Date.now(),
        reason,
      }
      await store.put(version)
      versions.unshift(version)
    }
    let bytes = 0
    for (let i = 0; i < versions.length; i++) {
      bytes += versions[i].content.length * 2
      if (i > 0 && (i >= 30 || bytes > 20 * 1024 * 1024)) await store.delete(versions[i].id)
    }
    await tx.objectStore('documents').put(value)
    await tx.done
  },
  async removeDocument(id) {
    const tx = (await database()).transaction(['documents', 'versions'], 'readwrite')
    for (const v of await tx.objectStore('versions').getAll())
      if (v.documentId === id) await tx.objectStore('versions').delete(v.id)
    await tx.objectStore('documents').delete(id)
    await tx.done
  },
}
