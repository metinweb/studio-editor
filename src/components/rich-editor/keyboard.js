/** Roving focus between toolbar buttons with arrows, Home and End. */
export function toolbarKeys(event) {
  if (
    !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) ||
    event.target.tagName !== 'BUTTON'
  )
    return
  const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
  const index = buttons.indexOf(event.target)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
  event.preventDefault()
  buttons[next]?.focus()
}

/**
 * Vertical menu keys plus type-to-select for typography lists.
 * `menuOpen` is true while a menubar menu is open, so left/right switches menus.
 */
export function menuKeys(event, { popup, menuOpen, switchMenu, locale }) {
  if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return
  if (
    ['fonts', 'sizes', 'blocks'].includes(popup) &&
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    event.key !== ' '
  ) {
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    const index = buttons.indexOf(event.target)
    const ordered = [...buttons.slice(index + 1), ...buttons.slice(0, index + 1)]
    const match = ordered.find((button) =>
      button.textContent
        .trim()
        .toLocaleLowerCase(locale)
        .startsWith(event.key.toLocaleLowerCase(locale)),
    )
    if (match) {
      event.preventDefault()
      match.focus()
    }
    return
  }
  if (menuOpen && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault()
    switchMenu(event.key === 'ArrowRight' ? 1 : -1)
    return
  }
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
  const index = buttons.indexOf(event.target)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
  event.preventDefault()
  buttons[next]?.focus()
}

/**
 * Keeps the editor selection when a toolbar or menu button is pressed with a mouse or pen.
 * Touch is left alone: WebKit (iOS) cancels the click when pointerdown is prevented.
 */
export function keepSelection(event) {
  if (event.pointerType !== 'touch') event.preventDefault()
}
