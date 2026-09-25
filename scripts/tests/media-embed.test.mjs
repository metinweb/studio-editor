import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMediaEmbed, mediaEmbedHtml } from '../../src/lib/media-embed.js'

test('provider URL normalization preserves timestamps and private Vimeo hashes', () => {
  for (const url of [
    'https://youtu.be/M7lc1UVf-VE?t=1m30s',
    'https://www.youtube.com/watch?v=M7lc1UVf-VE&t=90',
    'https://www.youtube.com/shorts/M7lc1UVf-VE?start=90',
  ]) {
    assert.equal(
      parseMediaEmbed(url).src,
      'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?start=90',
    )
  }
  assert.equal(
    parseMediaEmbed('https://vimeo.com/123456789/5e2d1c1e6d').src,
    'https://player.vimeo.com/video/123456789?h=5e2d1c1e6d',
  )
  assert.equal(
    parseMediaEmbed('https://player.vimeo.com/video/123456789?h=5e2d1c1e6d&autoplay=1').url,
    'https://vimeo.com/123456789/5e2d1c1e6d',
  )
})
test('untrusted schemes, hosts, credentials, ports and non-video paths are rejected', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,test',
    '//youtu.be/M7lc1UVf-VE',
    'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE',
    'https://youtube.com@evil.test/watch?v=M7lc1UVf-VE',
    'https://user:pass@youtube.com/watch?v=M7lc1UVf-VE',
    'https://youtube.com:8443/watch?v=M7lc1UVf-VE',
    'https://vimeo.com/1234/not-a-hash',
    'https://youtube.com/playlist?list=abc',
    '<iframe src="https://youtube.com"></iframe>',
  ])
    assert.equal(parseMediaEmbed(url), null, url)
})
test('player output is escaped and contains only fixed permissions; semantic output has no iframe', () => {
  const html = mediaEmbedHtml(
    'https://youtu.be/M7lc1UVf-VE?autoplay=1&evil=2',
    { caption: '"><img src=x onerror=alert(1)>', width: 500, align: 'javascript' },
    true,
  )
  assert.ok(!html.includes('<img'))
  assert.ok(!html.includes('autoplay=1'))
  assert.ok(html.includes('data-studio-embed-width="100"'))
  assert.ok(html.includes('sandbox="allow-scripts allow-same-origin allow-presentation"'))
  assert.ok(!mediaEmbedHtml('https://youtu.be/M7lc1UVf-VE').includes('<iframe'))
})
