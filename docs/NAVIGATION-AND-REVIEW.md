# Document navigation and review

Added September 28, 2026. Available in English and Turkish, in the workspace and embedded editor.

## Search with context

Open **Edit → Find and replace** or the toolbar search button. Enable **Whole word** to exclude partial words, or **Ignore accents** to match `café`, `café` and `cafe` together. Case matching follows the editor language, including English `I/i` and Turkish `I/ı`, `İ/i`.

Expand **Match previews** to see surrounding text and jump directly to a result. Enter finds the next result; Shift+Enter finds the previous result. Escape in the search input closes search. Supported browsers highlight results without inserting markup into the document. Replacing all reports the number changed and can be undone in one step.

Search is literal, not a regular-expression engine. It does not cross paragraphs, line breaks, table cells or protected widgets. Merge fields, conditions, formulas, footnote markers, mentions, embeds and the generated contents block are excluded. Whole-word boundaries use Unicode letters, marks, numbers and underscores. Queries are limited to 2,000 characters, results to the first 10,000, previews to 100 and highlights to 1,000. Accented/case-folded matches retain original grapheme boundaries so replacement cannot leave half a character behind.

## Organize complete sections

Open **View → Document outline** or the outline toolbar button. Filter headings by text, collapse subheadings, or select a heading to see its section actions:

- **Move section up/down** swaps it with the adjacent sibling section at the same heading level. Its paragraphs, tables, images and deeper headings move together.
- **Promote/Demote heading level** adjusts the selected heading and all descendant headings together, within H1–H6.
- On a heading button, **Alt+ArrowUp/ArrowDown** moves that section. Every structural action supports undo/redo.

Structural actions apply only to headings directly inside the document body. Headings inside lists, tables or nested containers remain navigable. The outline does not move a section across its parent heading. Existing anchors and model block identities are preserved. Read-only editors allow navigation and search without structural changes. Collapse/filter state is temporary and stays out of exported content. Refresh an existing table of contents after rearranging headings; generated contents now includes H1–H6 and uses the editor language.

## Review and repair

Open **Tools → Accessibility check** or **Content check**. Filter suggestions by images, links, tables or headings. Alongside existing image descriptions, link names and table headers, the panel now identifies missing internal-link targets and suggests table captions. Add a caption or repair a skipped heading level directly in the panel; fixes preserve content/anchors and support undo. Broken links need a deliberate destination change through the link editor. Caption suggestions are editorial guidance, not a claim that every table requires a caption.

Search comments and suggested edits from their respective review tabs. **Download review report** produces a local JSON snapshot with all current checks, comments (including resolved threads) and suggestions, regardless of the visible filter. Reports contain document excerpts and review text. Nothing is uploaded by the report action. This remains a bounded content checker, not a full accessibility, contrast, keyboard or language audit.

Captions remain in HTML/print output, are retained as HTML tables in Markdown, and export as a paragraph immediately before the table in DOCX. DOCX layout is not an exact Word round trip.

## Verification

Unit tests cover locale folding, decomposed accents, source offsets, whole-word boundaries and search limits. Browser tests cover safe replacement, protected boundaries, complete-section movement, heading levels, undo, reload, mobile overlays, report contents and caption export. Package tests cover persistent block identities, read-only behavior and installed-library use.
