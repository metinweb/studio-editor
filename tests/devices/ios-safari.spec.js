import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { editWithTouch, tapElement } from './scenario.js'
import { editorState, inputLog, recordInput } from './touch.js'

// Mobile Safari on an iOS Simulator through Appium (XCUITest). Taps are XCTest touch events and
// text is typed by tapping keys on the iOS software keyboard; the page is only read.
// Needs Appium with the XCUITest driver on port 4723, `webdriverio`, and IOS_UDID/IOS_VERSION.
const udid = process.env.IOS_UDID
const simctl = (args, options) =>
  execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', ...options })
const defaults = (...args) => simctl(['spawn', udid, 'defaults', ...args])
function restartSimulator() {
  simctl(['shutdown', udid])
  simctl(['boot', udid])
  simctl(['bootstatus', udid, '-b'])
}
// iOS adds the system language's keyboard and starts with it, so the language and region change
// with the keyboard. The keyboard UI runs outside Safari and reads the list when it starts, so
// the simulator restarts; Appium connects to it again for the next session.
function useKeyboard({ id, language, locale }) {
  defaults('write', '.GlobalPreferences', 'AppleLanguages', '-array', language)
  defaults('write', '.GlobalPreferences', 'AppleLocale', locale)
  defaults('write', '.GlobalPreferences', 'AppleKeyboards', '-array', id)
  restartSimulator()
  const keyboards = defaults('read', '.GlobalPreferences', 'AppleKeyboards')
  console.log(`Keyboards for ${language}: ${keyboards.replace(/\s+/g, ' ')}`)
}

async function openSafari() {
  const { remote } = await import('webdriverio')
  const driver = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    logLevel: 'warn',
    connectionRetryTimeout: 15 * 60 * 1000,
    capabilities: {
      platformName: 'iOS',
      browserName: 'Safari',
      'appium:automationName': 'XCUITest',
      'appium:udid': udid,
      'appium:deviceName': process.env.IOS_DEVICE,
      'appium:platformVersion': process.env.IOS_VERSION,
      'appium:simulatorStartupTimeout': 10 * 60 * 1000,
      'appium:wdaLaunchTimeout': 10 * 60 * 1000,
      'appium:wdaConnectionTimeout': 10 * 60 * 1000,
      'appium:webviewConnectTimeout': 60 * 1000,
      'appium:newCommandTimeout': 600,
      'appium:connectHardwareKeyboard': false,
    },
  })
  const native = async (action) => {
    const web = await driver.getAppiumContext()
    await driver.switchAppiumContext('NATIVE_APP')
    try {
      return await action()
    } finally {
      await driver.switchAppiumContext(web)
    }
  }
  const load = async () => {
    await driver.url('http://127.0.0.1:4173/?lang=tr')
    await driver.waitUntil(
      () =>
        driver.execute(
          () => location.origin === 'http://127.0.0.1:4173' && document.readyState === 'complete',
        ),
      { timeout: 60000 },
    )
  }
  const { width, height } = await native(() => driver.getWindowSize())
  return {
    driver,
    native,
    load,
    // A retry must not find the previous attempt's document: the deletions are queued behind
    // the open connections and run when the page reloads. The first visit then creates the
    // welcome document in the interface language.
    async reset() {
      await load()
      await driver.execute(() => {
        localStorage.clear()
        for (const name of ['tinymce-studio', 'studio-content-tools'])
          indexedDB.deleteDatabase(name)
      })
      await load()
    },
    device: {
      evaluate: (fn, arg) => driver.execute(fn, arg),
      screen: async () => ({ width, height }),
      tap: ({ x, y }) => driver.execute('mobile: tap', { x, y }),
    },
    // A key or candidate on the software keyboard, by its accessibility name (native context).
    async key(character) {
      const name = character === ' ' ? 'space' : character
      const key = await driver.$(`~${name}`)
      return (await key.isExisting()) ? key : driver.$(`~${name.toUpperCase()}`)
    },
    // iOS starts with its English keyboard; like a user, switch with the globe button. Its name
    // is localized, so it is found as the first button after the keyboard that is not dictation
    // (native context).
    async nextKeyboard() {
      await driver
        .$('(//XCUIElementTypeKeyboard/following::XCUIElementTypeButton[@name!="dictation"])[1]')
        .click()
      await driver.pause(500)
    },
    async keep(name, failed) {
      const path = test.info().outputPath(`${name}.png`)
      await driver.saveScreenshot(path)
      await test.info().attach(name, { path, contentType: 'image/png' })
      if (!failed) return
      // The keyboard's keys and candidates, to see what the input method offered.
      const source = test.info().outputPath(`${name}.xml`)
      await writeFile(source, await native(() => driver.getPageSource()))
      await test.info().attach(`${name}-source`, { path: source, contentType: 'text/xml' })
    },
  }
}

