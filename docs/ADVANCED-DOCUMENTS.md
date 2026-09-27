# Calculated tables, conditional fields and writing profiles

Added September 28, 2026. All tools support English and Turkish. No external service or credentials are required.

## Calculated table cells

Click a cell, then choose **Table → Table formula**. A preview shows the target address, current table values and the calculated result. Applying a formula replaces that cell’s contents. Double-click a calculated result to edit its formula or **Freeze result as text** to remove the calculation while retaining its current displayed value. Both actions support undo.

Examples: `=A2*B2`, `=SUM(C2:C5)`, `=ROUND(AVERAGE(B2:B5),2)`. Supported functions are `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `ROUND` and `ABS`, plus parentheses and `+ - * /`. Use English function names, commas between arguments and a dot as the decimal separator. Aggregates ignore text and blank cells; arithmetic requires numeric inputs. Display precision ranges from zero to eight decimal places; dependent calculations use the unrounded value.

Results update when table values change and survive saving, reload, undo and the JSON document model. Reference cycles, invalid syntax, division by zero and invalid references display errors. The parser does not evaluate JavaScript or access external data.

This is a bounded document-table calculator, not a spreadsheet engine. It supports one rectangular table per expression, no merged/nested cells, at most 5,000 cells (1,000 rows and 100 columns), 500-character expressions and bounded dependency evaluation. References use current cell positions. After the table’s dimensions or merged-cell structure change, formulas stay invalid until reopened and confirmed; they do not silently shift references. Sorting uses current positions. Imported partial tables may need their formulas reconfirmed.

Standalone HTML, PDF and Word show calculated values, with no external spreadsheet recalculation. HTML/Markdown imported back into Studio can retain formula metadata; Markdown uses an HTML table for calculated cells.

## Conditional template fields

Choose **Insert → Conditional field**. Give the field a name such as `Customer.Type`, select **Equals** or **Is not empty**, and enter the true/false text branches. Double-click the protected field to edit it.

Use **Insert → Merge fields** to fill the associated value. For example, `Customer.Type = business` can choose “Business customer”; other values choose “Individual customer”. Filling resolves regular and conditional fields together in one undo step. Only keys you fill are resolved. Matching is exact and case-sensitive. Branches are literal text, not HTML or executable expressions. Each comparison/branch is limited to 2,000 characters; nested condition languages are not supported.

Unresolved conditions survive HTML, Markdown and JSON-model storage. Word/PDF show their placeholders until filled. For reusable templates, save the document in the existing template library before resolving its fields.

## Named writing profiles

Open **Format → Permanent pen** or **Tools → Autocorrect & text shortcuts**, then expand **Writing profiles**. Save a named profile, load or delete an existing one, or download/import a JSON profile. Pen and correction profiles are separate types.

Saved profiles persist in the current browser’s local storage. They do not automatically enable editing tools on reload or modify another active editor. Loading/importing changes the dialog draft; **Apply settings** activates it for the current editor. Saving a draft profile is independent of applying it.

Up to 20 profiles and 600,000 serialized characters can be stored. Names must be unique within their profile type. Imports accept a single supported profile up to 800 KB. Storage failures appear in the dialog, and JSON export remains available. Browser profiles are not included in document/workspace backups; use profile JSON to transfer them.

## Validation

`tests/advanced-documents.spec.js` covers dependent calculations, cycle detection, structural invalidation/reconfirmation, reload, undo, freezing, conditional resolution/editing, literal text, profile persistence/import/export and mobile dialogs. Unit tests exercise the expression parser, condition limits and profile storage. Package tests verify portable schema data without derived editing attributes.
