/** Resolve trusted host-provided CSS URLs without allowing executable/data schemes. */
export function normalizeContentCss(value, base) {
  const values = typeof value === 'string' ? value.split(/\r?\n/) : value || []
  if (!Array.isArray(values) || values.length > 10)
    throw new Error('En fazla 10 CSS dosyası ekleyebilirsiniz.')
  const result = []
  for (const raw of values) {
    if (typeof raw !== 'string') throw new Error('Geçerli bir HTTP veya HTTPS CSS adresi girin.')
    const text = raw.trim()
    if (!text) continue
    let url
    try {
      url = new URL(text, base)
    } catch {
      /* Report the same actionable validation error. */
    }
    if (
      !url ||
      text.length > 2048 ||
      /[\u0000-\u0020\u007f]/.test(text) ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error('Geçerli bir HTTP veya HTTPS CSS adresi girin.')
    if (!result.includes(url.href)) result.push(url.href)
  }
  return result
}

export function installContentCss(document, urls, report = () => {}) {
  const links = urls.map((url) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.dataset.studioContentCss = ''
    link.referrerPolicy = 'no-referrer'
    link.onload = () => report({ url, status: 'loaded' })
    link.onerror = () => report({ url, status: 'error' })
    report({ url, status: 'loading' })
    document.head.append(link)
    return link
  })
  return () => {
    for (const link of links) {
      link.onload = link.onerror = null
      link.remove()
    }
  }
}
