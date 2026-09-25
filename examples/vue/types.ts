import { h, ref } from 'vue'
import { StudioEditor, publicHtml, type StudioEditorApi } from 'studio-editor'
import { mapSelection, type MediaAdapter, type EditorTransaction } from 'studio-editor'
const editor = ref<InstanceType<typeof StudioEditor> | null>(null)
editor.value?.setHTML('<p>Test</p>')
const html: string | undefined = editor.value?.getPublicHTML()
const callback = (api: StudioEditorApi) => api.focus()
h(StudioEditor, { modelValue: html, height: 500, onReady: callback })
const cleaned: string = publicHtml('<p>Test</p>')
// @ts-expect-error height cannot be a boolean
h(StudioEditor, { height: true })
void cleaned
const tx = {} as EditorTransaction
mapSelection(tx.selectionBefore, tx.mapping)
const adapter = {} as MediaAdapter
h(StudioEditor, { mediaAdapter: adapter, onTransaction: (value) => console.log(value.revision) })
editor.value?.getHistoryStats()?.patchBytes
h(StudioEditor, {
  tablePasteStyle: 'source',
  'onUpdate:tablePasteStyle': (style) => {
    const valid: 'target' | 'source' = style
    void valid
  },
  readonly: true,
  pasteMode: 'clean',
  'onUpdate:pasteMode': (mode) => {
    const valid: 'keep' | 'clean' | 'text' = mode
    void valid
  },
  onPaste: (info) => {
    const inserted: boolean = info.inserted
    void inserted
  },
  disabled: false,
  placeholder: 'Write here',
  toolbar: ['history', 'format'],
  menubar: ['file', 'edit'],
  locale: 'en',
  messages: { Kalın: 'Strong' },
})
// @ts-expect-error unsupported toolbar group
h(StudioEditor, { toolbar: ['not-a-tool'] })
// @ts-expect-error unsupported table paste style
h(StudioEditor, { tablePasteStyle: 'unknown' })
// @ts-expect-error only shipped core locales are accepted
h(StudioEditor, { locale: 'unknown' })

import {
  loadCollaboration,
  createDocumentSession,
  createHttpMediaAdapter,
  applyModelOperations,
  type SchemaDocument,
} from 'studio-editor'
const model: SchemaDocument = { schemaVersion: 2, revision: 0, blocks: [] }
applyModelOperations(model, { baseRevision: 0, operations: [] })
// @ts-expect-error semantic edits require a revision
applyModelOperations(model, { operations: [] })
editor.value?.registerPlugin({
  id: 'example',
  commands: [{ id: 'hello', title: 'Hello', execute: (api) => api.insertHTML('<p>Hello</p>') }],
})
h(StudioEditor, { direction: 'rtl', blockIds: ['p1'] })
// @ts-expect-error direction is a constrained HTML direction
h(StudioEditor, { direction: 'right' })
async function collaborationTypes(api: StudioEditorApi) {
  const module = await loadCollaboration()
  const { shared } = await module.openSharedRoom({
    url: 'https://example.com',
    room: 'one',
    getToken: () => '',
    initial: model,
    createSharedDocument: module.createSharedDocument,
  })
  const binding = module.bindSharedDocument(api, shared)
  const connection = module.connectSharedRoom({
    url: 'https://example.com',
    room: 'one',
    getToken: () => '',
    shared,
    binding,
    onRole: (role) => {
      const value: 'editor' | 'viewer' = role
      void value
    },
  })
  connection.dispose()
  binding.dispose()
  shared.destroy()
}
void collaborationTypes
void createDocumentSession
void createHttpMediaAdapter
