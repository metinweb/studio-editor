export const validField = (value) => /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(value || '')
export const validAnchor = (value) => /^[A-Za-z][A-Za-z0-9_.:-]{0,119}$/.test(value || '')

export function normalizeDocumentFields(root, prune = false) {
  for (const node of root.querySelectorAll('[data-studio-field]')) {
    const key = node.dataset.studioField
    if (!node.matches('span') || !validField(key)) {
      node.removeAttribute('data-studio-field')
      node.removeAttribute('contenteditable')
      continue
    }
    node.contentEditable = 'false'
    const text = `{{${key}}}`
    if (node.textContent !== text) node.textContent = text
  }
  const notes = new Map()
  for (const note of root.querySelectorAll('li[data-studio-footnote]')) {
    if (validAnchor(note.id) && !notes.has(note.id)) notes.set(note.id, note)
  }
  const used = new Map()
  for (const ref of root.querySelectorAll('sup[data-studio-footnote-ref]')) {
    const id = ref.dataset.studioFootnoteRef
    if (!notes.has(id)) continue
    if (!used.has(id)) used.set(id, { number: used.size + 1, count: 0 })
    const item = used.get(id)
    item.count++
    let link = ref.querySelector('a')
    if (!link) {
      link = root.ownerDocument.createElement('a')
      ref.append(link)
    }
    link.id = `${id}-ref-${item.count}`
    link.setAttribute('href', `#${id}`)
    if (link.textContent !== String(item.number)) link.textContent = String(item.number)
    ref.contentEditable = 'false'
    notes.get(id).value = item.number
    let back = notes.get(id).querySelector('[data-studio-footnote-back]')
    if (!back) {
      back = root.ownerDocument.createElement('a')
      back.dataset.studioFootnoteBack = 'true'
      back.textContent = ' ↩'
      notes.get(id).append(back)
    }
    back.setAttribute('href', `#${id}-ref-1`)
  }
  // Notes stay in document order even after moving a paragraph containing its reference.
  const groups = new Set([...notes.values()].map((note) => note.parentElement))
  for (const group of groups) {
    const wanted = [...used.keys()]
      .map((id) => notes.get(id))
      .filter((note) => note.parentElement === group)
    const current = [...group.children].filter((node) => node.hasAttribute('data-studio-footnote'))
    if (wanted.some((note, index) => current[index] !== note))
      wanted.forEach((note) => group.append(note))
  }
  if (prune) {
    for (const [id, note] of notes) if (!used.has(id)) note.remove()
    for (const section of root.querySelectorAll('[data-studio-footnotes]'))
      if (!section.querySelector('[data-studio-footnote]')) section.remove()
  }
}
