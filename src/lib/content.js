import createDOMPurify from 'dompurify'
import documentCss from './document.css?inline'
import { readMediaEmbed, mediaEmbedHtml } from './media-embed.js'
import { normalizeWritingWidgets } from '../editor/writing-widgets.js'

export { documentCss }

let purifier
function getPurifier() {
  if (purifier) return purifier
  if (typeof window === 'undefined')
    throw new Error('HTML işlemleri bir tarayıcı ortamı gerektirir.')
  purifier = createDOMPurify(window)
  purifier.addHook('uponSanitizeAttribute', (node, data) => {
    const value = data.attrValue.replace(/[\u0000-\u0020]+/g, '')
    if (
      data.attrName === 'href' &&
      /^data:/i.test(value) &&
      !/^data:application\/pdf;base64,/i.test(value)
    )
      data.keepAttr = false
  })
  return purifier
}

export const cleanHtml = (html) => {
  const sanitized = getPurifier().sanitize(html, {
    ADD_TAGS: ['video', 'audio', 'source'],
    ADD_ATTR: ['controls', 'poster'],
    ADD_DATA_URI_TAGS: ['a'],
    FORBID_TAGS: [
      'iframe',
      'object',
      'embed',
      'form',
      'input',
      'button',
      'style',
      'link',
      'meta',
      'base',
      'textarea',
      'select',
    ],
    FORBID_ATTR: ['contenteditable', 'autofocus', 'srcdoc'],
  })
  if (!/data-studio-(embed|task|checked|mention|style)/.test(sanitized)) return sanitized
  const template = window.document.createElement('template')
  template.innerHTML = sanitized
  for (const node of template.content.querySelectorAll('figure[data-studio-embed]')) {
    const media = readMediaEmbed(node)
    if (media) node.outerHTML = mediaEmbedHtml(media.url, media, true)
    else
      for (const attr of [...node.attributes])
        if (attr.name.startsWith('data-studio-embed')) node.removeAttribute(attr.name)
  }
  normalizeWritingWidgets(template.content)
  return template.innerHTML
}

export function plainText(html) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('br').forEach((element) => element.replaceWith('\n'))
  document
    .querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,pre')
    .forEach((element) => element.append('\n'))
  return (document.body.textContent || '').replace(/\s+/gu, ' ').trim()
}

export function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  )
}

export function renderDocument(document) {
  return `<!doctype html>\n<html lang="tr">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(document.title)}</title><style>${documentCss}</style></head>\n<body>\n${publicHtml(document.content)}\n</body></html>`
}

// Review conversations belong to the workspace, not the published document.
export function publicHtml(html) {
  const doc = new DOMParser().parseFromString(cleanHtml(html), 'text/html')
  doc
    .querySelectorAll('[data-studio-thread],[data-studio-resolved],[data-studio-suggestion]')
    .forEach((node) => {
      node.removeAttribute('data-studio-thread')
      node.removeAttribute('data-studio-resolved')
      node.removeAttribute('data-studio-suggestion')
    })
  doc
    .querySelectorAll('figure[data-studio-embed]')
    .forEach((node) => node.removeAttribute('contenteditable'))
  doc.querySelectorAll('[data-studio-task-control]').forEach((node) => {
    node.setAttribute('tabindex', '-1')
    node.setAttribute('aria-readonly', 'true')
  })
  return doc.body.innerHTML
}

export function downloadHtml(document) {
  const url = URL.createObjectURL(
    new Blob([renderDocument(document)], { type: 'text/html;charset=utf-8' }),
  )
  const link = Object.assign(window.document.createElement('a'), {
    href: url,
    download: `${document.title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'belge'}.html`,
  })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const welcomeContent = `<p style="color: #8870c7; font-size: 12px; letter-spacing: 2px;"><strong>STUDIO'YA HOŞ GELDİNİZ</strong></p>
<h1>İyi fikirler, boş bir<br>sayfayla başlar.</h1>
<p>Bir hikâye, bir rehber ya da aklınızdaki bir sonraki büyük fikir. Burası, kelimelerinize yer açan çalışma alanınız.</p>
<hr>
<h2>Yazmaya odaklanın.</h2>
<p>Metninizi biçimlendirin, görsellerle zenginleştirin ve her ayrıntıyı kendi tarzınıza göre düzenleyin. Geri kalanını Studio halleder.</p>
<blockquote><p>“Yaratıcılık, fikirleri bir araya getirmektir.”</p></blockquote>
<h2>Her şey elinizin altında</h2>
<ul><li><strong>Görsel editör:</strong> Düşüncelerinizi kolayca sayfaya taşıyın.</li><li><strong>Medya kütüphanesi:</strong> Görsel, video ve ses dosyalarınızı tek yerde toplayın.</li><li><strong>Kaynak kodu:</strong> HTML’i renklendirilmiş kod editöründe düzenleyin.</li></ul>
<p>Hazırsanız, bu sayfayı kendi hikâyenizle değiştirebilirsiniz.</p>`
