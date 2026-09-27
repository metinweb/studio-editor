# Writing power tools

Added September 28, 2026. English is the default UI language; all dialogs also support Turkish. These tools run locally in the browser and do not send document text to an external service.

## Markdown import and export

- **File → Import Markdown** accepts a local `.md` file or pasted text, displays a sandboxed preview and inserts at the saved cursor position. Insertion is one undo step. If the document changes while the dialog is open, reopen it before inserting.
- **File → Export Markdown** displays selectable Markdown with copy and download controls. Export also works in read-only mode.
- Headings, emphasis, links, lists, GFM task lists, simple tables and fenced code are supported. Checked tasks retain their state.
- Footnotes, merge fields, figures and science images remain sanitized HTML islands. Complex tables, nested tables and cells containing pipe characters or line breaks also remain HTML to avoid losing their structure.
- Markdown cannot represent every HTML style or review annotation. Font colors, page settings and comment/suggestion metadata are not a lossless round trip. A Markdown viewer that disables raw HTML may hide the preserved HTML islands.
- Import/preview accepts up to 200,000 characters; file reads are bounded to 800,000 bytes. Export can still download a larger generated source even when preview exceeds that limit.

## Autocorrect and text shortcuts

Open **Tools → Autocorrect & text shortcuts**, enable the tool, and add exact shortcut/replacement pairs. Type a space after a shortcut to expand it. For example, `;signature` can become a multiline sign-off. Replacement text is literal, never executable HTML.

Matching is case-sensitive and uses whole tokens. Up to 100 rules are allowed, with 60-character shortcuts and 1,000-character replacements. Rules can be removed or reset to the small default set. Optional symbols include `(c)` → ©, `(tm)` → ™, `...` → …, `--` → — and arrows. Undo restores the original shortcut without removing the text typed before it.

This is a configurable replacement engine, not a grammar/spelling service. Code, links, comments, protected widgets, composition input and paragraphs over 10,000 characters are excluded. No automatic correction is enabled until the user opts in.

## Permanent pen

Open **Format → Permanent pen**. Choose text color, optional highlight, size, bold/italic/underline and enable it. Subsequent typing uses that style even after moving the caret. Existing selected text is replaced normally when typing, with undo support. Consecutive typing is grouped in history.

The status bar shows when the pen is active. Click that indicator or press Escape in the editor to turn it off. Pasted content, code, links, comments, protected widgets and IME composition retain their native behavior. Turning the pen off restores normal contextual typing behavior; it does not remove formatting already applied.

## Settings, dependencies and validation

Settings belong to the current editor instance/session and are not saved in document HTML or shared between active editor instances. Reopening the page resets active settings. Named profiles can now be saved in this browser or transferred as JSON; load a profile and apply it explicitly. See [advanced documents](ADVANCED-DOCUMENTS.md#named-writing-profiles). Disabled/read-only editors reject edits.

Markdown uses lazy-loaded [Marked](https://marked.js.org/), [Turndown](https://github.com/mixmark-io/turndown) and its GFM plugin, with DOMPurify sanitization before rendering or insertion. Third-party license notices ship with distributions.

`tests/premium-writing.spec.js` covers conversion, sanitized links, tasks, downloads, special-element round trips, correction undo, literal multiline expansion, pen selection replacement, grouped undo, Escape, combined pen/correction behavior and narrow-screen dialogs. `scripts/tests/writing-preferences.test.mjs` covers rule and style limits.
