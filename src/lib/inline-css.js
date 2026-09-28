import { publicHtml } from './content'

// Snapshot supported presentation properties at the editor's current viewport.
// No stylesheet fetching/CSSOM access is needed, including for cross-origin CSS.
const properties =
  'color background-color font-family font-size font-weight font-style line-height letter-spacing text-align text-decoration text-transform vertical-align white-space border-top border-right border-bottom border-left border-collapse border-spacing padding-top padding-right padding-bottom padding-left margin-top margin-right margin-bottom margin-left list-style-type'.split(
    ' ',
  )
export function inlineContentHtml(root) {
  if (!root) return ''
  const clone = root.cloneNode(true)
  const source = [root, ...root.querySelectorAll('*')]
  const target = [clone, ...clone.querySelectorAll('*')]
  if (source.length > 20000) throw new Error('Inline CSS export supports up to 20,000 elements.')
  source.forEach((element, index) => {
    if (element.closest('[data-studio-page],[data-studio-embed]')) return
    const styles = root.ownerDocument.defaultView.getComputedStyle(element)
    for (const property of properties) {
      const value = styles.getPropertyValue(property)
      if (value && !/url\(|expression\(/i.test(value))
        target[index].style.setProperty(property, value)
    }
  })
  const wrapper = root.ownerDocument.createElement('div')
  wrapper.style.cssText = clone.style.cssText
  wrapper.style.removeProperty('zoom')
  wrapper.innerHTML = clone.innerHTML
  return publicHtml(wrapper.outerHTML)
}
