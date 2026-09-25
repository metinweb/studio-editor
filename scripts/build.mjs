// A parent process may set NODE_ENV=development. Production builds must not inherit it.
process.env.NODE_ENV = 'production'
const { build } = await import('vite')
await build()
