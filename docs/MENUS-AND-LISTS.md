# Menus and lists

The toolbar list buttons are split controls. Click the icon to toggle a list; click its arrow to open the preview gallery.

- Bullets: disc, circle and square.
- Numbering: decimal, lowercase/uppercase letters, lowercase/uppercase Roman numerals and leading zeros.
- List properties: set the current ordered list's starting number or reverse its numbering.
- Applying a style within an existing list changes that list's style. Converting a selection to a different list type affects selected items. Nested lists retain their own styles.
- List formatting survives undo/redo, saved HTML and exports. DOCX uses individual numbering definitions for reversed items because Word does not provide a descending list counter.

## Navigation

Menus group related commands and provide submenus for paragraph formats, alignment, list styles, line spacing and direction. Click or press Enter/Right to enter a submenu, and use its back button, Left or Escape to return. Up/Down and Home/End move between enabled commands. Typing a letter jumps to a matching command. Escape at the top level dismisses the menu and returns focus to its trigger.

**Find a command** searches translated command names and menu paths. Disabled actions remain visible but cannot execute. Search follows the configured `menubar` groups and readonly mode. It lists built-in menu actions, not third-party plugin commands. `help` is now a supported `menubar` identifier.

## Additional tools

**Format** includes line spacing and left-to-right/right-to-left paragraph direction. **Insert** includes special characters and emoji, locale-aware dates and times, ISO dates, nonbreaking spaces and explicit page breaks. Dates are inserted as static text. A dashed line marks page breaks while editing; PDF/print and DOCX use a real page break.

## Reference comparison

The [TinyMCE full-featured premium demo](https://www.tiny.cloud/docs/tinymce/latest/full-featured-premium-demo/) informed the menu organization and list controls. See the [current feature comparison](TINYMCE-COMPARISON.md) for implemented tools, partial support and remaining gaps, including DOCX import, footnotes and merge fields added after this update.
