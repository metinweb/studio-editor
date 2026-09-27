import { marked } from 'marked'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { cleanHtml } from './content'

export function importMarkdown(source) {
  if (source.length > 200000) throw new Error('Markdown metni en fazla 200.000 karakter olabilir.')
  const doc = document.implementation.createHTMLDocument('')
  doc.body.innerHTML = marked.parse(source.replace(/^\uFEFF/, ''), { gfm: true, async: false })
  for (const input of doc.body.querySelectorAll('li > input[type="checkbox"]')) {
    const item = input.parentElement
    item.parentElement.dataset.studioTaskList = 'true'
    item.dataset.studioChecked = String(input.checked)
    input.remove()
  }
  return cleanHtml(doc.body.innerHTML)
}
export function exportMarkdown(html) {
  const doc = document.implementation.createHTMLDocument('')
  doc.body.innerHTML = cleanHtml(html)
  for (const control of doc.body.querySelectorAll('[data-studio-task-control]')) control.remove()
  for (const item of doc.body.querySelectorAll('li[data-studio-checked]')) {
    const input = doc.createElement('input')
    input.type = 'checkbox'
    input.checked = item.dataset.studioChecked === 'true'
    item.prepend(input)
  }
  // Preserve features that Markdown cannot represent as sanitized HTML islands.
  const islands =
    'table:has(caption),table:has([colspan]),table:has([rowspan]),[data-studio-footnotes],[data-studio-footnote-ref],[data-studio-field],[data-studio-condition],table:has([data-studio-formula]),figure,img[data-studio-science]'
  const converter = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
  })
  converter.use(gfm)
  converter.addRule('studioWidgets', {
    filter: (node) =>
      node.matches?.(islands) ||
      (node.nodeName === 'TABLE' &&
        (!node.rows.length ||
          !!node.querySelector('table') ||
          [...node.querySelectorAll('th,td')].some(
            (cell) => cell.textContent.includes('|') || cell.querySelector('br'),
          ))),
    replacement: (_content, node) =>
      node.matches('span,sup,img') ? node.outerHTML : `\n\n${node.outerHTML}\n\n`,
  })
  return converter.turndown(doc.body)
}
