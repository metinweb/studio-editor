# CMS persistence and advanced editing

Studio remains an **embedded HTML editor**, usable in an ordinary HTML form or a Vue application. Your CMS owns users, permissions, routing, workflow and publishing. Start with [CMS integration](CMS-INTEGRATION.md). [Türkçe](CMS-PREMIUM.tr.md).

Try the [CMS integration lab](https://metinweb.github.io/studio-editor/integration/cms.html). Its adapter keeps versions **in memory only**; reloading resets them. It demonstrates the real editor/session APIs without pretending to save to your server.

## Enable or disable editing tools

`toolbar` and `menubar` still control layout. `features` independently controls the built-in commands. Every feature defaults to enabled; only an explicit `false` disables it. Existing document content is preserved.

| Key              | Commands/tools controlled                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `formatting`     | Inline/block formatting, colors, alignment, format painter, permanent pen, content styles, typography |
| `lists`          | Bullet/numbered/task lists, list properties, indent and list shortcuts                                |
| `tables`         | Table insertion, structural edits, cell formatting/paste, sorting, sizing and calculated-cell dialog  |
| `media`          | Media library/upload entry points, image editing/resizing, YouTube/Vimeo embeds                       |
| `links`          | Link insertion/editing/removal, autolinking and anchors                                               |
| `review`         | Comment mutations and selected-text suggestion commands                                               |
| `history`        | Undo/redo and CMS version-history dialog                                                              |
| `science`        | Math/chemistry/molecule dialog                                                                        |
| `source`         | User-facing source editor                                                                             |
| `ai`, `language` | AI assistant and service-backed spelling/grammar                                                      |
| `pageEmbed`      | Sandboxed web-page insertion/editing                                                                  |

```js
editor.setOptions({ features: { media: false, science: false, source: false } })
editor.setOptions({ features: {} }) // restore all built-in commands
```

Vue: `<StudioEditor :features="{ media: false, source: false }" />`. Disabling a feature also closes pending dialogs, and direct built-in engine commands/keyboard shortcuts are gated. Some contextual controls can remain visible but their disabled commands do not mutate content. This is **an editing policy, not an HTML schema or server authorization policy**: trusted host methods (`setHTML`, `setModel`, `applyOperations`, plugins) and pasted/imported HTML can contain the same element types. Use your server's validation and permissions for enforcement. `readonly`/`disabled` remain the controls for preventing all user edits.

## Autosave in plain HTML

```js
import {
  mountStudioEditor,
  bindDocumentSession,
  createHttpDocumentAdapter,
} from '/vendor/studio-editor/studio-editor.js'

const lifecycle = new AbortController()
const editor = await mountStudioEditor('#content', {
  contentCss: ['/assets/article.css'],
  bodyClass: 'article prose',
})
const binding = await bindDocumentSession(editor, {
  id: 'article-42',
  adapter: createHttpDocumentAdapter({
    baseUrl: 'https://your-cms.example/api/editor',
    getToken: () => yourCmsAccessToken(),
  }),
  delay: 1500,
  signal: lifecycle.signal,
  onChange({ status, dirty, error }) {
    document.querySelector('#save-status').textContent = error?.message || status
    if (status === 'saved' && !dirty) editor.markClean()
  },
})
editor.setOptions({ documentSession: binding.session })

// Connect your host buttons:
document.querySelector('#save').onclick = () => binding.session.save().catch(showSaveError)
document.querySelector('#versions').onclick = () => editor.openVersionHistory()

// On route exit/unmount, after handling any unsaved-change decision in your CMS:
// lifecycle.abort(); binding.dispose(); editor.destroy()
```

`yourCmsAccessToken` and `showSaveError` are host application functions. Do not put a provider's secret API key in browser code. Cookie authentication on the same origin works without `getToken`; your fetch wrapper/server must implement your CMS's CSRF protection. Cross-origin requests need appropriate CORS response headers.

Autosave is opt-in. It debounces by 100–60,000 ms (default 1,500), serializes saves, and retains edits made during an in-flight save. The next save uses the newly returned version. Failed saves stop automatic retries; the snapshot stays dirty. `retry()` explicitly retries; `pause()` and `resume()` control scheduling. `dispose()` cancels timers and ignores late results; it does not promise to cancel a write already accepted by the server. No automatic overwrite, conflict merge or offline durable queue is implied.

Status values: `idle`, `loading`, `dirty`, `saving`, `saved`, `conflict`, `error`. A 409/412 conflict preserves local text and stops writes. Show both versions in your host UI, resolve the conflict explicitly, then create/rebind a session using the current server version. Retrying unchanged stale data will correctly conflict again. Before switching documents, save or handle the unsaved draft. The binding refuses to overwrite edits made while the initial load was pending.

`beforeunload` prompts while dirty by default; browsers decide whether to show it. Your SPA/router must implement its own route guard. Set `warnOnUnload: false` if your CMS already handles this.

## Vue integration

```vue
<script setup>
import { ref, shallowRef, onBeforeUnmount } from 'vue'
import { StudioEditor, bindDocumentSession, createHttpDocumentAdapter } from 'studio-editor'
import 'studio-editor/style.css'

const html = ref(''),
  status = ref('loading'),
  session = shallowRef()
const lifecycle = new AbortController()
let binding
async function ready(editor) {
  try {
    binding = await bindDocumentSession(editor, {
      id: 'article-42',
      signal: lifecycle.signal,
      adapter: createHttpDocumentAdapter({ baseUrl: 'https://your-cms.example/api/editor' }),
      onChange: (state) => {
        status.value = state.error?.message || state.status
      },
    })
    session.value = binding.session
  } catch (error) {
    if (error.name !== 'AbortError') status.value = error.message
  }
}
onBeforeUnmount(() => {
  lifecycle.abort()
  binding?.dispose()
})
</script>
<template>
  <p role="status">{{ status }}</p>
  <StudioEditor
    v-model="html"
    :document-session="session"
    :content-css="['/assets/article.css']"
    body-class="article prose"
    :features="{ science: false }"
    @ready="ready"
  />
</template>
```

Retain the Pinia setup described in the main Vue integration guide. Create a new binding per document; don't call `binding.session.load()` to switch an already bound editor. The low-level `createAutosaveSession` is available if you prefer to own loading and change events yourself.

## Document HTTP contract

The helper calls your existing backend; Studio does not deploy a CMS server.

| Request                                | JSON response                                                |
| -------------------------------------- | ------------------------------------------------------------ |
| `GET /documents/:id`                   | `{ id, title, html, blockIds, version }`                     |
| `PUT /documents/:id`                   | Same record with a **new** string `version`                  |
| `GET /documents/:id/versions`          | `[{ version, title, createdAt? }]`, at most 1,000 entries    |
| `GET /documents/:id/versions/:version` | The requested historical record, matching `id` and `version` |

PUT body is the document record; header `If-Match` contains the JSON-quoted expected version, e.g. `"v4"`. Atomically compare that version and save/increment it in **one database transaction**. Return 409 or 412 if it differs; never perform a read-then-unconditional-write. IDs/path segments are URL encoded. The default HTTP timeout is 20 seconds. Apply authentication, document ACLs, CSRF validation, HTML validation and request limits on the host server.

Pass `documentSession` to enable **Tools → CMS version history** and `openVersionHistory()`. Users preview sanitized historical HTML and restore its content as an undoable draft. Restoration keeps the current server version for the next save; it never rolls back the version token or deletes history. History storage/retention belongs to the host adapter.

## AI and spelling/grammar

**Tools → AI writing assistant** supports rewrite, summarize, translate, shorten and expand with optional instructions. **Tools → Spelling and grammar** displays issues and replacement choices. Select 1–20,000 characters first. Only pressing **Run** calls the adapter; opening the dialog sends nothing. Users review the response before applying. Responses insert plain text, create an undo step and are refused if the document changed. Code/protected widgets/review annotations cannot be rewritten. One grammar replacement is applied per pass; select/recheck the updated text afterward.

```js
import { createHttpAssistanceAdapter } from 'studio-editor'
const assistanceAdapter = createHttpAssistanceAdapter({
  baseUrl: 'https://your-cms.example/api/assistance',
  label: 'Our editorial service',
  getToken: () => yourCmsAccessToken(),
})
// Vue: <StudioEditor :assistance-adapter="assistanceAdapter" />
// HTML: mountStudioEditor('#content', { assistanceAdapter })
```

| Request          | Input                                     | Response                                                            |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| `POST /ai`       | `{ text, language, action, instruction }` | `{ text: "Replacement text" }`                                      |
| `POST /language` | `{ text, language }`                      | `{ issues: [{ offset, length, message, replacements: ["word"] }] }` |

Offsets are **JavaScript UTF-16 code units**, relative to the exact submitted text (including surrogate pairs and newlines). Invalid/out-of-range issues are rejected. Max 200 issues, 10 replacements per issue, 100,000 AI output characters. The dialog times out after 120 seconds; cancel/close/disable aborts the signal and discards late results. A custom adapter can implement `generate(input, { signal })` and/or `check(input, { signal })`; `label` is optional. Remount the HTML integration to change the assistance provider/account. Vue adapter changes close pending assistant dialogs.

No AI/grammar provider, billing, shared dictionary or secret credential is bundled. Wire these two endpoints to your chosen services inside your backend. The public demo deliberately reports that no service is configured. This is a review-before-apply selection assistant, not a streaming chat agent or an automatic document-wide reviewer.

## Site styles, responsive preview and inline CSS

**View → Content style settings** now accepts both ordered external CSS URLs and content body classes (`article prose`). `bodyClass` allows at most 20 simple class names of 64 characters each; duplicates/invalid tokens are removed. Bind `v-model:body-class` or listen to `onBodyClassChange` in HTML. The classes apply inside the editor and preview, and are not written into stored article HTML. `allowContentCss: false` hides user settings; the host can still provide styles/classes.

**Document preview** offers Desktop, Tablet (768 px), Mobile (390 px) and landscape (1024/844 px). It changes the iframe viewport, so your CSS media queries run; it is not a device/browser emulator. Wider viewports scroll on a narrow screen.

`editor.getInlineHTML()` returns a separate sanitized HTML snapshot with supported computed text, spacing, border and list styles at the current editor viewport. It does not mutate the document. It includes a wrapper for inherited body presentation. Pseudo-elements, dynamic states, layout systems, media queries, fonts/assets and perfect email-client rendering are not embedded. Keep the external stylesheet for normal website publishing.

## Web page embeds

**Insert → Embed web page**, or `openPageEmbed()`, accepts HTTPS URL, accessible title and height (200–1,200 px). Click its caption to edit/remove it. The stored `data-studio-page` figure is portable through the JSON model. The renderer reconstructs a fixed `sandbox=""` iframe with lazy loading and no-referrer; arbitrary iframe HTML, scripts, forms and additional permissions are not accepted. Undo/redo and source round-trips retain the widget. Published HTML includes the frame and fallback link. A site's CSP/X-Frame-Options can refuse embedding; Studio cannot bypass this. Script-dependent pages may not work in this deliberately restricted viewer.

## Remaining service/product boundaries

These additions do not claim complete TinyMCE premium parity. Automatic tracking of every document edit, production multiuser conflict handling/live cursors, exact Office round-trips, a server PDF service, a full accessibility audit and a hosted media CDN remain outside the supplied implementation. Existing selected-text suggestions, experimental collaboration, DOCX conversion, browser PDF printing and media adapters remain available. See the updated [capability comparison](TINYMCE-COMPARISON.md).
