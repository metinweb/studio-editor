export const tagLimit = 10
export const tagLength = 32
export const searchKey = (value, locale = 'tr') =>
  String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase(locale)
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
  const collators = new Map()
  return (
    documents,
    { query = '', favorite = false, tag = '', sort = 'recent', locale = 'tr' } = {},
  ) => {
    if (!collators.has(locale))
      collators.set(locale, new Intl.Collator(locale, { numeric: true, sensitivity: 'base' }))
    const collator = collators.get(locale)
    const terms = searchKey(query, locale).split(/\s+/u).filter(Boolean)
    return documents
      .filter((document) => {
        if (favorite && !document.favorite) return false
        const tags = normalizeTags(document.tags)
        if (tag && !tags.some((value) => searchKey(value) === searchKey(tag))) return false
        if (!terms.length) return true
        const metadata = searchKey(`${document.title}\n${tags.join(' ')}`, locale)
        if (terms.every((term) => metadata.includes(term))) return true
        let entry = cache.get(document)
        if (!entry || entry.html !== document.content || entry.locale !== locale) {
          entry = {
            html: document.content,
            locale,
            text: searchKey(extractText(document.content || ''), locale),
          }
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
