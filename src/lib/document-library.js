export const tagLimit = 10
export const tagLength = 32
export const searchKey = (value) =>
  String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase('tr')
    .trim()

export function normalizeTags(values) {
  const tags = []
  const seen = new Set()
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== 'string') continue
    const tag = value.normalize('NFC').trim().replace(/\s+/gu, ' ').slice(0, tagLength)
    const key = searchKey(tag)
    if (!key || seen.has(key)) continue
    tags.push(tag)
    seen.add(key)
    if (tags.length === tagLimit) break
  }
  return tags
}

// Parse HTML only when a searched document's content changes. Weak keys allow
// removed documents to be collected, including their cached text.
export function createDocumentFilter(extractText) {
  const cache = new WeakMap()
  const collator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' })
  return (documents, { query = '', favorite = false, tag = '', sort = 'recent' } = {}) => {
    const terms = searchKey(query).split(/\s+/u).filter(Boolean)
    return documents
      .filter((document) => {
        if (favorite && !document.favorite) return false
        const tags = normalizeTags(document.tags)
        if (tag && !tags.some((value) => searchKey(value) === searchKey(tag))) return false
        if (!terms.length) return true
        const metadata = searchKey(`${document.title}\n${tags.join(' ')}`)
        if (terms.every((term) => metadata.includes(term))) return true
        let entry = cache.get(document)
        if (!entry || entry.html !== document.content) {
          entry = { html: document.content, text: searchKey(extractText(document.content || '')) }
          cache.set(document, entry)
        }
        const text = `${metadata}\n${entry.text}`
        return terms.every((term) => text.includes(term))
      })
      .sort((a, b) => {
        if (sort === 'title' || sort === 'title-desc') {
          const order = collator.compare(a.title || 'Başlıksız belge', b.title || 'Başlıksız belge')
          if (order) return sort === 'title' ? order : -order
        } else {
          const order = (a.updatedAt || 0) - (b.updatedAt || 0)
          if (order) return sort === 'oldest' ? order : -order
        }
        return collator.compare(a.id, b.id)
      })
  }
}
