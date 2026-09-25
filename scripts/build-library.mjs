process.env.NODE_ENV = 'production'
const { build } = await import('vite')
await build({ configFile: 'vite.library.config.js' })
