import {
  mountStudioEditor,
  newUiElement,
  uiElementHtml,
  renderDocument,
} from './editor/studio-editor.js'
const status = document.querySelector('#status')
try {
  const form = newUiElement('form'),
    slider = newUiElement('slider'),
    accordion = newUiElement('accordion')
  form.columns = 2
  slider.items = [
    {
      title: 'Made for your website',
      text: 'Native HTML output. Add your own images and links in the slider builder.',
    },
    {
      title: 'Designed for touch',
      text: 'Swipe or scroll horizontally. Numbered links and keyboard navigation work without a script.',
    },
    {
      title: 'Your content, your CMS',
      text: 'Keep the editable definition alongside your article and publish when ready.',
    },
  ]
  accordion.items = [
    {
      title: 'Does the published page need Vue?',
      text: 'No. Forms, sliders and accordions use native HTML and CSS. No widget runtime is required.',
      open: true,
    },
    {
      title: 'Where are form responses sent?',
      text: 'To the POST endpoint you configure. This example has no backend and its form is disabled until an action URL is set.',
    },
    {
      title: 'Can I change the fields later?',
      text: 'Yes. Click the element in the editor to reopen the builder. Field names, options, ordering and settings are preserved.',
    },
  ]
  document.querySelector('#content').value =
    '<h1>More than a text block</h1><p>Click an element below to edit it, or add a new one using the buttons above.</p>' +
    [form, slider, accordion].map((config) => uiElementHtml(config)).join('') +
    '<p><br></p>'
  const editor = await mountStudioEditor('#content', {
    height: 720,
    onChange: () => {
      status.textContent = 'Unsaved example changes'
    },
  })
  for (const kind of ['form', 'slider', 'accordion'])
    document.querySelector(`#${kind}`).onclick = () => editor.openUiElement(kind)
  const documentHtml = () =>
    renderDocument({ title: 'Studio UI elements', content: editor.getHTML(), locale: 'en' })
  document.querySelector('#preview').onclick = () => {
    document.querySelector('#html').textContent = editor.getPublicHTML()
    document.querySelector('#published').srcdoc = documentHtml().replaceAll(
      'href="#',
      'href="about:srcdoc#',
    )
    document.querySelector('#preview-panel').hidden = false
    document.querySelector('#preview-panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  document.querySelector('#download').onclick = () => {
    const url = URL.createObjectURL(new Blob([documentHtml()], { type: 'text/html;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'studio-ui-elements.html'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  document.querySelectorAll('.ui-actions button').forEach((button) => {
    button.disabled = false
  })
  status.textContent = 'Editor ready'
  window.addEventListener('pagehide', () => editor.destroy(), { once: true })
} catch (error) {
  status.textContent = 'Could not load editor'
  document.querySelector('#error').hidden = false
  document.querySelector('#error').textContent = error.message
}
