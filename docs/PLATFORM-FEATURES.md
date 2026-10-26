# Review, protection, layout and platform features

October 2026 update (0.1.0-beta.12). Each section lists what is implemented, how to use it and
its limits. [Türkçe](PLATFORM-FEATURES.tr.md)

## Track changes

**Tools → Track changes** (or the switch in the review panel's **Changes** tab) records edits
as suggestions instead of applying them:

- Typed text becomes `<ins data-studio-change="insert">`, deleted text stays visible inside
  `<del data-studio-change="delete">`. Typing over a selection is one _replacement_: both parts
  share a change id.
- Enter suggests a paragraph break (`data-studio-change="split"`); Backspace/Delete across
  paragraphs suggests joining them (`data-studio-change="join"`).
- Deleting your own suggested text removes it for real; Backspace at the start of your own new
  paragraph removes the suggested break.
- Plain-text paste, cut, find & replace and AI/grammar replacements are tracked. IME
  composition is wrapped as an insertion when it ends (automated tests cover Chromium; verify
  your target mobile keyboards).
- Each change stores an id, author id/name and ISO time. The review panel lists changes with
  **Show in document**, **Accept**, **Reject**, **Accept all** and **Reject all**. Resolving is
  one undo step. Exported review reports include tracked changes.

Hosts set the author with `user: { id, name }` and can enforce the mode with
`trackChanges: true`; users cannot turn an enforced mode off.

```js
const editor = await mountStudioEditor('#content', {
  trackChanges: true,
  user: { id: 'u42', name: 'Ayşe' },
})
editor.getTrackedChanges() // [{ id, type, author, authorName, time, inserted, deleted }]
editor.acceptChange(id) // or rejectChange, acceptAllChanges, rejectAllChanges
```

`getHTML()` keeps the suggestion markup for further review. `getPublicHTML()`, DOCX and Markdown
export publish the document **without** unresolved suggestions (as if rejected).

**Limits.** Only text insertions/deletions and paragraph breaks are tracked. Formatting,
lists, tables, media, widgets, drag and drop and source editing are refused while tracking (with
a notice) — turn tracking off for those. Pasted formatting and files are not tracked (pastes
become text). Changes are not tied to comments or notifications, and several authors are
distinguished by id only. This is not Word's revision format: DOCX export does not contain
tracked revisions.

## Restricted editing

Authors mark editable regions with **Edit → Make editable region**: a selection inside one
paragraph becomes an inline region (`span[data-studio-editable]`), a selection across blocks a
block region (`div[data-studio-editable]`). An optional name (`customer_name`) identifies the
field. **Edit → Restricted editing mode** previews the end-user experience.

In restricted mode only regions change. Typing, deleting, pasting and IME outside a region are
refused; inline regions accept text only (no Enter); Tab and Shift+Tab move between regions and
Ctrl+A selects the current region. A commit guard compares the locked content before and after
every change, so other input paths cannot change it either; undo stops before edits made outside
restricted mode. Host updates (`setHTML`, `v-model`, collaboration) still apply.

```js
mountStudioEditor('#contract', { restricted: true }) // users cannot leave the mode
editor.getEditableRegions() // [{ name, kind: 'inline' | 'block', text, html }]
```

The document HTML contains no runtime attributes, so it is identical in both modes.
**Limits.** Only inline formatting, links and undo are available inside regions; structural
commands are disabled. Regions cannot be nested. Server-side validation of submitted documents
remains the host's responsibility.

## Live cursors and presence

Collaborators' carets and selections are drawn over the document with name labels, and present
users appear in the status bar. Selections are portable — top-level block id plus text offset —
so they apply to every editor showing the same shared model.

```js
const stop = editor.subscribeSelection((selection) => send(selection)) // your transport
editor.setRemoteSelections([{ id: 'u7', name: 'Mehmet', selection }])
```

`connectSharedRoom({ getSelection: () => editor.getSelectionAnchor(), onPresence })` sends the
caret with every sync; the reference server validates it and returns it in the presence list.
**Limits.** The reference HTTP transport polls once per second, so carets move with that delay.
Concurrent structural editing remains experimental (see the collaboration notes in
[BETA10.md](BETA10.md)).

## Page view

**View → Page view** shows the document as sheets of the print page size (A4/Letter, portrait or
landscape, margins from **Page setup and export**) with dashed page boundaries and the current
page in the status bar. Breaks follow explicit page breaks and move whole blocks to the next page;
blocks taller than a page are split. Nothing is added to the document HTML.
**Limits.** Boundaries are an on-screen estimate. Browser printing decides the final breaks
(widows/orphans, table rows); headers and footers appear only in print/PDF and DOCX.

## Mermaid diagrams

**Insert → Diagram (Mermaid)**, the toolbar button or `/diagram` opens an editor with examples
(flowchart, sequence, Gantt, class, state, pie), live preview, syntax errors and alternative text.
The diagram is stored as an image (PNG, or SVG for diagram types that need HTML labels) with its
URI-encoded source in `data-studio-source`; double-click to edit. Mermaid runs with
`securityLevel: 'strict'` and loads only when the dialog opens.
**Limits.** Diagrams are static images in exported HTML/DOCX; the source re-renders only in the
editor. Not available in `studio-editor/lite`.

## Dark theme

The standalone workspace has **Appearance: System / Light / Dark** in the sidebar (stored in this
browser). Embedded editors use `theme="light" | "dark" | "auto"` (default `light`). Menus,
toolbars, panels, dialogs and teleported popovers follow the theme. The dark variants are
generated at build time from the light stylesheets (`scripts/dark-theme-css.mjs`): surfaces
darken, text lightens, saturated accents stay. Unit tests check WCAG AA contrast for the main
surface/text pairs.
**Limits.** The document page keeps its own colors (a white sheet), because content colors
belong to the published page.

## Crash recovery

If an editor event handler, a component inside the editor or an overlay measurement (selection
toolbar, block, table, image and media controls, guides, page view, remote cursors, outline)
throws, the editor restarts from its last HTML and shows a notice. One failure is reported per
editor instance, so a single incident counts once. After more than three failures within a minute it stops and offers
**Restart editor**, so a deterministic error cannot loop. Hosts receive `onCrash` /
`@crash` / `studio-crash` with `{ error, recovered, html }`. Undo history and open dialogs are
lost on restart; content is not.

## Offline workspace (PWA)

The standalone build installs as an app (manifest and icons) and works offline after the first
visit: `sw.js` precaches the application shell, then fetches optional features (MathJax, Mermaid,
CodeMirror, Mammoth) in the background unless the browser requests data saving. A new release
waits until the user chooses **Update and reload**; documents are saved first. The worker never
intercepts other origins, so remote media and APIs are unaffected. Serve `sw.js` with
`Cache-Control: no-cache`. Automated browsers skip registration unless the URL contains `?pwa`.

## AI streaming

Assistance adapters may stream: `generate(input, { signal, onText })` — call `onText` with the
accumulated text and the dialog shows it as it arrives. The final text is still validated and
reviewed before it replaces the selection.
`createHttpAssistanceAdapter({ baseUrl, stream: true })` asks for `text/event-stream` and accepts
JSON replies as before; `readAssistanceStream(response, { onText, signal })` parses SSE events
`{"delta"}`, `{"text"}`, `{"error"}` and `[DONE]` in custom adapters.

## `<studio-editor>` web component

```html
<link rel="stylesheet" href="./editor/studio-editor.css" />
<script type="module">
  import { defineStudioEditorElement } from './editor/studio-editor.js'
  defineStudioEditorElement()
</script>
<form>
  <studio-editor name="content" required height="460" theme="auto">
    <template><p>Initial HTML</p></template>
  </studio-editor>
</form>
```

The element is form-associated: it submits its HTML under `name`, resets with the form and
reports `required` validity. Attributes: `value`, `locale`, `theme`, `placeholder`, `direction`,
`readonly`, `disabled`, `required`, `restricted`, `track-changes`, `height`, `toolbar`, `menubar`,
`content-css`, `body-class`, `paste-mode`, `table-paste-style`, `allow-create-mention` and
`disable-features` (space separated). Object options are properties (`features`, `mentions`,
`messages`, `mediaAdapter`, `assistanceAdapter`, `documentSession`, `user`). Events: `input`,
`change`, `studio-ready`, `studio-save`, `studio-transaction`, `studio-crash`. It renders in light
DOM, so include the stylesheet once. [Live example](https://metinweb.github.io/studio-editor/integration/element.html).

## `studio-editor/lite`

`studio-editor/lite` (and `studio-editor/lite/browser`) is the same API without MathJax,
OpenChemLib, Mammoth and Mermaid: 1.8 MB on disk instead of 14.7 MB for the full ES build. Both
load a 0.4 MB entry and fetch optional features lazily; lite removes the files entirely. The
`science`, `wordImport` and `diagrams` features are always off in lite.

```js
import { StudioEditor } from 'studio-editor/lite'
import 'studio-editor/lite/style.css'
```

## Real CMS integration (CodeCMS)

Studio replaced the self-hosted TinyMCE (GPL) content editor of CodeCMS — a Vue 3 + Pinia 3
admin with an Express + MongoDB backend and a Nuxt site — on a separate branch. A drop-in
`StudioContentEditor.vue` keeps TinyMCE's props, maps the CMS dark mode to `theme` and connects
Studio's media library to the CMS file API (`/api/files`, `/api/files/upload`). An end-to-end run
against the real backend and database logs in, writes a post, pastes Word HTML, uploads an image
through the CMS, saves, reopens the post, switches to dark mode and shows the published post on
the public site.

Fixed in Studio because of it: the Pinia peer range now accepts Pinia 3; pasted `<b>`/`<i>` become
`<strong>`/`<em>` (toolbar state recognized them only in loaded documents); pasting a list at the
end of a paragraph no longer leaves a blank, caret-less paragraph; sequential Word lists no longer
carry redundant `value` numbers; the document sheet stays white in dark interfaces.
Found in CodeCMS and fixed on the integration branch: `/posts/new` was treated as an edit, an
empty category failed the MongoDB cast, and drafts were hidden from `superadmin`/`editor` users.

## Accessibility and phone checks

- `tests/accessibility.spec.js` runs axe-core (WCAG 2.1 A/AA) on the workspace, every menubar
  menu, the review panel tabs and key dialogs in light and dark themes, and requires no serious
  or critical violations. It led to darker secondary text (at least 4.5:1) and accessible names
  that contain the visible value (“Font: Arial”, WCAG 2.5.3).
- The `mobile-chrome` (Pixel 7) and `mobile-safari` (iPhone 14) projects run
  `tests/mobile-*.spec.js` with mobile user agents, touch input and phone viewports. They found
  that WebKit cancels the click when `pointerdown` is prevented, which left toolbar and menu
  buttons unresponsive to taps on iPhone; buttons now prevent it only for mouse and pen.
- These projects emulate phones in desktop engines; the next section runs the real browsers.

## Real screen readers and mobile browsers

`.github/workflows/assistive.yml` runs on every push to `main` in four environments:

| Job                | Environment                                       | Input                                                        |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------ |
| NVDA + Chromium    | Windows Server 2025, NVDA 2026.2 through Guidepup | Keys through the operating system                            |
| VoiceOver + WebKit | macOS 15, VoiceOver through Guidepup              | Keys through System Events, controls activated with VO+Space |
| Chrome on Android  | Android 15 emulator (API 35), Chrome 124          | Taps and keys through Android's input system (`adb input`)   |
| Safari on iOS      | iOS 26.2 Simulator (iPhone 17), Appium XCUITest   | XCTest touches; typing taps keys on the iOS keyboard         |

- `tests/screen-reader/` checks, from what the screen reader actually spoke, the document label,
  the bold button's name and state, menu items, dialog names and the find field. Each test keeps
  the spoken transcript, VoiceOver's item text and the key and input events the editor received
  (all `isTrusted`); transcripts appear in the job summary.
- NVDA found a real problem: the save label read “Pending save. Saving… All changes saved” after
  every typed character. The visible label is no longer a live region; only saves the user asks
  for (Ctrl/⌘+S, Retry) are announced, and failures keep the error alert. The NVDA and VoiceOver
  tests check that typing stays quiet.
- VoiceOver moves its own cursor, and keyboard focus, with Home/End, so the macOS test places the
  caret by script and reaches controls outside the editing frame as a VoiceOver user does
  (stop interacting, then keyboard focus or the item chooser).
- `tests/devices/` runs one session on both phones: tap into the document, type with the device
  keyboard, make text bold from the toolbar, undo, and insert a horizontal rule from the Insert
  menu. Before each tap a transparent probe measures where browser bars and the software keyboard
  put the page; the page itself is only read. Failed runs keep a device screenshot and the
  editor's input events.
- Limits: these are real operating systems, browsers and screen readers, but in an emulator and a
  simulator. Physical touch hardware and device performance, TalkBack, iOS VoiceOver and real
  composition keyboards (Japanese, Chinese) still need sessions on devices. Composition itself is
  covered with synthetic events and CDP in `tests/editor.spec.js` and `tests/track-changes.spec.js`.

## Quality gates

- `npm run lint`: ESLint (correctness rules) plus `scripts/check-api.mjs`, which fails when
  runtime exports, component methods or props drift from `index.d.ts`.
- `npm run typecheck`: TypeScript against the declarations and the typed consumer example.
- `RichEditor.vue` is split into `src/components/rich-editor/` (menus, toolbar, popups, dialogs,
  find and replace, options, editing modes) with shared state provided to its parts.
- `.github/workflows/publish.yml` publishes verified copies of the release tarball for `v*` tags:
  to GitHub Packages as `@metinweb/studio-editor` with the workflow token, and to npmjs.org as
  `studio-editor` with provenance when the `NPM_TOKEN` secret is set (beta versions use the
  `beta` dist-tag). See [RELEASE.md](RELEASE.md).
