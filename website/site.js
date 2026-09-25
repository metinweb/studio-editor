const copyButton = document.getElementById('copy-install')
const turkish = document.documentElement.lang === 'tr'
copyButton.addEventListener('click', async () => {
  const code = document.getElementById('install-command')
  const status = document.getElementById('copy-status')
  try {
    await navigator.clipboard.writeText(code.textContent)
    status.textContent = turkish ? 'Komutlar kopyalandı.' : 'Commands copied.'
  } catch {
    const range = document.createRange()
    range.selectNodeContents(code)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    status.textContent = turkish
      ? 'Metin seçildi. Ctrl/Cmd+C ile kopyalayın.'
      : 'Text selected. Press Ctrl/Cmd+C to copy.'
  }
})
