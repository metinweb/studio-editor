import { cleanHtml, escapeHtml } from '../lib/content'
import { safeMediaUrl } from '../lib/media-url'
import { clipboardSource, clipboardFragment, parseTsv } from './clipboard-text.js'
import { tableGrid } from './table-grid.js'
import { allowedCellStyle } from './table-paste-style.js'
import { inlineClipboardStyles, listMarker } from './clipboard-styles.js'
import { readMediaEmbed } from '../lib/media-embed.js'
import { validMention, contentStyles } from './writing-widgets.js'

const styles = new Set([
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
  'vertical-align',
  'width',
  'height',
  'border',
  'border-width',
  'border-style',
  'border-color',
  'padding',
  'line-height',
  'list-style-type',
  'direction',
])
const unwrap = (node) => node.replaceWith(...node.childNodes)

function wordLists(parent, doc, metadata, formats) {
  let stack = [],
    group = null
  for (const node of [...parent.childNodes]) {
    if (node.nodeType !== 1) {
      if (node.nodeType === 3 && node.textContent.trim()) stack = []
      continue
    }
    const list = /mso-list\s*:\s*(l\d+)\s+level(\d+)\s+(lfo\d+)/i.exec(
      metadata?.get(node) || node.getAttribute('style') || '',
    )
    if (!list || !['P', 'DIV'].includes(node.tagName)) {
      stack = []
      wordLists(node, doc, metadata, formats)
      continue
    }
    const ignored = [...node.querySelectorAll('[style]')].filter((el) =>
      /mso-list\s*:\s*ignore/i.test(metadata?.get(el) || el.getAttribute('style')),
    )
    const marker = ignored
      .map((el) => el.textContent)
      .join('')
      .trim()
    const number = listMarker(marker, formats?.get(`${list[1]}:${list[2]}`))
    const tag = number ? 'ol' : 'ul'
    const key = `${list[1]}:${list[3]}`
    if (group !== key) stack = []
    group = key
    const level = Math.max(1, Math.min(9, Number(list[2]), stack.length + 1))
    stack.length = Math.min(stack.length, level)
    if (stack[level - 1]?.tagName.toLowerCase() !== tag) stack.length = level - 1
    if (!stack[level - 1]) {
      const container = doc.createElement(tag)
      if (level > 1 && stack[level - 2]?.lastElementChild)
        stack[level - 2].lastElementChild.append(container)
      else node.before(container)
      if (number) {
        container.style.listStyleType = number.type
        if (number.value !== 1) container.setAttribute('start', String(number.value))
      }
      stack[level - 1] = container
    }
    ignored.forEach((el) => el.remove())
    const item = doc.createElement('li')
    if (number) item.setAttribute('value', String(number.value))
    if (node.hasAttribute('style')) item.setAttribute('style', node.getAttribute('style'))
    item.append(...node.childNodes)
    stack[level - 1].append(item)
    node.remove()
  }
}

