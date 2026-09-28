const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
export function pageEmbedOptions(value, options = {}) {
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password
  )
    return null
  return {
    url: url.href,
    title: String(options.title || url.hostname).slice(0, 200),
    height: Math.min(1200, Math.max(200, Number(options.height) || 480)),
  }
}
export function readPageEmbed(node) {
  return node?.matches?.('figure[data-studio-page]')
    ? pageEmbedOptions(node.dataset.studioPage, {
        title: node.dataset.studioPageTitle,
        height: node.dataset.studioPageHeight,
      })
    : null
}
export function pageEmbedHtml(value, options = {}, player = false) {
  const page = pageEmbedOptions(value, options)
  if (!page) return ''
  return `<figure data-studio-page="${escape(page.url)}" data-studio-page-title="${escape(page.title)}" data-studio-page-height="${page.height}"${player ? ' contenteditable="false"' : ''}>${player ? `<iframe src="${escape(page.url)}" title="${escape(page.title)}" sandbox="" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:${page.height}px;border:1px solid #cbd5e1" tabindex="-1"></iframe>` : ''}<figcaption><a href="${escape(page.url)}" target="_blank" rel="noopener noreferrer">${escape(page.title)}</a></figcaption></figure>`
}
