# Studio Editor for Vue 3

An MIT-licensed rich-text editor with an independent editing engine, tables, media management, image editing, comments and HTML source editing.

[Live demo](https://metinweb.github.io/studio-editor/demo/) · [Source](https://github.com/metinweb/studio-editor) · [Türkçe](README.tr.md)

The default interface is **English**. Set `locale="tr"` for Turkish. Changing the interface language preserves document content, selection and undo history.

## Install from source

This beta is not published to npm. Build a local package from this repository:

```sh
npm ci
npm run package:release
```

In your Vue application, install the generated tarball and its peer dependencies:

```sh
npm install /path/to/studio-editor/release/studio-editor-0.1.0-beta.11.tgz vue@^3.5 pinia@^4
```

Register Pinia once in your application entry:

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')
```

```vue
<script setup>
import { ref } from 'vue'
import { StudioEditor } from 'studio-editor'
import 'studio-editor/style.css'

const content = ref('<p>Hello, world!</p>')
const editor = ref(null)
function save(html) {
  // Connect this to your persistence layer. Validate HTML on your server too.
  console.log(html)
}
</script>

<template>
  <StudioEditor ref="editor" v-model="content" :height="600" @save="save" />
</template>
```

## Options

Options can change at runtime without resetting document content or history. Changing a media adapter requires remounting with a new `key`.

| Prop                     | Behavior                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modelValue` / `v-model` | Document HTML. Defaults to an empty document.                                                                                                      |
| `height`                 | Pixel number or CSS height such as `70vh`. Default 600; minimum 320 px.                                                                            |
| `locale`                 | `en` by default, or `tr`. Controls interface language, not document text.                                                                          |
| `messages`               | Instance-specific plain-text translations. Turkish source strings remain stable beta keys; overrides take precedence over the built-in dictionary. |
| `direction`              | `ltr` (default), `rtl` or `auto`.                                                                                                                  |
| `readonly`               | Prevents user edits, undo/redo, paste/drop and mutation tools. Selection, copying, search, fullscreen and read-only source remain available.       |
| `disabled`               | Adds inert focus and interaction behavior to the read-only restrictions.                                                                           |
| `placeholder`            | Plain-text hint for an empty document; excluded from content, history and exports.                                                                 |
| `toolbar`                | `true` for all groups, `false` or `[]` to hide, or an array of group IDs.                                                                          |
| `menubar`                | `true` for all menus, `false` or `[]` to hide, or an array of menu IDs.                                                                            |
| `pasteMode`              | `keep` (default), `clean` or `text`. Supports `v-model:paste-mode`.                                                                                |
| `tablePasteStyle`        | `target` (default) or `source`. Supports `v-model:table-paste-style`.                                                                              |
| `mediaAdapter`           | Optional asynchronous media provider, bound at mount.                                                                                              |
| `blockIds`               | Saved block IDs. Store `transaction.blockIdsAfter` alongside HTML.                                                                                 |
| `mentions`               | Local mention suggestions. No user directory or notification service is provided.                                                                  |
| `allowCreateMention`     | Allow creation of local mentions.                                                                                                                  |

Toolbar groups: `history`, `typography`, `format`, `color`, `align`, `lists`, `insert`, `tools`, `review`.
Menu IDs: `file`, `edit`, `view`, `insert`, `format`, `table`, `tools`.
The package exports `toolbarGroups`, `menuNames` and `englishMessages`.

```vue
<StudioEditor
  v-model="content"
  locale="en"
  placeholder="Start writing…"
  :toolbar="['history', 'typography', 'format', 'insert']"
  :menubar="['file', 'edit', 'insert']"
  :messages="{ Kalın: 'Strong' }"
/>
```

Unknown menu/group IDs are hidden. Tool visibility is not authorization; use `readonly` or `disabled` to prevent user edits. Application code can still replace content through `v-model` or `setHTML()` in locked modes. `insertHTML()`, `undo()` and `redo()` do nothing while locked.

## Events and instance API

Use the API after `ready`. The event receives a `StudioEditorApi` object; the component ref also exposes it.

| Event or method                                 | Result                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `update:modelValue`, `change`                   | Updated HTML, including review metadata.                                            |
| `ready`                                         | Editor API, ready for use.                                                          |
| `save`                                          | Current HTML on Ctrl/⌘+S or the save command. The host application must persist it. |
| `transaction`                                   | Revisioned HTML change, selection and block mapping data for edits/undo/redo.       |
| `paste`                                         | `{ source, mode, rows, columns, warnings, inserted }`; no HTML payload.             |
| `upload-progress`, `upload-error`               | Custom media provider progress (0–100) and error message.                           |
| `getHTML()`                                     | Document HTML with review metadata.                                                 |
| `getPublicHTML()`                               | Sanitized publication HTML without review metadata.                                 |
| `setHTML(html)`                                 | Replace with sanitized HTML; undoable.                                              |
| `insertHTML(html)`                              | Insert sanitized HTML at the selection.                                             |
| `focus()`, `undo()`, `redo()`                   | Focus and editing history.                                                          |
| `openMedia()`, `openSource()`, `refreshMedia()` | Built-in media/source tools and media refresh.                                      |
| `getDocument()`                                 | Session snapshot `{ schemaVersion: 1, revision, html, blockIds }`.                  |
| `getModel()`, `setModel(model)`                 | Structured schema-2 document model.                                                 |
| `applyOperations(batch)`                        | Apply revision-checked structured operations; rejects stale revisions.              |
| `getHistoryStats()`                             | Undo/redo counts, `patchBytes` and `documentBytes`; not heap usage.                 |
| `registerPlugin(plugin)`                        | Register trusted application commands; returns a disposer.                          |
| `executeCommand(id, ...args)`, `getCommands()`  | Execute or inspect registered commands.                                             |

```js
const model = api.getModel()
api.applyOperations({
  baseRevision: model.revision,
  operations: [{ type: 'moveBlock', blockId: model.blocks[0].id, index: 1 }],
})
const dispose = api.registerPlugin({
  id: 'my-tools',
  commands: [
    {
      id: 'signature',
      title: 'Signature',
      execute: (editor) => editor.insertHTML('<p>Best regards</p>'),
    },
  ],
})
api.executeCommand('my-tools/signature')
dispose()
```

This command API runs trusted application code; it is not a plugin sandbox.

## Paste and tables

Paste supports representative Word lists, Docs headings, HTML tables and rectangular Excel/Sheets TSV, including quoted cells. `clean` removes inline formatting while retaining structure; `text` discards HTML and images. Ctrl/⌘+Shift+V and pasting into code blocks use plain text. Mixed text/image insertion is one undo step.

Select a cell rectangle with Shift+click, drag, or Alt+Shift+arrow. Escape clears the selection. Copy/cut emits HTML and TSV; Delete/Backspace clears selected content. Table structure remains intact. Merged cells must be fully covered. Overflow, size mismatches and invalid cross-section merges are rejected without changing the document.

`tablePasteStyle="source"` transfers supported explicit cell colors, typography, alignment, padding and borders for `keep` + HTML-table paste. Target dimensions, IDs and semantic cell types remain intact. CSS classes, inherited styles, URLs, positioning and `!important` are not transferred. Plain text, TSV and `clean` retain destination styles. TSV cannot represent merged cells.

The cell-format dialog applies only changed settings. Resets preserve structure and content. Column handles balance adjacent widths; arrows move 1 px, Shift+arrows 10 px. Widths persist as `colgroup` HTML. Merge/split, row/column operations and bulk formatting are undoable.

Limits: HTML + text up to 5 Mi UTF-16 code units; tables up to 10,000 cells; TSV also up to 1,000 rows / 100 columns. This is not full Office/RTF layout fidelity.

## Media adapters

Provide `list()`, `upload(file, { signal, alt, onProgress })`, `update(asset)` and `remove(id)` as asynchronous methods. List returns assets; upload/update return the resulting asset. Asset shape:

```js
{
  ;(id, name, type, size, url, alt, createdAt)
}
```

Report upload progress between 0 and 1, honor cancellation, and throw/reject on errors. Invalid records and unsafe URLs are rejected. Each custom adapter has instance-specific state. `createHttpMediaAdapter` is also exported; see the repository's `examples/` for reference servers.

The package does not provide authentication, server storage or signed-URL renewal. Remote image editing requires CORS. Deleting server media may break existing documents. Image editing is limited to 8192 px per edge / 16 MP; media files to 12 MB.

## Persistence, export and collaboration

The embedded component **does not autosave documents**. Connect `v-model` and `save` to your storage layer. The standalone workspace provides IndexedDB autosave, persistent versions and `.studio.json` backups. Default media and personal templates are shared within the same Pinia/origin; documents and editing history are per editor instance.

Exports include `cleanHtml`, `publicHtml`, `renderDocument({ title, content, locale? })`, `documentCss`, `renderPrintDocument`, `printDocument` and `exportDocx`. DOM helpers require a browser. `renderDocument` defaults to English document metadata; pass `locale: 'tr'` for Turkish. User text is never translated automatically.

`createDocumentSession` supports persistence providers. Its `save(record, { expectedVersion })` implementation must compare versions atomically on the server. `loadCollaboration` exposes an experimental Yjs binding. Concurrent complex structural edits and live cursors are not production-ready. Suggestions are selected-text changes, not automatic tracking of all edits. DOCX import is not supported.

History retains the current document and up to 79 reversible changes, with an approximate 16 MiB patch budget. At least one undo is retained, so a single large change may exceed the budget. `patchBytes` is a serialized UTF-16 estimate. `mapSelection` and `mapOffset` map changes within a block; they are not a complete concurrent editing model.

## Integration notes

- ESM only, with Vue 3.5+ and Pinia 4 peer dependencies. No CJS/UMD global build.
- Import CSS once. Styles are scoped under `.studio-editor-scope`, without resetting the host page. This is not Shadow DOM isolation.
- The module can be imported in SSR, but mount the editor on the client (for example with Nuxt `ClientOnly`).
- The legacy IndexedDB name `tinymce-studio` is kept for data compatibility. TinyMCE is not an engine dependency.
- English and Turkish interfaces are included. Built-in templates follow the selected language. Custom content, custom provider errors and user-created template names remain as supplied; unmapped diagnostic messages may use their source language.
- The image Worker is bundled; CSP deployments need `worker-src blob:`. Unsupported environments use the main thread.
- Chromium, Firefox and WebKit are tested. Physical mobile keyboards and screen readers still require device testing.

See `index.d.ts` for exported types. `LICENSE` contains the MIT license; `THIRD_PARTY_NOTICES.txt` contains dependency licenses.
