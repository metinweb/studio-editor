import test from 'node:test'
import assert from 'node:assert/strict'
import { createHttpAssistanceAdapter, readAssistanceStream } from '../../src/lib/assistance.js'

function sse(chunks, { contentType = 'text/event-stream' } = {}) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    }),
    { headers: { 'Content-Type': contentType } },
  )
}

test('stream deltas accumulate across split chunks and stop at DONE', async () => {
  const seen = []
  const result = await readAssistanceStream(
    sse([
      'data: {"delta":"Hel',
      'lo"}\n\n',
      'data: {"delta":" wor"}\r\n\r\ndata: {"delta":"ld"}\n\n',
      'data: [DONE]\n\n',
      'data: {"delta":"ignored"}\n\n',
    ]),
    { onText: (text) => seen.push(text) },
  )
  assert.equal(result.text, 'Hello world')
  assert.deepEqual(seen, ['Hello', 'Hello wor', 'Hello world'])
})

test('text events replace, comments are skipped and errors or bad events fail', async () => {
  assert.equal(
    (
      await readAssistanceStream(
        sse([': keep-alive\n\n', 'data: {"delta":"a"}\n\n', 'data: {"text":"Final"}']),
      )
    ).text,
    'Final',
  )
  await assert.rejects(
    readAssistanceStream(sse(['data: {"error":"Quota exceeded"}\n\n'])),
    /Quota exceeded/,
  )
  await assert.rejects(
    readAssistanceStream(sse(['data: not json\n\n'])),
    /Invalid assistance stream/,
  )
  await assert.rejects(
    readAssistanceStream(sse(['data: {"value":1}\n\n'])),
    /Invalid assistance stream/,
  )
  await assert.rejects(
    readAssistanceStream(sse([`data: ${JSON.stringify({ delta: 'x'.repeat(100001) })}\n\n`])),
    /too large/,
  )
})

test('aborting stops reading the stream', async () => {
  const controller = new AbortController()
  const encoder = new TextEncoder()
  const response = new Response(
    new ReadableStream({
      start(stream) {
        stream.enqueue(encoder.encode('data: {"delta":"first"}\n\n'))
      },
    }),
  )
  const reading = readAssistanceStream(response, {
    signal: controller.signal,
    onText: () => controller.abort(),
  })
  await assert.rejects(reading, { name: 'AbortError' })
})

test('the HTTP adapter streams only when asked and accepts JSON fallbacks', async () => {
  const calls = []
  const replies = [
    sse(['data: {"delta":"Streamed"}\n\n', 'data: [DONE]\n\n']),
    new Response(JSON.stringify({ text: 'Plain' }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  ]
  const adapter = createHttpAssistanceAdapter({
    baseUrl: 'https://cms.example/api/assist',
    stream: true,
    fetch: async (url, options) => {
      calls.push([url, options.headers.Accept])
      return replies.shift()
    },
  })
  const parts = []
  const signal = new AbortController().signal
  const streamed = await adapter.generate(
    { text: 'Hi', action: 'rewrite' },
    { signal, onText: (text) => parts.push(text) },
  )
  assert.deepEqual(streamed, { text: 'Streamed' })
  assert.deepEqual(parts, ['Streamed'])
  assert.deepEqual(await adapter.generate({ text: 'Hi' }, { signal }), { text: 'Plain' })
  assert.equal(calls[0][1], 'text/event-stream, application/json')
  const plain = createHttpAssistanceAdapter({
    baseUrl: 'https://cms.example/api/assist',
    fetch: async (url, options) => {
      calls.push([url, options.headers.Accept])
      return new Response(JSON.stringify({ issues: [] }))
    },
  })
  await plain.check({ text: 'Hi' }, { signal })
  assert.equal(calls.at(-1)[1], 'application/json')
})
