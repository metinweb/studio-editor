// Generates the dark interface theme from the light stylesheets at build time.
// Every rule with colors gets a sibling rule that only applies inside
// [data-studio-theme="dark"] and remaps each color by its role: surfaces darken,
// text lightens, borders move to mid tones and saturated accents are kept.
// The editing iframe's document.css is skipped: documents keep their own colors.

const marker = ':is([data-studio-theme=dark],[data-studio-theme=dark] *)'
const neutralHue = 218
const neutralSaturation = 0.16
const named = { white: [255, 255, 255], black: [0, 0, 0] }
const colorPattern =
  /#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|#[0-9a-f]{3,4}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black)\b/gi

export function parseColor(token) {
  const text = token.toLowerCase()
  if (named[text]) return { rgb: named[text], alpha: 1 }
  if (text.startsWith('#')) {
    let hex = text.slice(1)
    if (hex.length <= 4) hex = [...hex].map((digit) => digit + digit).join('')
    const values = hex.match(/../g).map((pair) => parseInt(pair, 16))
    return { rgb: values.slice(0, 3), alpha: values.length === 4 ? values[3] / 255 : 1 }
  }
  const parts = text
    .replace(/^[a-z]+\(|\)$/g, '')
    .split(/[\s,/]+/)
    .filter(Boolean)
  if (parts.length < 3) return null
  const alphaPart = parts[3]
  const alpha =
    alphaPart === undefined
      ? 1
      : alphaPart.endsWith('%')
        ? parseFloat(alphaPart) / 100
        : parseFloat(alphaPart)
  if (text.startsWith('hsl')) {
    const [h, s, l] = [parseFloat(parts[0]), parseFloat(parts[1]) / 100, parseFloat(parts[2]) / 100]
    return { rgb: fromHsl(h, s, l), alpha }
  }
  const rgb = parts
    .slice(0, 3)
    .map((part) => (part.endsWith('%') ? (parseFloat(part) * 255) / 100 : parseFloat(part)))
  if (rgb.some((value) => !Number.isFinite(value))) return null
  return { rgb, alpha: Number.isFinite(alpha) ? alpha : 1 }
}
function toHsl([r, g, b]) {
  ;[r, g, b] = [r / 255, g / 255, b / 255]
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) * 60
      : max === g
        ? ((b - r) / d + 2) * 60
        : ((r - g) / d + 4) * 60
  return { h, s, l }
}
function fromHsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)].map((value) => Math.round(value * 255))
}
function format(rgb, alpha) {
  const [r, g, b] = rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))))
  if (alpha >= 1)
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
  return `rgb(${r} ${g} ${b} / ${+alpha.toFixed(3)})`
}

/** Maps one color for a role: 'bg', 'text', 'border' or 'keep'. */
export function darkColor(token, role) {
  const color = parseColor(token)
  if (!color || role === 'keep') return token
  let { h, s, l } = toHsl(color.rgb)
  const neutral = s < 0.12
  const tint = () => {
    if (neutral) {
      h = neutralHue
      s = neutralSaturation
    }
  }
  if (role === 'bg') {
    if (l < 0.5 || (s > 0.5 && l < 0.62)) return token
    l = 0.115 + (1 - l) * 0.5
    s = Math.min(s * 0.5, 0.45)
    tint()
  } else if (role === 'text') {
    if (l >= 0.6) return token
    if (s > 0.5 && l > 0.35) l = Math.min(0.78, l + 0.17)
    else {
      l = 0.93 - l * 0.55
      s *= 0.7
      if (neutral) {
        h = neutralHue
        s = 0.12
      }
    }
  } else {
    if (l < 0.5 || (s > 0.5 && l < 0.65)) return token
    l = 0.22 + (1 - l) * 0.55
    s = Math.min(s * 0.5, 0.4)
    tint()
  }
  return format(fromHsl(h, s, l), color.alpha)
}

function roleOf(property, value) {
  const name = property.toLowerCase()
  if (name.startsWith('--')) {
    if (/bg|background|surface|light|sidebar|panel|canvas|paper|soft|tint|hover/.test(name))
      return 'bg'
    if (/border|line|divider|ring|outline|shadow/.test(name)) return 'border'
    if (/accent|primary|brand|focus/.test(name)) return 'keep'
    if (/text|muted|fg|ink|foreground|color$/.test(name)) return 'text'
    const color = parseColor(value.match(colorPattern)?.[0] || '')
    if (!color) return null
    const { l } = toHsl(color.rgb)
    return l > 0.6 ? 'bg' : l < 0.4 ? 'text' : 'keep'
  }
  if (/^(color|caret-color|-webkit-text-fill-color|text-decoration(-color)?|stroke)$/.test(name))
    return 'text'
  if (/^(background(-color|-image)?|fill)$/.test(name)) return 'bg'
  if (/^(border|outline|box-shadow|column-rule|text-shadow)/.test(name)) return 'border'
  return null
}

const pseudoElement =
  /((?:::?(?:before|after|placeholder|selection|marker|backdrop|first-line|first-letter|file-selector-button)|::-(?:webkit|moz)-[\w-]+)(?:\([^)]*\))?)+$/i
export function darkSelector(selector) {
  const match = selector.match(pseudoElement)
  if (!match) return `${selector}${marker}`
  return `${selector.slice(0, match.index)}${marker}${match[0]}`
}

export function darkThemeCss({ skip = /[/\\]document\.css(?:\?|$)/ } = {}) {
  return {
    postcssPlugin: 'studio-editor-dark-theme',
    Once(root) {
      if (skip.test(root.source?.input.file || '')) return
      const generated = []
      root.walkRules((rule) => {
        if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
        if (rule.selectors.some((selector) => selector.includes('data-studio-theme'))) return
        const declarations = []
        rule.each((node) => {
          if (node.type !== 'decl') return
          const role = roleOf(node.prop, node.value)
          if (!role || role === 'keep') return
          const value = node.value.replace(colorPattern, (token) => darkColor(token, role))
          if (value !== node.value) declarations.push(node.clone({ value }))
        })
        if (declarations.length) generated.push([rule, declarations])
      })
      for (const [rule, declarations] of generated) {
        const dark = rule.clone({ nodes: [] })
        dark.selectors = rule.selectors.map(darkSelector)
        dark.append(declarations)
        rule.after(dark)
      }
    },
  }
}
darkThemeCss.postcss = true
