# Math and chemistry

Open **Insert → Math & chemistry**, use the flask button in the insert toolbar group, or type `/science` in an empty paragraph. Rendering happens in your browser; expressions and drawings are not sent to an external service. MathJax and its glyph paths are bundled and loaded on first use.

## Equations and chemical notation

In **Mathematics**, enter LaTeX without `$` delimiters. Examples:

```tex
x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}
\int_0^1 x^2\,dx = \frac{1}{3}
\begin{pmatrix} a & b \\ c & d \end{pmatrix}
```

In **Chemical formula**, enter an [mhchem expression](https://docs.mathjax.org/en/latest/input/tex/extensions/mhchem.html). The editor wraps it in `\ce{…}`:

```tex
H2O
2H2 + O2 -> 2H2O
CH2=CH2
HC#CH
NH4+ + OH- <=> NH3 + H2O
```

The preview must finish successfully before insertion. Supported TeX packages are `base`, `ams` and `mhchem`; loading additional extensions, HTML, links and custom macro packages is disabled. Expressions are limited to 4,000 characters. Excessively large rendered diagrams are rejected.

## Molecules

Choose **Molecule drawing**. Add atoms by clicking/tapping empty canvas space. Select an element, then use **Draw bond** and select two atoms to connect them. Choose single, double or triple bonds. Click an existing bond to apply the selected order. **Move** drags atoms; **Delete** removes atoms and incident bonds, or individual bonds. Drawing undo/redo stays local until you insert/update the result.

Water, ethanol and benzene presets provide starting points. Presets replace the current drawing and can be undone. The drawing supports C, H, O, N, S, P, F, Cl, Br and I, up to 100 atoms and 150 bonds. It is a structural illustration tool: there is no valence validation, automatic hydrogen completion, stereochemistry, SMILES/MOL import/export or chemical calculation. Carbon-bound hydrogens in presets are implicit.

Keyboard users can add an atom at the center, Tab to atom controls and press Enter to select them, change the selected atom's element/X/Y coordinates, connect two atoms with Enter in Draw bond mode, and delete focused atoms/bonds with Delete. Focused bonds accept Enter to apply the chosen order.

## Editing, storage and export

Insert places a self-contained PNG with source metadata at the current selection. Double-click an inserted item, or select it and use the existing image edit control, to reopen its source. Resizing, document undo/redo, autosave, versions and workspace backups use the existing editor infrastructure. Cancel makes no document changes. If another edit changes the document while the dialog is open, close and reopen the dialog before applying the draft.

An optional accessible description becomes the image's alternative text. Without a description, equations use their source and molecules use a generic label. Provide a meaningful description for complex figures.

HTML retains the PNG and `data-studio-science` / `data-studio-source` attributes, so importing it back into Studio retains editability. Third-party sanitizers may strip these attributes, leaving an ordinary image. DOCX and PDF preserve the appearance as images, **not editable Word equations or molecular objects**. Rendered images have a white background and double-resolution rasterization.

## Vue component

```js
editorRef.value.openScience()
// Equivalent built-in plugin command:
editorRef.value.executeCommand('studio/science')
```

The dialog follows the instance's `locale`, `messages`, `readonly` and `disabled` settings. It is available through the `insert` toolbar/menu group; hiding UI does not remove the API. MathJax is a lazy chunk, so deployments must include all generated assets. CSP configurations must permit `img-src data: blob:` for local previews and inserted images.

Studio Editor remains MIT licensed. MathJax code and font assets retain their own licenses, included in `THIRD_PARTY_NOTICES.txt` in generated site and component distributions.
