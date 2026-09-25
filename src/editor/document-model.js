// JSON document operations do not require a browser, Vue, or an editor instance.
const tags = new Set(
  'p div h1 h2 h3 h4 h5 h6 blockquote pre ul ol li table thead tbody tfoot tr td th colgroup col hr figure figcaption img video audio source br strong b em i u s strike sub sup code span a font dl dt dd caption'.split(
    ' ',
  ),
)
const attributes =
  /^(?:id|title|class|style|dir|lang|href|target|rel|src|alt|width|height|colspan|rowspan|scope|start|value|type|controls|poster|preload|color|face|size|align|valign|bgcolor|download|aria-[\w-]+|data-studio-[\w-]+)$/
const voids = new Set(['img', 'br', 'hr', 'col', 'source'])
const escape = (text) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
const invalid = () => {
  throw new Error('Geçersiz belge modeli veya işlem.')
}
export function validateModel(model) {
  if (
    model?.schemaVersion !== 2 ||
    !Number.isSafeInteger(model.revision) ||
    model.revision < 0 ||
    !Array.isArray(model.blocks) ||
    model.blocks.length > 20000
  )
    invalid()
  const ids = new Set()
  let count = 0,
    bytes = 0
  function walk(node, depth = 0) {
    if (!node || depth > 64 || ++count > 200000) invalid()
    if (node.type === 'text') {
      if (typeof node.text !== 'string') invalid()
      bytes += node.text.length
      return
    }
    if (
      node.type !== 'element' ||
      !tags.has(node.tag) ||
      !node.attrs ||
      typeof node.attrs !== 'object' ||
      Array.isArray(node.attrs) ||
      !Array.isArray(node.children)
    )
      invalid()
    if (voids.has(node.tag) && node.children.length) invalid()
    for (const [name, value] of Object.entries(node.attrs)) {
      if (!attributes.test(name) || typeof value !== 'string') invalid()
      bytes += name.length + value.length
      if (
        ['href', 'src', 'poster'].includes(name) &&
        /^(?:javascript|vbscript):/i.test(value.replace(/[\u0000-\u0020]/g, ''))
      )
        invalid()
      if (
        ['href', 'src', 'poster'].includes(name) &&
        /^data:/i.test(value) &&
        !/^data:(?:image\/(?:png|jpeg|gif|webp|avif)|video\/(?:mp4|webm)|audio\/(?:mpeg|wav|ogg)|application\/pdf);base64,[a-z0-9+/=]*$/i.test(
          value,
        )
      )
        invalid()
      if (name === 'style' && /url\s*\(|expression\s*\(|javascript:|@import/i.test(value)) invalid()
    }
    for (const child of node.children) walk(child, depth + 1)
  }
  for (const block of model.blocks) {
    if (
      !block ||
      typeof block.id !== 'string' ||
      !block.id ||
      block.id.length > 120 ||
      ids.has(block.id)
    )
      invalid()
    ids.add(block.id)
    walk(block.node)
  }
  if (bytes > 30 * 1024 * 1024) invalid()
  return model
}
export function renderModel(model) {
  validateModel(model)
  function html(node) {
    if (node.type === 'text') return escape(node.text)
    const attrs = Object.entries(node.attrs)
      .map(([k, v]) => ` ${k}="${escape(v)}"`)
      .join('')
    return `<${node.tag}${attrs}>${voids.has(node.tag) ? '' : node.children.map(html).join('') + `</${node.tag}>`}`
  }
  return model.blocks.map((b) => html(b.node)).join('')
}
export function applyModelOperations(document, transaction) {
  validateModel(document)
  if (transaction?.baseRevision !== document.revision)
    throw new Error('Belge değişti; işlemi güncel sürümle yeniden hazırlayın.')
  if (
    !Array.isArray(transaction.operations) ||
    !transaction.operations.length ||
    transaction.operations.length > 1000
  )
    invalid()
  const next = structuredClone(document)
  for (const op of transaction.operations) {
    if (op.type === 'insertBlock') {
      if (!Number.isInteger(op.index) || op.index < 0 || op.index > next.blocks.length) invalid()
      next.blocks.splice(op.index, 0, structuredClone(op.block))
      continue
    }
    const index = next.blocks.findIndex((b) => b.id === op.blockId)
    if (index < 0) throw new Error('İşlemin hedef bloğu bulunamadı.')
    if (op.type === 'removeBlock') {
      next.blocks.splice(index, 1)
      continue
    }
    if (op.type === 'moveBlock') {
      if (!Number.isInteger(op.index) || op.index < 0 || op.index >= next.blocks.length) invalid()
      next.blocks.splice(op.index, 0, ...next.blocks.splice(index, 1))
      continue
    }
    let node = next.blocks[index].node
    if (!Array.isArray(op.path) || op.path.length > 64) invalid()
    for (const part of op.path) {
      if (!Number.isInteger(part) || part < 0 || !node.children?.[part]) invalid()
      node = node.children[part]
    }
    if (op.type === 'replaceText') {
      if (
        node.type !== 'text' ||
        !Number.isInteger(op.from) ||
        op.from < 0 ||
        typeof op.removed !== 'string' ||
        typeof op.inserted !== 'string' ||
        node.text.slice(op.from, op.from + op.removed.length) !== op.removed ||
        op.from > node.text.length
      )
        invalid()
      node.text =
        node.text.slice(0, op.from) + op.inserted + node.text.slice(op.from + op.removed.length)
    } else if (op.type === 'setAttributes') {
      if (node.type !== 'element') invalid()
      node.attrs = structuredClone(op.attrs)
    } else invalid()
  }
  next.revision++
  return validateModel(next)
}
