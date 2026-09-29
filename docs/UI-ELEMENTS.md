# Native HTML UI elements

Build **forms, sliders and accordions** inside Studio Editor. Published elements use native HTML and inline CSS, with **no Vue component or JavaScript widget runtime required**. The builder UI is part of the editor; the output works in ordinary HTML pages and in Vue-rendered content. [Türkçe](UI-ELEMENTS.tr.md) · [Live playground](https://metinweb.github.io/studio-editor/integration/ui.html).

## Using the builders

Choose **Insert → Form builder / Slider builder / Accordion builder**. Click an existing element to edit it, or focus its card and press Enter/Space. Edits and removal create undo steps. The builder refuses to apply a draft after the underlying document changes. Cancel leaves the original untouched. UI element cards in the editing canvas are protected; use **Try preview** to interact with native controls.

The builder has three tabs:

- **Build:** a compact outline, focused properties and a live preview on wide screens. Use **Add a field** to search the field picker; sliders and accordions have **Add slide / Add section**. Select an item or use the previous/next buttons. Duplicate/delete actions stay visible below the properties.
- **Settings:** title, description, accent color and element-specific options.
- **Try preview:** desktop/mobile layout and actual native controls in an isolated iframe. Form submissions are blocked by the preview sandbox. No script or external widget runtime runs.

Changes update the preview after a short typing pause. While a draft contains invalid settings, the last valid preview stays visible. Saving selects the first affected item and focuses its invalid control. The preview lets you test forms even before connecting a submission URL; published forms still remain disabled without one.

Reorder with mouse/touch handles, up/down buttons, or the arrow keys while a handle is focused. Long outlines scroll when a dragged handle reaches their edge. **Undo delete** restores the last deleted item without discarding other edits. Cancel, Escape and the close button ask before discarding changed drafts. On phones, switch between the item list and **Edit item**, and open **Try preview** separately; save actions remain visible. On medium-width screens the preview is also available through its tab.

Dropdown and radio choices have individual inputs and add/remove buttons. **Edit choices in bulk** accepts one choice per line. Slider outlines include image thumbnails; accordion outlines show their initial open/closed state.

## Forms

Up to **40 fields**. Types: short text, email, phone, website URL, number, date, long text, dropdown, radio group, checkbox/consent and a **range slider**. Labels, field names, placeholders, help text, required flags and full-width rows are configurable. Dropdown/radio options use one option per line (1–30 unique, nonempty options). Number/range fields have minimum, maximum and positive step. Textarea input is limited to 10,000 characters in generated forms.

Field names must be unique, start with a letter and contain only ASCII letters, digits or underscores (maximum 64 characters). They become the submitted `name` keys. Labels are associated with controls; help uses `aria-describedby`; radio groups use `fieldset`/`legend`. Native browser validation handles required/email/URL/number constraints. Phone format and application-specific constraints must be checked on the server.

Choose one or two responsive columns. Full-width fields span both columns; narrow layouts automatically stack. The form always uses **POST** with native URL-encoded submission. Set **Settings → Submission URL (POST)** to an HTTPS URL or root-relative path such as `/api/contact`. An empty action produces a disabled form, preventing accidental submission to the article URL. Password, hidden, file-upload and arbitrary script fields are not supported.

Your endpoint must validate and authorize submissions, handle spam/rate limiting, implement any required CSRF protection and return its own success/error page. Studio does **not** collect responses, send email, deploy a backend, add a CAPTCHA or create a response dashboard. If your CMS requires a hidden CSRF token, inject it server-side into the rendered form; don't store secrets in the editable definition. A checkbox is a normal field, not a consent-record management service. Conditional fields, multistep forms and custom regular-expression validation are not included in this version.

Do not put published forms inside another `<form>`; use the editor's non-submitting representation when embedding the editor in an existing CMS form. Host CSS or a CSP that blocks form actions can change/prevent the published behavior.

## Sliders

Up to **20 slides**, with title, plain text, optional image URL, required image alt text, optional link and link label. Images/links accept HTTPS or root-relative URLs. Set one, two or three visible desktop cards and an image ratio of 16:9, 4:3 or 1:1. Smaller screens reduce the visible area and allow horizontal scrolling.

The published track uses CSS scroll snapping, touch scrolling, keyboard focus and numbered anchor links. Slides do not autoplay. There is no infinite loop, automatic height animation or external carousel dependency. This is an image/content slider; numeric sliders are separately available as form range fields. An empty image uses a numbered placeholder. Current input is by URL; image upload/asset selection is still handled separately by the existing media library.

## Accordions

Up to **20 sections**, each with a title, plain text body and initially-open flag. Published output uses native `<details>` / `<summary>` and works with keyboard/touch without scripts. Sections open independently; opening one does not forcibly close the others. Text is escaped; arbitrary HTML is not executed.

## HTML and Vue APIs

All three tools are enabled by default. They respect `readonly`, `disabled` and the independent `features.uiElements` switch. Hiding toolbar/menu groups alone is still a layout setting.

```js
const editor = await mountStudioEditor('#content', {
  locale: 'en',
  features: { uiElements: true },
})
editor.openUiElement('form')
editor.openUiElement('slider')
editor.openUiElement('accordion')
editor.setOptions({ features: { uiElements: false } })
```

Vue: `<StudioEditor :features="{ uiElements: true }" />`; the component ref exposes the same `openUiElement` method. See [CMS integration](CMS-INTEGRATION.md) for setup and styles. Enforce publishing/content permissions in your CMS backend; feature switches are editing controls.

Programmatic definition:

```js
import { newUiElement, uiElementHtml, normalizeUiElement } from 'studio-editor'

const form = newUiElement('form', 'en')
form.title = 'Request a quote'
form.action = '/api/quote'
form.columns = 2
form.fields.push({
  type: 'range',
  name: 'budget',
  label: 'Budget',
  min: 100,
  max: 5000,
  step: 100,
})
editor.insertHTML(uiElementHtml(form))

const definition = normalizeUiElement(form) // validates/canonicalizes; throws on invalid input
const standalone = uiElementHtml(definition, 'public')
```

Exports: `newUiElement`, `normalizeUiElement`, `uiElementHtml`, `uiFieldTypes`; typed `UiElement`, `UiForm`, `UiSlider`, `UiAccordion`, `UiField` and `UiFieldType`. The browser build exposes the same functions without an npm/runtime dependency on the host page.

## Storage and publishing

**Store `editor.getHTML()` (or Vue `v-model`) for editing. Publish `editor.getPublicHTML()`.** Editable HTML contains a canonical `figure[data-studio-ui]` with a versioned JSON definition in `data-studio-ui-config` and a non-submitting card. The JSON document model stores a portable figure rather than interactive DOM controls. Loading through `setHTML`/`setModel` reconstructs the editing view. Form answers are never part of the definition.

`getPublicHTML()` reconstructs native forms, slides and details from validated metadata. The public output retains the definition for later editing; if your CMS strips `data-studio-*` attributes, save the editable source separately. You may publish the returned HTML directly, or call `renderDocument({ title, content: editor.getHTML(), locale: 'en' })` for a complete HTML document. HTML download in the playground uses that function. DOCX/Markdown/PDF formats do not preserve interactive widget behavior.

Generated IDs scope labels, help and slide anchors to an element. Duplicated definitions within one document receive distinct prefixes. If combining independently exported fragments on one page, preserve their unique element IDs. The editor sanitizes pasted/source HTML, then reconstructs only validated widgets; it does not generally permit arbitrary form/iframe/script markup.

Supported styles are embedded in generated markup. No stylesheet import, CDN or runtime script is required for the widgets; your own global CSS can still affect native elements. Publishing from a separately sandboxed iframe requires your host to choose its own form/navigation policy.

## Verification

Unit tests cover limits, field names, unsafe URLs, escaping, field types and canonical schemas. Site and installed-package tests cover pointer reordering, native POST data, blocked preview submissions, slider navigation, accordion interaction, source/JSON round-trips, duplicate IDs, stale edits, readonly/feature switches, keyboard reopening and mobile Turkish layout. The public playground makes the same behavior reviewable without a backend.