test('touch and the software keyboard edit the document in Safari on iOS', async () => {
  test.skip(!udid, 'Set IOS_UDID to an iOS Simulator and start Appium')
  const safari = await openSafari()
  try {
    await safari.reset()
    console.log('Browser:', await safari.driver.execute(() => navigator.userAgent))
    try {
      await editWithTouch({
        ...safari.device,
        type: (text) =>
          safari.native(async () => {
            for (const character of text) await (await safari.key(character)).click()
          }),
      })
    } catch (error) {
      await safari.keep('ios-failure', true)
      throw error
    }
    await safari.keep('ios-safari')
  } finally {
    await safari.driver.deleteSession()
  }
})

// Real input methods: Turkish letters from the Turkish Q keyboard, and Japanese and Chinese text
// composed from Latin keys and committed by tapping the input method's candidate.
const keyboards = [
  {
    name: 'turkish-q',
    id: 'tr_TR@sw=Turkish-Q;hw=Automatic',
    language: 'tr',
    locale: 'tr_TR',
    keys: 'çğışöü',
  },
  {
    name: 'japanese-romaji',
    id: 'ja_JP-Romaji@sw=QWERTY-Japanese;hw=Automatic',
    language: 'ja',
    locale: 'ja_JP',
    keys: 'nihon',
    candidate: '日本',
  },
  {
    name: 'chinese-pinyin',
    id: 'zh_Hans-Pinyin@sw=Pinyin-Simplified;hw=Automatic',
    language: 'zh-Hans',
    locale: 'zh_CN',
    keys: 'nihao',
    candidate: '你好',
  },
]

test('Turkish, Japanese and Chinese keyboards type into the editor in Safari on iOS', async () => {
  test.skip(!udid, 'Set IOS_UDID to an iOS Simulator and start Appium')
  const occurrences = (text, word) => text.split(word).length - 1
  const saved = defaults('export', '.GlobalPreferences', '-')
  try {
    for (const [index, keyboard] of keyboards.entries()) {
      await test.step(keyboard.name, async () => {
        useKeyboard(keyboard)
        const safari = await openSafari()
        const state = () => safari.device.evaluate(editorState)
        try {
          if (index === 0) await safari.reset()
          else await safari.load()
          await expect.poll(async () => (await state()).text, { timeout: 30000 }).toContain('İyi')
          await safari.device.evaluate(recordInput)
          const result = keyboard.candidate || keyboard.keys
          const before = occurrences((await state()).text, result)
          await tapElement(safari.device, { selector: 'p', editor: true, text: 'Bir hikâye' })
          await expect.poll(async () => (await state()).focused).toBe(true)
          // The wanted keyboard is recognized by what its first key does: the Turkish one has
          // that key, and an input method starts composing where the English keyboard inserts a
          // letter (which is deleted before switching).
          const compositions = async () =>
            (await safari.device.evaluate(inputLog)).split('compositionstart').length - 1
          let ready = false
          for (let attempt = 0; attempt < 3 && !ready; attempt++) {
            if (!keyboard.candidate) {
              ready = await safari.native(async () =>
                (await safari.key(keyboard.keys[0])).isExisting(),
              )
              if (!ready) await safari.native(() => safari.nextKeyboard())
              continue
            }
            const started = await compositions()
            await safari.native(async () => (await safari.key(keyboard.keys[0])).click())
            await safari.driver.pause(500)
            ready = (await compositions()) > started
            if (!ready)
              await safari.native(async () => {
                await (await safari.key('delete')).click()
                await safari.nextKeyboard()
              })
          }
          expect(ready, keyboard.name).toBe(true)
          await safari.native(async () => {
            const rest = keyboard.candidate ? keyboard.keys.slice(1) : keyboard.keys
            for (const character of rest) await (await safari.key(character)).click()
            if (keyboard.candidate) await (await safari.key(keyboard.candidate)).click()
          })
          await expect.poll(async () => occurrences((await state()).text, result)).toBe(before + 1)
          const events = await safari.device.evaluate(inputLog)
          const path = test.info().outputPath(`${keyboard.name}-input-events.txt`)
          await writeFile(path, events)
          await test
            .info()
            .attach(`${keyboard.name}-input-events`, { path, contentType: 'text/plain' })
          if (keyboard.candidate) {
            // Composed through the input method, committed once, with no Latin keys left behind.
            expect(events).toContain('compositionstart')
            expect(events).toContain('compositionend')
            expect((await state()).text).not.toContain(keyboard.keys)
          }
          await safari.keep(keyboard.name)
        } catch (error) {
          await safari.keep(`${keyboard.name}-failure`, true).catch(() => {})
          throw error
        } finally {
          await safari.driver.deleteSession()
        }
      })
    }
  } finally {
    simctl(['spawn', udid, 'defaults', 'import', '.GlobalPreferences', '-'], { input: saved })
    restartSimulator()
  }
})
