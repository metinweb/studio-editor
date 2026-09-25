const copyButton = document.getElementById('copy-install')
copyButton.addEventListener('click', async () => {
  const code = document.getElementById('install-command')
  const status = document.getElementById('copy-status')
  try {
    await navigator.clipboard.writeText(code.textContent)
    status.textContent = 'Komutlar kopyalandı.'
  } catch {
    const range = document.createRange()
    range.selectNodeContents(code)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    status.textContent = 'Metin seçildi. Ctrl/Cmd+C ile kopyalayın.'
  }
})
