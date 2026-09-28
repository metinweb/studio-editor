import test from 'node:test'
import assert from 'node:assert/strict'
import { createAutosaveSession } from '../../src/lib/autosave.js'
import { createHttpDocumentAdapter } from '../../src/lib/http-document-adapter.js'
import { createHttpAssistanceAdapter, validateAssistanceResult } from '../../src/lib/assistance.js'
import { pageEmbedOptions, pageEmbedHtml } from '../../src/lib/page-embed.js'
import { normalizeBodyClass } from '../../src/lib/content-css.js'
import { bindDocumentSession } from '../../src/lib/cms-binding.js'
const wait = (ms = 140) => new Promise((resolve) => setTimeout(resolve, ms))

test('binding refuses late loads after user edits or host unmount', async () => {
  for (const abort of [false, true]) {
    let finish,
      revision = 1,
      applied = false
    const controller = new AbortController()
    const editor = {
      getDocument: () => ({ revision }),
      setHTML: () => {
        applied = true
      },
      subscribeTransactions: () => () => {},
    }
    const pending = bindDocumentSession(editor, {
      id: 'one',
      signal: controller.signal,
      adapter: {
        load: () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      },
    })
    const rejected = assert.rejects(
      pending,
      abort ? { name: 'AbortError' } : /Local edits are preserved/,
    )
    if (abort) controller.abort()
    else revision++
    finish(record())
    await rejected
    assert.equal(applied, false)
  }
})
const record = (id = 'one', version = 'v1', html = '<p>One</p>') => ({
  id,
  version,
  html,
  title: 'One',
  blockIds: [],
})

test('autosave debounces and keeps edits typed while a save is pending', async () => {
  const calls = []
  let finish
  const session = createAutosaveSession(
    {
      load: async () => record(),
      save: async (value, options) => {
        calls.push({ value, options })
        return new Promise((resolve) => {
          finish = resolve
        })
      },
    },
    { delay: 100 },
  )
  await session.load('one')
  session.update({ html: 'first' })
  session.update({ html: 'second' })
  await wait()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].value.html, 'second')
  session.update({ html: 'third' })
  finish(record('one', 'v2', 'second'))
  await wait()
  assert.equal(calls.length, 2)
  assert.equal(calls[1].options.expectedVersion, 'v2')
  assert.equal(calls[1].value.html, 'third')
  finish(record('one', 'v3', 'third'))
  await wait(0)
  assert.equal(session.state.dirty, false)
  assert.equal(session.state.status, 'saved')
  session.dispose()
})
test('conflicts retain local text and suspend retries, including later edits', async () => {
  let calls = 0
  const session = createAutosaveSession(
    {
      load: async () => record(),
      save: async () => {
        calls++
        throw Object.assign(new Error('conflict'), { status: 412 })
      },
    },
    { delay: 100 },
  )
  await session.load('one')
  session.update({ html: 'local' })
  await wait()
  assert.equal(session.state.status, 'conflict')
  assert.equal(session.state.record.html, 'local')
  session.update({ html: 'more local' })
  await wait()
  assert.equal(calls, 1)
  assert.equal(session.state.dirty, true)
  await assert.rejects(session.load('two'))
  await assert.rejects(session.retry())
  assert.equal(calls, 2)
  session.dispose()
})
test('manual pause survives a pending save; disposal cancels scheduled writes', async () => {
  let finish,
    calls = 0
  const session = createAutosaveSession(
    {
      load: async () => record(),
      save: () => {
        calls++
        return new Promise((resolve) => {
          finish = resolve
        })
      },
    },
    { delay: 100 },
  )
  await session.load('one')
  session.update({ html: 'a' })
  const pending = session.save()
  await wait(0)
  session.update({ html: 'b' })
  session.pause()
  finish(record('one', 'v2', 'a'))
  await pending
  await wait()
  assert.equal(calls, 1)
  assert.equal(session.state.dirty, true)
  session.resume()
  session.dispose()
  await wait()
  assert.equal(calls, 1)
})
test('obsolete load failures and history responses cannot replace a newer document', async () => {
  let fail, history
  const session = createAutosaveSession({
    load: (id) =>
      id === 'old'
        ? new Promise((_, reject) => {
            fail = reject
          })
        : Promise.resolve(record(id)),
    listVersions: () =>
      new Promise((resolve) => {
        history = resolve
      }),
  })
  const old = session.load('old')
  const rejected = assert.rejects(old)
  await session.load('new')
  fail(new Error('old failed'))
  await rejected
  assert.equal(session.state.record.id, 'new')
  assert.equal(session.state.status, 'saved')
  const versions = session.listVersions()
  const stale = assert.rejects(versions, /changed/)
  await session.load('another')
  history([])
  await stale
  session.dispose()
})
test('HTTP document adapter sends atomic version and surfaces conflict status', async () => {
  const calls = []
  const adapter = createHttpDocumentAdapter({
    baseUrl: 'https://cms.example/api',
    getToken: async () => 'fixture-token',
    fetch: async (url, options) => {
      calls.push({ url, options })
      return new Response('{}', { status: 412 })
    },
  })
  await assert.rejects(
    adapter.save(record('a/b'), { expectedVersion: 'v1' }),
    (error) => error.status === 412,
  )
  assert.equal(calls[0].url, 'https://cms.example/api/documents/a%2Fb')
  assert.equal(calls[0].options.headers['If-Match'], '"v1"')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer fixture-token')
  assert.throws(() => createHttpDocumentAdapter({ baseUrl: 'https://user:password@example.com' }))
})
test('assistance validates Unicode offsets and rejects malformed/provider HTML as structure', async () => {
  assert.deepEqual(validateAssistanceResult({ text: '<b>Literal text</b>' }, 'ai', 'abc'), {
    text: '<b>Literal text</b>',
  })
  assert.throws(() =>
    validateAssistanceResult(
      { issues: [{ offset: 2, length: 10, message: 'x', replacements: [] }] },
      'language',
      'abc',
    ),
  )
  const issue = { offset: 3, length: 3, message: 'Spelling', replacements: ['the'] }
  assert.equal(
    validateAssistanceResult({ issues: [issue] }, 'language', '😀 teh').issues[0].offset,
    3,
  )
  let calls = 0
  const adapter = createHttpAssistanceAdapter({
    baseUrl: 'https://cms.example/help',
    fetch: async (_url, options) => {
      calls++
      assert.equal(JSON.parse(options.body).text, 'hello')
      return Response.json({ text: 'hi' })
    },
  })
  assert.equal(calls, 0)
  assert.deepEqual(
    await adapter.generate({ text: 'hello' }, { signal: new AbortController().signal }),
    { text: 'hi' },
  )
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(adapter.generate({ text: 'hello' }, { signal: controller.signal }), {
    name: 'AbortError',
  })
  assert.equal(calls, 1)
})
test('page embeds always derive a restricted HTTPS frame and escape attribute content', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hi',
    'http://example.com',
    'https://user:pass@example.com',
  ])
    assert.equal(pageEmbedOptions(url), null)
  const html = pageEmbedHtml(
    'https://example.com',
    { title: '"><script>bad</script>', height: 99999 },
    true,
  )
  assert.match(html, /sandbox=""/)
  assert.doesNotMatch(html, /<script>|allow-scripts/)
  assert.match(html, /height:1200px/)
  assert.doesNotMatch(pageEmbedHtml('https://example.com'), /iframe/)
  assert.equal(normalizeBodyClass('article article x" onload=x prose'), 'article prose')
})
