import '../style.css'
import './library.css'

export { default as StudioEditor } from './StudioEditor.vue'
export { cleanHtml, publicHtml, renderDocument, documentCss } from '../lib/content'
export { mapSelection, mapOffset } from '../editor/operations.js'
export { englishMessages } from '../lib/locales.js'
export { toolbarGroups, menuNames } from '../lib/editor-options.js'
export { validateModel, renderModel, applyModelOperations } from '../editor/document-model.js'
export { createHttpMediaAdapter } from '../lib/http-media-adapter.js'
export { createDocumentSession } from '../lib/document-storage.js'
export { renderPrintDocument, printDocument } from '../lib/print-document.js'
export const exportDocx = async (html, options) =>
  (await import('../lib/docx-export.js')).exportDocx(html, options)
/** Loads the optional CRDT module only when collaboration is requested. */
export const loadCollaboration = () => import('./collaboration.js')
