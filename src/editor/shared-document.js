import * as Y from 'yjs'
import { validateModel } from './document-model.js'
import { diffText } from './operations.js'

function createNode(node) {
  if (node.type === 'text') {
    const text = new Y.XmlText()
    text.insert(0, node.text)
    return text
  }
  const element = new Y.XmlElement(node.tag)
  for (const [name, value] of Object.entries(node.attrs)) element.setAttribute(name, value)
  element.insert(0, node.children.map(createNode))
  return element
}
function readNode(node) {
  if (node instanceof Y.XmlText) return { type: 'text', text: node.toString() }
  if (!(node instanceof Y.XmlElement)) throw new Error('Desteklenmeyen ortak belge düğümü.')
  return {
    type: 'element',
    tag: node.nodeName,
    attrs: node.getAttributes(),
    children: node.toArray().map(readNode),
  }
}
function sameKind(shared, node) {
  return node.type === 'text'
    ? shared instanceof Y.XmlText
    : shared instanceof Y.XmlElement && shared.nodeName === node.tag
}
function reconcileNode(shared, node) {
  if (node.type === 'text') {
    const step = diffText(shared.toString(), node.text)
    if (step.removed.length) shared.delete(step.from, step.removed.length)
    if (step.inserted) shared.insert(step.from, step.inserted)
    return
  }
  for (const name of Object.keys(shared.getAttributes()))
    if (!Object.hasOwn(node.attrs, name)) shared.removeAttribute(name)
  for (const [name, value] of Object.entries(node.attrs))
    if (shared.getAttribute(name) !== value) shared.setAttribute(name, value)
  for (let i = 0; i < node.children.length; i++) {
    const current = shared.get(i),
      next = node.children[i]
    if (current && sameKind(current, next)) reconcileNode(current, next)
    else {
      if (current) shared.delete(i, 1)
      shared.insert(i, [createNode(next)])
    }
  }
  if (shared.length > node.children.length)
    shared.delete(node.children.length, shared.length - node.children.length)
}
export function readSharedModel(doc, revision = 0) {
  const root = doc.getXmlFragment('studio')
  return validateModel({
    schemaVersion: 2,
    revision,
    blocks: root.toArray().map((block) => {
      if (
        !(block instanceof Y.XmlElement) ||
        block.nodeName !== 'studio-block' ||
        block.length !== 1
      )
        throw new Error('Geçersiz ortak belge bloğu.')
      return { id: block.getAttribute('id'), node: readNode(block.get(0)) }
    }),
  })
}
export function writeSharedModel(doc, model, origin) {
  validateModel(model)
  const root = doc.getXmlFragment('studio')
  doc.transact(() => {
    for (let i = 0; i < model.blocks.length; i++) {
      const block = model.blocks[i]
      let current = root.get(i)
      if (current?.getAttribute('id') !== block.id) {
        const index = root.toArray().findIndex((b) => b.getAttribute('id') === block.id)
        if (index >= 0) root.delete(index, 1)
        current = new Y.XmlElement('studio-block')
        current.setAttribute('id', block.id)
        current.insert(0, [createNode(block.node)])
        root.insert(i, [current])
      } else if (sameKind(current.get(0), block.node)) reconcileNode(current.get(0), block.node)
      else {
        current.delete(0, 1)
        current.insert(0, [createNode(block.node)])
      }
    }
    if (root.length > model.blocks.length)
      root.delete(model.blocks.length, root.length - model.blocks.length)
  }, origin)
}

export function createSharedDocument({
  initial,
  update,
  onChange = () => {},
  onUpdate = () => {},
} = {}) {
  const doc = new Y.Doc(),
    local = {},
    remote = {}
  if (update) Y.applyUpdate(doc, update, remote)
  else if (initial) writeSharedModel(doc, initial, remote)
  readSharedModel(doc)
  const undo = new Y.UndoManager(doc.getXmlFragment('studio'), {
    trackedOrigins: new Set([local]),
    captureTimeout: 750,
  })
  const subscribers = new Set()
  const listener = (bytes, origin) => {
    const model = readSharedModel(doc)
    onChange(model)
    for (const subscriber of subscribers) subscriber(model)
    if (origin !== remote) onUpdate(bytes)
  }
  doc.on('update', listener)
  return {
    subscribe(listener) {
      subscribers.add(listener)
      return () => subscribers.delete(listener)
    },
    doc,
    getModel: () => readSharedModel(doc),
    setModel: (model) => writeSharedModel(doc, model, local),
    encode: () => Y.encodeStateAsUpdate(doc),
    applyUpdate(bytes) {
      // Validate on a disposable replica before mutating the live shared state.
      const probe = new Y.Doc()
      try {
        Y.applyUpdate(probe, Y.encodeStateAsUpdate(doc))
        Y.applyUpdate(probe, bytes)
        readSharedModel(probe)
      } finally {
        probe.destroy()
      }
      Y.applyUpdate(doc, bytes, remote)
    },
    undo: () => undo.undo(),
    redo: () => undo.redo(),
    get canUndo() {
      return undo.undoStack.length > 0
    },
    get canRedo() {
      return undo.redoStack.length > 0
    },
    checkpoint: () => undo.stopCapturing(),
    destroy() {
      subscribers.clear()
      doc.off('update', listener)
      undo.destroy()
      doc.destroy()
    },
  }
}