export function preparePaste(
  { html = '', text = '' },
  { mode = 'keep', tablePasteStyle = 'target', pre = false, doc = document } = {},
) {
  if (html.length + text.length > 5 * 1024 * 1024)
    throw new Error('Pano içeriği çok büyük; HTML içe aktarmayı kullanın.')
  const source = clipboardSource(html, text)
  const result = {
    source,
    mode: pre ? 'text' : mode,
    tableStyle:
      !pre && mode === 'keep' && html && tablePasteStyle === 'source' ? 'source' : 'target',
    warnings: [],
    rows: 0,
    columns: 0,
    html: '',
    plain: false,
    placeholders: 0,
  }
  if (pre || mode === 'text' || !html) {
    if (!text && html) {
      const container = doc.createElement('template')
      container.innerHTML = cleanHtml(clipboardFragment(html))
      container.content.querySelectorAll('br').forEach((node) => node.replaceWith('\n'))
      container.content
        .querySelectorAll('p,div,h1,h2,h3,h4,li,tr')
        .forEach((node) => node.append('\n'))
      text = container.content.textContent.replace(/\n$/, '')
    }
    const rows = !pre && mode !== 'text' ? parseTsv(text) : null
    if (rows) {
      result.source = source === 'text' ? 'tsv' : source
      result.rows = rows.length
      result.columns = rows[0].length
      result.html =
        '<table><tbody>' +
        rows
          .map(
            (row) =>
              '<tr>' +
              row
                .map(
                  (cell) => `<td>${escapeHtml(cell).replace(/\r\n|\r|\n/g, '<br>') || '<br>'}</td>`,
                )
                .join('') +
              '</tr>',
          )
          .join('') +
        '</tbody></table><p><br></p>'
    } else if (pre || !/[\r\n]/.test(text)) {
      result.html = text
      result.plain = true
    } else
      result.html = text
        .split(/\r\n|\r|\n/)
        .map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`)
        .join('')
    return result
  }
  // Template contents are inert; Office metadata is inspected before sanitization.
  const container = doc.createElement('template')
  container.innerHTML = clipboardFragment(html)
  const root = container.content
  const metadata = mode === 'keep' ? inlineClipboardStyles(root, html, doc) : null
  const formats = new Map()
  for (const match of html.matchAll(/@list\s+(l\d+):level(\d+)\s*\{([^}]{0,2000})\}/gi)) {
    const format = /mso-level-number-format\s*:\s*([\w-]+)/i.exec(match[3])?.[1]
    if (format) formats.set(`${match[1]}:${match[2]}`, format)
  }
  root
    .querySelectorAll('script,style,meta,link,object,iframe,embed')
    .forEach((node) => node.remove())
  wordLists(root, doc, metadata, formats)
  root.querySelectorAll('[data-studio-task-control]').forEach((node) => node.remove())
  const embeds = new Set(
    [...root.querySelectorAll('figure[data-studio-embed]')].filter(readMediaEmbed),
  )
  for (const node of [...root.querySelectorAll('*')]) {
    // Only canonical provider widgets keep their metadata; cleanHtml rebuilds them.
    if (embeds.has(node.closest('figure[data-studio-embed]'))) continue
    if (node.tagName.includes(':')) {
      unwrap(node)
      continue
    }
    // Google Docs can wrap block elements in a clipboard-only <b>.
    if (
      node.matches('b[id^="docs-internal-guid-"]') &&
      node.querySelector('p,h1,h2,h3,ul,ol,table')
    ) {
      unwrap(node)
      continue
    }
    for (const attr of [...node.attributes]) {
      if (
        (attr.name === 'data-studio-task-list' && node.tagName === 'UL' && attr.value === 'true') ||
        (attr.name === 'data-studio-checked' &&
          node.tagName === 'LI' &&
          ['true', 'false'].includes(attr.value)) ||
        (['data-studio-mention', 'data-studio-mention-label'].includes(attr.name) &&
          node.tagName === 'SPAN' &&
          validMention(node.dataset.studioMention, node.dataset.studioMentionLabel)) ||
        (attr.name === 'data-studio-style' &&
          mode === 'keep' &&
          contentStyles.some((s) => s.id && s.id === attr.value))
      )
        continue
      if (
        attr.name === 'class' ||
        attr.name === 'id' ||
        attr.name.startsWith('data-') ||
        attr.name.startsWith('xmlns') ||
        attr.name.includes(':')
      )
        node.removeAttribute(attr.name)
    }
    if (mode === 'clean') {
      for (const attr of ['style', 'color', 'face', 'size', 'bgcolor', 'align'])
        node.removeAttribute(attr)
    } else if (node.hasAttribute('style')) {
      for (const key of Array.from(node.style)) {
        if (
          (!styles.has(key) && !allowedCellStyle(key)) ||
          /url\s*\(|expression\s*\(|javascript:/i.test(node.style.getPropertyValue(key))
        )
          node.style.removeProperty(key)
      }
      if (!node.style.length) node.removeAttribute('style')
    }
    if (node.tagName === 'IMG' && !safeMediaUrl(node.getAttribute('src') || '')) {
      node.removeAttribute('src')
      node.removeAttribute('srcset')
      node.setAttribute('data-studio-paste-image', String(result.placeholders++))
    }
    if (
      (mode === 'clean' &&
        node.matches('b,strong,i,em,u,s,strike,font,span') &&
        !node.hasAttribute('data-studio-mention')) ||
      (node.tagName === 'SPAN' && !node.attributes.length)
    )
      unwrap(node)
  }
  result.html = cleanHtml(container.innerHTML)
  if (root.querySelectorAll('td,th').length > 10000)
    throw new Error('Tablo çok büyük; en fazla 10.000 hücre yapıştırılabilir.')
  const table = root.querySelector('table')
  if (table) {
    const model = tableGrid(table)
    result.rows = model?.height ?? table.rows.length
    result.columns = model?.width ?? Math.max(0, ...[...table.rows].map((row) => row.cells.length))
  }
  return result
}

export function finishPaste(prepared, media = [], doc = document) {
  if (!media.length && !prepared.placeholders) return prepared
  const container = doc.createElement('template')
  container.innerHTML = prepared.plain ? escapeHtml(prepared.html) : prepared.html
  const remaining = [...media]
  const warnings = [...prepared.warnings]
  const canMap =
    media.filter((item) => item.type.startsWith('image/')).length === prepared.placeholders
  for (const placeholder of container.content.querySelectorAll('[data-studio-paste-image]')) {
    const index = canMap ? remaining.findIndex((item) => item.type.startsWith('image/')) : -1
    if (index >= 0) {
      const [item] = remaining.splice(index, 1)
      placeholder.setAttribute('src', item.url || item.dataUrl)
      placeholder.removeAttribute('data-studio-paste-image')
    } else {
      placeholder.replaceWith(
        placeholder.alt ? doc.createTextNode(placeholder.alt) : doc.createTextNode(''),
      )
      warnings.push(
        media.length
          ? 'Görselin konumu eşleştirilemedi; dosyalar sona eklendi.'
          : 'Panodaki yerel görsel aktarılamadı; görseli dosya olarak ekleyin.',
      )
    }
  }
  return { ...prepared, html: container.innerHTML, plain: false, warnings, remaining }
}
