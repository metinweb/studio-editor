# Languages and localization

Studio Editor is English-first. The website root, standalone workspace, initial welcome document and embedded Vue component default to English. Turkish remains supported.

## Standalone workspace

The sidebar's **Interface language** selector switches between English and Türkçe. The choice is saved under `studio-locale` in localStorage. If storage is unavailable, the app remains usable and defaults to English on the next visit. `?lang=en` or `?lang=tr` can set the initial choice; the query is consumed so later selections remain authoritative.

Switching language changes interface labels and date formatting without remounting the editor or translating existing content. The welcome document is created only in an empty workspace. Existing documents, titles, tags, comments and personal templates remain as written. Search and document ordering follow the current interface locale; tag identity normalization remains stable for compatibility with existing data.

## Vue component

```vue
<StudioEditor v-model="content" locale="en" />
<StudioEditor v-model="content" locale="tr" />
```

Omitting `locale` selects English. Existing integrations that rely on Turkish should now pass `locale="tr"` explicitly. `messages` provides per-instance plain-text overrides. Turkish source strings remain the beta API's message keys, for example `:messages="{ Kalın: 'Strong' }"`.

`renderDocument({ title, content, locale: 'tr' })` sets Turkish document metadata; its default is English. This does not translate the content. New workspace documents retain their creation locale in backups and versions.

## Add or update translations

- Core and panel messages live in `src/lib/locales.js` and `src/lib/panel-messages.js`; workspace and additional control messages are in `src/lib/workspace-messages.js`.
- Use `t(sourceKey)` for visible labels, tooltips, placeholders, errors and accessible names. Use named placeholders for dynamic text, such as `t('{count} etiket', { count })`; never concatenate user text into a message key.
- Render translations as text. Escape any values used to generate template HTML. Do not translate user content or custom template names.
- The English landing page is `website/index.html`; Turkish is `website/tr/index.html`. Keep feature descriptions and relative asset/demo links aligned.
- English is the primary language for new contributor-facing documentation. Retain translated documents with a language suffix, such as `README.tr.md`.

Provider-supplied errors and custom content use the supplied language. Unmapped diagnostic messages may still fall back to their source text.

## Verification

`tests/locale.spec.js` starts with empty storage and verifies English defaults, language persistence, undo/redo preservation, localized dialogs/templates and mobile layout. Existing editing suites explicitly select Turkish to retain coverage for that locale. `tests/site/landing.spec.js` checks both public website languages and demo entry points. Run `npm run build`, `npm test`, `npm run build:site` and `npm run test:site`.
