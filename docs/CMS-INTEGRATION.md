# Use Studio Editor inside your CMS

Studio Editor edits an HTML content field in your existing application. Your CMS owns pages, routes, users, translations, SEO metadata, approvals and publishing. The standalone writing workspace is an optional demo, not a prerequisite for embedding the editor.

For command-level feature switches, autosave, HTTP persistence, CMS version history, AI/grammar adapters, responsive preview and inline CSS, see [CMS persistence and advanced editing](CMS-PREMIUM.md).

## Plain HTML: enhance a textarea

Run `npm ci` and `npm run build:library` in this repository. Copy **all of** `packages/editor/dist/browser/` to a public directory on your site, such as `/vendor/studio-editor/`. Keep its files together: dialogs and science tools load additional modules when opened. This browser build includes Vue and Pinia; your page needs no framework setup, import map or build tool. Serve it over HTTP(S).

```html
<link rel="stylesheet" href="/vendor/studio-editor/studio-editor.css" />

<form method="post" action="/your-existing-content-endpoint">
  <label for="content">Content</label>
  <textarea id="content" name="content" required>&lt;p&gt;Existing article&lt;/p&gt;</textarea>
  <!-- Include the CSRF field required by your application. -->
  <button type="submit">Save</button>
</form>

<script type="module">
  import { mountStudioEditor } from '/vendor/studio-editor/studio-editor.js'

  const editor = await mountStudioEditor('#content', {
    locale: 'en',
    height: 550,
    onSave: () => document.querySelector('form').requestSubmit(),
  })
</script>
```

The textarea keeps its `name` and receives the current sanitized editing HTML on every content change. Native submission and `new FormData(form)` therefore work without copying content manually. Existing HTML inserted into a textarea by your server must be HTML-escaped to prevent a closing textarea tag from escaping the field.

- Each mount enhances **one textarea** and returns a promise that resolves when the editor is ready. Mount multiple textareas separately. Duplicate mounts reject.
- `required` rejects visually empty paragraphs; validation focuses the editor and displays a message. `readonly`, `disabled`, ancestor fieldset disabling and form reset are supported. Disabled fields retain normal native form exclusion rules.
- Existing `input` and `change` handlers receive bubbling events after editor changes. Both fire for every content update, not only on blur. When changing the textarea from external code, dispatch `input`, or use `editor.setHTML(html)`.
- `getHTML()` includes editing metadata; `getPublicHTML()` removes internal review annotations for a published rendering. Keep the editing version if comments must remain editable. Always validate and sanitize incoming HTML again on your server according to your site's policy.
- `setOptions({ readonly: true, locale: 'tr' })` updates the instance. Media adapters are fixed for its lifetime; destroy/remount to switch providers or accounts.
- `isDirty()` compares with the last clean baseline. Call `markClean()` after your server confirms a save. A form reset establishes a new baseline.
- `destroy()` removes the editor, listeners and dialogs and restores the textarea with its current HTML. It is safe to call twice.

