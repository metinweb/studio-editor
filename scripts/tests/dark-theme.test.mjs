import test from 'node:test'
import assert from 'node:assert/strict'
import postcss from 'postcss'
import { darkColor, darkSelector, darkThemeCss, parseColor } from '../dark-theme-css.mjs'

const luminance = (token) => {
  const [r, g, b] = parseColor(token).rgb.map((value) => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

test('surfaces darken, text lightens and readable pairs stay readable', () => {
  const pairs = [
    ['#fff', '#253343'],
    ['white', '#334155'],
    ['#f8fafc', '#64748b'],
    ['#eaf2ff', '#1d4ed8'],
    ['#e5eaf1', '#475467'],
  ]
  for (const [background, text] of pairs) {
    const bg = darkColor(background, 'bg'),
      fg = darkColor(text, 'text')
    assert.ok(luminance(bg) < 0.05, `${background} became a dark surface (${bg})`)
    assert.ok(luminance(fg) > luminance(text), `${text} became lighter (${fg})`)
    assert.ok(contrast(bg, fg) >= 4.5, `${fg} on ${bg} keeps WCAG AA contrast`)
  }
})

test('accents, already-dark surfaces, light text and alpha are preserved', () => {
  assert.equal(darkColor('#2563eb', 'bg'), '#2563eb')
  assert.equal(darkColor('#192436', 'bg'), '#192436')
  assert.equal(darkColor('#fff', 'text'), '#fff')
  assert.equal(darkColor('rgba(15, 23, 42, 0.12)', 'border'), 'rgba(15, 23, 42, 0.12)')
  assert.match(darkColor('rgba(255, 255, 255, 0.5)', 'bg'), /^rgb\(\d+ \d+ \d+ \/ 0\.5\)$/)
  assert.equal(darkColor('#e5eaf1', 'keep'), '#e5eaf1')
  assert.ok(luminance(darkColor('#dce1e9', 'border')) < 0.1)
})

test('dark selectors target the theme root or its descendants before pseudo-elements', () => {
  const marker = ':is([data-studio-theme=dark],[data-studio-theme=dark] *)'
  assert.equal(darkSelector('.a .b:hover'), `.a .b:hover${marker}`)
  assert.equal(darkSelector('.a::before'), `.a${marker}::before`)
  assert.equal(darkSelector('input::placeholder'), `input${marker}::placeholder`)
  assert.equal(darkSelector(':root'), `:root${marker}`)
})

test('the plugin adds overrides after the rule and skips document and keyframe CSS', async () => {
  const css = `
.panel { color: #253343; background: linear-gradient(#fff, #f8fafc); border: 1px solid #e5eaf1; padding: 4px }
.plain { padding: 4px }
@keyframes spin { from { color: #000 } }
@media (max-width: 600px) { .panel { background: white } }
:root { --border: #e9eaf0; --accent: #2563eb; --accent-light: #eaf2ff }`
  const result = await postcss([darkThemeCss()]).process(css, { from: 'src/style.css' })
  const output = result.css
  assert.match(output, /\.panel:is\(\[data-studio-theme=dark\],\[data-studio-theme=dark\] \*\) \{/)
  assert.doesNotMatch(output, /\.plain:is/)
  assert.doesNotMatch(output, /padding: 4px;?\s*\}\s*\.panel:is[^}]*padding/)
  assert.equal((output.match(/@keyframes/g) || []).length, 1)
  assert.doesNotMatch(output.split('@keyframes')[1].split('}')[0], /data-studio-theme/)
  assert.match(output, /@media \(max-width: 600px\) \{[^@]*\.panel:is/)
  const root = output.slice(output.lastIndexOf(':root'))
  assert.doesNotMatch(root, /--accent:/, 'accent tokens are kept')
  assert.match(root, /--border:/)
  assert.match(root, /--accent-light:/)
  const documentCss = await postcss([darkThemeCss()]).process('body { color: #000 }', {
    from: 'src/lib/document.css',
  })
  assert.doesNotMatch(documentCss.css, /data-studio-theme/)
})
