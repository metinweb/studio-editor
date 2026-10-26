import test from 'node:test'
import assert from 'node:assert/strict'
import { createEditorWatchdog, recoverableHtml } from '../../src/lib/watchdog.js'

test('watchdog restarts up to the limit within the period, then stops until restarted', () => {
  let time = 0
  const watchdog = createEditorWatchdog({ limit: 3, period: 60000, now: () => time })
  for (let i = 1; i <= 3; i++) {
    time += 1000
    assert.equal(watchdog.crash(new Error(`boom ${i}`)), true)
    assert.equal(watchdog.generation.value, i)
    assert.equal(watchdog.status.value, 'recovered')
  }
  time += 1000
  assert.equal(watchdog.crash(new Error('boom 4')), false)
  assert.equal(watchdog.status.value, 'failed')
  assert.equal(watchdog.generation.value, 3, 'a stopped editor is not remounted')
  assert.equal(watchdog.lastError.value.message, 'boom 4')
  watchdog.restart()
  assert.equal(watchdog.status.value, 'running')
  assert.equal(watchdog.generation.value, 4)
  assert.equal(watchdog.lastError.value, null)
})

test('old crashes expire and dismiss only clears the recovered notice', () => {
  let time = 0
  const watchdog = createEditorWatchdog({ limit: 1, period: 1000, now: () => time })
  assert.equal(watchdog.crash(new Error('first')), true)
  watchdog.dismiss()
  assert.equal(watchdog.status.value, 'running')
  time = 2000
  assert.equal(watchdog.crash(new Error('later')), true, 'the earlier crash expired')
  time = 2500
  assert.equal(watchdog.crash(new Error('burst')), false)
  watchdog.dismiss()
  assert.equal(watchdog.status.value, 'failed', 'dismiss never hides a stopped editor')
})

test('recoverable HTML prefers the live editor and falls back when it cannot be read', () => {
  assert.equal(
    recoverableHtml(() => '<p>live</p>', '<p>old</p>'),
    '<p>live</p>',
  )
  assert.equal(
    recoverableHtml(() => {
      throw new Error('detached')
    }, '<p>old</p>'),
    '<p>old</p>',
  )
  assert.equal(
    recoverableHtml(() => '', '<p>old</p>'),
    '<p>old</p>',
  )
  assert.equal(
    recoverableHtml(() => undefined),
    '',
  )
})