[Runnable HTML example](../examples/html/index.html) · [Live integration example](https://metinweb.github.io/studio-editor/integration/). The example only displays form data; it does not pretend to persist it.

## Vue: bind your existing field

Use the regular package build in Vue applications, which shares your application's Vue and Pinia dependencies. Build/install the local tarball as described in the [package guide](../packages/editor/README.md). This project is not currently published to npm.

```vue
<script setup>
import { ref } from 'vue'
import { StudioEditor } from 'studio-editor'
import 'studio-editor/style.css'

const props = defineProps({ initialHtml: { type: String, default: '' } })
const emit = defineEmits(['save'])
const content = ref(props.initialHtml)
const editor = ref(null)

function save() {
  emit('save', {
    html: editor.value.getHTML(),
    publicHtml: editor.value.getPublicHTML(),
  })
}
</script>

<template>
  <form @submit.prevent="save">
    <StudioEditor ref="editor" v-model="content" locale="en" :height="550" @save="save" />
    <button type="submit">Save</button>
  </form>
</template>
```

Install Pinia in the host Vue app (`app.use(createPinia())`) when using the default media library. The plain HTML mount installs its own instance. See the [working Vue consumer](../examples/vue/App.vue) for separate editors, readonly state, transactions, plugin commands and media adapters. In SSR applications, mount the component on the client; importing the regular package is SSR-safe, rendering an editor on the server is not supported.

Connect the emitted save payload to your current API and surface its success/failure in your own form. Neither example invents a backend endpoint or reports a save before it has happened. `createDocumentSession(adapter)` is available for versioned loading/saving; its adapter must atomically reject stale `expectedVersion` values. See the package guide for its contract.

## Enable, hide or disable controls

These options work on the Vue component and on `mountStudioEditor`. Arrays select groups in the editor's standard order. Omitted options keep the defaults.

| Option               | Default                     | What you can change                                                                                     |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `toolbar`            | `true`                      | `false` hides the toolbar; an array chooses the groups below.                                           |
| `menubar`            | `true`                      | `false` hides the menu bar; an array chooses the menus below.                                           |
| `readonly`           | `false`                     | Prevent user edits while permitting selection/copy and host updates.                                    |
| `disabled`           | `false`                     | Disable editor interaction and focus. In an HTML mount, also exclude the textarea from form submission. |
| `allowContentCss`    | `true`                      | Allow the content style settings dialog. `false` hides it; host-provided CSS still applies.             |
| `contentCss`         | `[]`                        | One trusted stylesheet URL or an ordered array of up to 10 URLs.                                        |
| `mentions`           | `[]`                        | Supply your own mention suggestions.                                                                    |
| `allowCreateMention` | `false` in embedded editors | Permit arbitrary local mention labels. This does not send notifications.                                |
| `pasteMode`          | `'keep'`                    | `'keep'`, `'clean'` or `'text'` for formatted, cleaned or plain-text paste.                             |
| `tablePasteStyle`    | `'target'`                  | `'target'` uses destination table styling; `'source'` keeps supported source styles.                    |
| `locale`             | `'en'`                      | `'en'` or `'tr'`; does not translate the article.                                                       |
| `direction`          | `'ltr'`                     | `'ltr'`, `'rtl'` or `'auto'` for document direction.                                                    |
| `height`             | `600`                       | Pixels or a CSS height such as `'70vh'`; minimum 320px.                                                 |
| `placeholder`        | `''`                        | Empty-content hint, never inserted into saved HTML.                                                     |
| `messages`           | Built-in translations       | Per-instance translation overrides keyed by source message.                                             |
| `mediaAdapter`       | Local media library         | Connect your own library/upload service; choose on mount.                                               |

Toolbar groups:

| Group        | Controls                                                                |
| ------------ | ----------------------------------------------------------------------- |
| `history`    | Undo, redo                                                              |
| `typography` | Paragraph/headings, font family, font size                              |
| `format`     | Text formatting                                                         |
| `color`      | Text/highlight colors                                                   |
| `align`      | Text alignment                                                          |
| `lists`      | Bullets, numbering, indent/outdent                                      |
| `insert`     | Links, images, tables, Word import, preview and print                   |
| `tools`      | Content styles, outline, tasks, clear formatting, search and fullscreen |
| `review`     | Comments, suggestions, accessibility review and templates               |

Menu IDs: `file`, `edit`, `view`, `insert`, `format`, `table`, `tools`, `help`. The exports `toolbarGroups` and `menuNames` provide the available IDs programmatically.

```vue
<StudioEditor
  v-model="content"
  :toolbar="['history', 'typography', 'format', 'lists', 'insert']"
  :menubar="['edit', 'insert', 'format', 'table']"
  :allow-content-css="false"
  paste-mode="clean"
/>
```

```js
const editor = await mountStudioEditor('#content', {
  toolbar: ['history', 'format', 'lists'],
  menubar: false,
  allowCreateMention: false,
  pasteMode: 'text',
})
editor.setOptions({ readonly: true })
```

**Visibility is not feature authorization.** Hiding a toolbar/menu does not remove commands, keyboard shortcuts, contextual tools or permitted pasted HTML. Use the independent `features` command policy described in [CMS-PREMIUM.md](CMS-PREMIUM.md) to disable built-in command groups. This is not a tree-shaking plugin switch or an HTML schema restriction. For a fully noneditable field use `readonly`/`disabled`; enforce content policy and permissions on the server. Custom plugin commands can be disabled through their `enabled` callback or unregistered through their disposer.

Autocorrection, permanent pen, visual guides and the outline can also be switched from their respective menus. These editor-session tools are separate from toolbar visibility. Collaboration stays inactive until your application explicitly loads/connects the optional collaboration module.

## External CSS from settings or code

A [sample content stylesheet](../examples/html/article-theme.css) is included. On the live demo you can try `https://metinweb.github.io/studio-editor/integration/article-theme.css`.

Open **View → Content style settings** (Türkçe: **Görünüm → İçerik stili ayarları**). Enter one HTTP(S) URL per line and select **Apply styles**. Relative URLs resolve against the host page URL, not the package directory. The dialog reports each file's loading, loaded or error state; **Restore default styles** removes all additional stylesheets. The standalone workspace remembers the list in this browser; embedded instances retain it for their lifetime unless your host persists the update event.

```vue
<StudioEditor
  v-model="content"
  v-model:content-css="stylesheets"
  @content-css-status="handleCssStatus"
/>
```

```js
const stylesheets = ref(['/assets/article.css', '/assets/brand-overrides.css']) // Vue
// Plain HTML / JavaScript:
const editor = await mountStudioEditor('#content', {
  contentCss: ['/assets/article.css', '/assets/brand-overrides.css'],
  onContentCssChange: (urls) => console.log('Persist these in your CMS settings:', urls),
  onContentCssStatus: ({ url, status }) => console.log(url, status),
})
editor.setOptions({ contentCss: ['/assets/another-theme.css'] })
editor.openContentStyles()
```

Stylesheets load after the editor's base content styles and apply in list order, inside that editor's iframe and its **View → Document preview**. They do not style the toolbar or surrounding website and are not inserted into `getHTML()`, native form data, standalone HTML exports or DOCX. Your published page must include its own matching stylesheet. Stylesheet loading does not rewrite content or reset undo history.

Only use CSS you control/trust: it can make network requests and change what an author can see. HTTP(S) only; credential-bearing URLs, `javascript:`, `data:`, `blob:` and `file:` are rejected. Site CSP, mixed-content restrictions, authentication and CSS MIME-type rules still apply; an HTTPS page should use HTTPS CSS. A relative path inside a CSS file resolves against that CSS file. Rules that require an outer application wrapper (for example `.website-shell .article p`) will not match the iframe's plain body; use a content-specific stylesheet with selectors such as `body`, `p`, `h2` and `table`.

## Your CMS's responsibilities

Use `mediaAdapter` or `createHttpMediaAdapter` to connect the editor to your existing media library. The default browser-local library is useful for demos but is not a shared CMS upload service. Durable media URLs must remain readable by the published site.

Headings, lists, tables, templates, image editing, reusable writing profiles, accessibility/review tools and math/chemistry remain available in the embedded editor. Select toolbar/menu groups for smaller fields. Set the interface `locale` independently of the article's language, and `direction="rtl"` when needed.

Store SEO titles, descriptions, slugs and translation relationships alongside the HTML in your CMS's existing fields. Apply authorization, review and scheduled publishing on your server. The editor's readonly UI is not an authorization boundary. HTML output belongs inside your site's content container; it does not replace your Vue components, navigation or application layout.
