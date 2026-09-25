// Provider URLs are parsed locally; arbitrary iframe markup is never accepted.
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
export function parseMediaEmbed(value) {
  if (typeof value !== 'string' || value.length > 2048) return null
  let url
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port)
    return null
  const host = url.hostname.toLowerCase()
  let id
  if (
    [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com',
    ].includes(host)
  ) {
    id =
      host === 'youtu.be'
        ? url.pathname.slice(1)
        : url.pathname === '/watch'
          ? url.searchParams.get('v')
          : /^\/(?:embed|shorts|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1]
    if (!/^[\w-]{11}$/.test(id || '')) return null
    const raw = url.searchParams.get('start') || url.searchParams.get('t') || ''
    const time = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw)
    const seconds = /^\d+$/.test(raw)
      ? Number(raw)
      : time
        ? Number(time[1] || 0) * 3600 + Number(time[2] || 0) * 60 + Number(time[3] || 0)
        : 0
    const start = Math.min(86400, Math.max(0, seconds))
    return {
      provider: 'YouTube',
      url: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}` : ''}`,
      src: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`,
    }
  }
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const match = (
      host === 'player.vimeo.com'
        ? /^\/video\/(\d{1,12})\/?$/
        : /^\/(\d{1,12})(?:\/([a-f0-9]{6,64}))?\/?$/i
    ).exec(url.pathname)
    if (!match) return null
    id = match[1]
    const hash = match[2] || url.searchParams.get('h') || ''
    if (hash && !/^[a-f0-9]{6,64}$/i.test(hash)) return null
    return {
      provider: 'Vimeo',
      url: `https://vimeo.com/${id}${hash ? `/${hash}` : ''}`,
      src: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}`,
    }
  }
  return null
}
export function mediaEmbedOptions(options = {}) {
  return {
    width: Math.min(100, Math.max(25, Number(options.width) || 100)),
    align: ['left', 'center', 'right'].includes(options.align) ? options.align : 'center',
    caption: String(options.caption || '').slice(0, 500),
  }
}
export function mediaEmbedHtml(url, options = {}, player = false) {
  const media = parseMediaEmbed(url)
  if (!media) return ''
  const { width, align, caption } = mediaEmbedOptions(options)
  const margin = align === 'left' ? '0 auto 0 0' : align === 'right' ? '0 0 0 auto' : '0 auto'
  const iframe = player
    ? `<iframe src="${escape(media.src)}" title="${escape(caption || media.provider)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen="" tabindex="-1"></iframe>`
    : ''
  return `<figure data-studio-embed="${escape(media.url)}" data-studio-embed-width="${width}" data-studio-embed-align="${align}" data-studio-embed-caption="${escape(caption)}" style="width:${width}%;max-width:100%;margin:${margin}"${player ? ' contenteditable="false"' : ''}>${iframe}<figcaption><a href="${escape(media.url)}" target="_blank" rel="noopener noreferrer">${escape(caption || `${media.provider} · ${media.url}`)}</a></figcaption></figure>`
}
export function readMediaEmbed(node) {
  if (!node?.matches?.('figure[data-studio-embed]')) return null
  const media = parseMediaEmbed(node.dataset.studioEmbed)
  return media
    ? {
        ...media,
        ...mediaEmbedOptions({
          width: node.dataset.studioEmbedWidth,
          align: node.dataset.studioEmbedAlign,
          caption: node.dataset.studioEmbedCaption,
        }),
      }
    : null
}
