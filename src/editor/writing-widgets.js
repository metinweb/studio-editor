export const contentStyles = [
  { id: '', label: 'Normal metin', en: 'Normal text' },
  { id: 'lead', label: 'Giriş yazısı', en: 'Lead paragraph' },
  { id: 'info', label: 'Bilgi kutusu', en: 'Information' },
  { id: 'warning', label: 'Uyarı kutusu', en: 'Warning' },
  { id: 'success', label: 'Başarı kutusu', en: 'Success' },
]
export function validMention(id, label) {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= 120 &&
    typeof label === 'string' &&
    label.trim().length > 0 &&
    label.length <= 80 &&
    !/[\u0000-\u001f]/.test(id + label)
  )
}
export function normalizeWritingWidgets(root) {
  const doc = root.ownerDocument
  for (const control of root.querySelectorAll('[data-studio-task-control]')) {
    if (
      !control.matches('li > span:first-child') ||
      !control.parentElement.parentElement?.matches('ul[data-studio-task-list="true"]')
    )
      control.remove()
  }
  for (const list of root.querySelectorAll('ul[data-studio-task-list="true"]')) {
    for (const item of [...list.children].filter((n) => n.tagName === 'LI')) {
      const checked = item.dataset.studioChecked === 'true'
      item.dataset.studioChecked = String(checked)
      let control = item.firstElementChild
      if (!control?.hasAttribute('data-studio-task-control')) {
        control = doc.createElement('span')
        control.dataset.studioTaskControl = 'true'
        item.prepend(control)
      }
      control.textContent = ''
      control.setAttribute('contenteditable', 'false')
      control.setAttribute('role', 'checkbox')
      control.setAttribute('tabindex', '0')
      control.setAttribute('aria-checked', String(checked))
      control.setAttribute(
        'aria-label',
        item.textContent.trim().slice(0, 100) ||
          (doc.documentElement?.lang === 'en' ? 'Task' : 'Görev'),
      )
    }
  }
  for (const item of root.querySelectorAll('li[data-studio-checked]')) {
    if (!item.parentElement.matches('ul[data-studio-task-list="true"]'))
      item.removeAttribute('data-studio-checked')
  }
  for (const node of root.querySelectorAll('span[data-studio-mention]')) {
    const label = node.dataset.studioMentionLabel
    if (!validMention(node.dataset.studioMention, label)) {
      node.removeAttribute('data-studio-mention')
      node.removeAttribute('data-studio-mention-label')
      node.removeAttribute('contenteditable')
    } else {
      node.setAttribute('contenteditable', 'false')
      if (node.textContent !== `@${label}` || node.childElementCount) node.textContent = `@${label}`
    }
  }
  for (const node of root.querySelectorAll('[data-studio-style]')) {
    if (
      !node.matches('p,h1,h2,h3,h4,h5,h6,blockquote,li') ||
      !contentStyles.some((s) => s.id && s.id === node.dataset.studioStyle)
    )
      node.removeAttribute('data-studio-style')
  }
}
