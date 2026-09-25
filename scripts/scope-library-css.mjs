// Prefix library UI only. The iframe's document CSS must remain unscoped.
export function scopeLibraryCss() {
  return {
    postcssPlugin: 'studio-editor-library-scope',
    Once(root) {
      if (/[/\\]document\.css(?:\?|$)/.test(root.source?.input.file || '')) return
      const scope = ':where(.studio-editor-scope)'
      root.walkRules((rule) => {
        if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
        rule.selectors = rule.selectors.map((selector) => {
          if (selector === ':root' || selector === 'body') return scope
          // Popovers teleport to body, so their own root carries the scope.
          if (/^\.editor-popover\b/.test(selector))
            return selector.replace('.editor-popover', `.editor-popover${scope}`)
          if (/^\.studio-writing-menu\b/.test(selector))
            return selector.replace('.studio-writing-menu', `.studio-writing-menu${scope}`)
          if (/^\.studio-editor-embed\b/.test(selector))
            return selector.replace('.studio-editor-embed', `.studio-editor-embed${scope}`)
          return `${scope} ${selector}`
        })
      })
      root.walkAtRules(/keyframes$/i, (rule) => {
        rule.params = `studio-editor-${rule.params}`
      })
      root.walkDecls(/^animation(?:-name)?$/, (declaration) => {
        declaration.value = declaration.value.replace(/\bspin\b/g, 'studio-editor-spin')
      })
    },
  }
}
