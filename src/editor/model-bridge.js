import { blockId } from './identity.js'
import { validateModel } from './document-model.js'
import { readMediaEmbed, mediaEmbedHtml } from '../lib/media-embed.js'
import { readPageEmbed, pageEmbedHtml } from '../lib/page-embed.js'
import { readUiElement, uiElementHtml } from '../lib/ui-elements.js'
export function modelFromDOM(root, revision) {
  function node(value) {
    if (value.nodeType === 3) return { type: 'text', text: value.data }
    const ui = readUiElement(value)
    if (ui) {
      const template = root.ownerDocument.createElement('template')
      template.innerHTML = uiElementHtml(ui)
      value = template.content.firstElementChild
    }
    const media = readMediaEmbed(value)
    const page = readPageEmbed(value)
    if (page) {
      const template = root.ownerDocument.createElement('template')
      template.innerHTML = pageEmbedHtml(page.url, page)
      value = template.content.firstElementChild
    }
    if (media) {
      // Players are derived views. JSON documents contain the portable link widget.
      const template = root.ownerDocument.createElement('template')
      template.innerHTML = mediaEmbedHtml(media.url, media)
      value = template.content.firstElementChild
    }
    return {
      type: 'element',
      tag: value.tagName.toLowerCase(),
      attrs: Object.fromEntries(
        [...value.attributes]
          .filter(
            (a) =>
              !(
                a.name === 'contenteditable' &&
                value.matches(
                  '[data-studio-mention],[data-studio-field],[data-studio-condition],[data-studio-formula],[data-studio-footnote-ref]',
                )
              ),
          )
          .map((a) => [a.name, a.value]),
      ),
      children: [...value.childNodes]
        .filter(
          (n) =>
            (n.nodeType === 1 || n.nodeType === 3) && !n.hasAttribute?.('data-studio-task-control'),
        )
        .map(node),
    }
  }
  return validateModel({
    schemaVersion: 2,
    revision,
    blocks: [...root.childNodes]
      .filter((n) => n.nodeType === 1 || n.nodeType === 3)
      .map((n) => ({ id: blockId(n), node: node(n) })),
  })
}
