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

Choose **Molecule drawing**. The workspace opens in **Move** mode with labeled tools, an element palette and a ring tray. On mobile, the ring tray sits above the canvas.

- **Drag and drop:** drag an element from the palette onto the canvas to add it, or onto an atom to replace its element. Drag a ring card onto the canvas to place it. A preview follows your pointer. Dropping outside the canvas leaves the drawing unchanged; Escape cancels the drag.
- **Move:** grab a chain atom to reposition it, or grab any bond to move the entire connected molecule without changing its geometry. Ring atoms are rigid handles: dragging a ring corner moves the whole connected structure, preserving all ring lengths and angles. This protection also applies to arrow keys and X/Y fields, including older saved drawings and fused rings. Other disconnected structures stay put. Select an atom and drag its **+** handle to extend a branch without switching tools. Dragging on empty canvas creates a first bond.
- **Tidy structure:** recalculate a clean 2D layout, including previously distorted rings. Atom elements, bonds and bond orders are preserved. Undo restores the previous geometry. Deliberately deleting ring atoms or bonds opens the ring; open chains can be edited freely.

- **Draw bond:** drag on empty space for the first bond, then drag from an existing atom to extend a chain. Release near another atom to connect to it. Click/tap two atoms to connect them without dragging. Bond lengths are standardized and angles snap in 30° steps; hold Alt for a free angle and length.
- **Add atom:** click empty space to place the chosen element, or click an existing atom to replace it. Choosing a palette element also changes the selected atom.
- **Bonds and rings:** select single/double/triple bonds, then click a bond to apply that order. Choose a five-membered, six-membered or benzene ring tool and click empty space to add a separate ring. Connect it to your structure with the bond tool. Rings are not automatically fused.
- **Delete:** delete atoms with their incident bonds, or individual bonds. Escape cancels an in-progress gesture. Center drawing fits and centers the existing geometry without computing a new chemical layout.
- **Skeletal carbons:** hide connected carbon labels and show the familiar line-angle structure. Isolated carbons and other elements remain labeled; oxygen, nitrogen and other elements have distinct colors. Ring double bonds point inward. This display choice is saved and applies to exports as well.

Undo/redo treats each completed drag or ring placement as one step and stays local until you insert/update the result. The small document preview shows the exported appearance without selection handles or canvas dots.

Water, ethanol and benzene presets provide starting points. Presets replace the current drawing and can be undone. The drawing supports C, H, O, N, S, P, F, Cl, Br and I, up to 100 atoms and 150 bonds. Manual drawing does not validate valence or automatically complete hydrogens. Charges, isotopes, radicals, stereochemistry, MOL files and chemical calculations are not supported. Carbon-bound hydrogens in presets are implicit.

### Text to structure

Open **From text**, enter a recognized formula/name or SMILES, and choose **Draw structure**. Conversion replaces the current draft in one undoable step. It uses a lazy-loaded, locally bundled [OpenChemLib](https://github.com/cheminfo/openchemlib-js) parser and coordinate generator; no structure is sent to an external service.

- **Auto** recognizes a small catalog of common names and condensed formulas, such as `water`, `ethanol`, `CH₃CH₂OH`, `CH3COOH` and `CH3COCH3`. Unicode subscripts are accepted.
- A recognized molecular formula presents named structure choices. For example, `C2H6O` offers ethanol and dimethyl ether. These are common examples, not a complete isomer search; composition alone cannot determine connectivity. Even a formula with one listed example requires selecting that structure.
- **SMILES** explicitly interprets input as SMILES, e.g. `CCO`, `CC(=O)O`, `c1ccccc1`, `C1CCCCC1`. Use this mode for strings such as `CO` that could also be read as a molecular formula. Branches, rings, aromatic bonds and single/double/triple bonds are supported.
- SMILES imports validate atom valences. Hydrogens on heteroatoms and isolated atoms are drawn explicitly; carbon-bound hydrogens otherwise remain implicit. Unsupported elements, charges, isotope/radical/stereo annotations and invalid/oversized input are rejected without replacing the existing drawing. Input is limited to 1,000 characters and the resulting graph to 100 atoms/150 bonds.

The **Chemical formula** tab remains for typesetting formulas and reactions with mhchem. **From text** creates an editable molecule graph.

Keyboard users can add an atom at the center, Tab to atom controls and press Enter to select them, change the selected atom's element/X/Y coordinates, connect two atoms with Enter in Draw bond mode, and delete focused atoms/bonds with Delete. In Draw bond mode, focused bonds accept Enter to apply the chosen order. While the canvas or an atom is focused: B selects bonds, V selects Move, E selects Delete, 1/2/3 selects bond order, C/N/O/H/S/P/F/I selects an element, arrow keys move the selected atom by 2 units (Shift: 10), and Ctrl/Cmd+Z or Shift+Ctrl/Cmd+Z undo/redo drawing changes. Shortcuts do not capture typing in form fields.

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

Studio Editor remains MIT licensed. MathJax code/font assets and OpenChemLib (BSD-3-Clause) retain their own licenses, included in `THIRD_PARTY_NOTICES.txt` in generated site and component distributions.
