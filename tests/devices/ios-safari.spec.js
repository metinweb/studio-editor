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
    // A key on the software keyboard, by its accessibility name (native context).
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
      // The keyboard and its keys, to see which keyboard was shown.
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

// The Turkish Q keyboard: Turkish letters typed on their own keys reach the editor once each.
const turkishQ = { id: 'tr_TR@sw=Turkish-Q;hw=Automatic', language: 'tr', locale: 'tr_TR' }
const letters = 'çğışöü'

test('the Turkish Q keyboard types Turkish letters in Safari on iOS', async () => {
  test.skip(!udid, 'Set IOS_UDID to an iOS Simulator and start Appium')
  const saved = defaults('export', '.GlobalPreferences', '-')
  useKeyboard(turkishQ)
  const safari = await openSafari()
  const state = () => safari.device.evaluate(editorState)
  try {
    await safari.reset()
    await expect.poll(async () => (await state()).text, { timeout: 30000 }).toContain('İyi')
    await safari.device.evaluate(recordInput)
    await tapElement(safari.device, { selector: 'p', editor: true, text: 'Bir hikâye' })
    await expect.poll(async () => (await state()).focused).toBe(true)
    await safari.native(async () => {
      // iOS starts with its English keyboard; switch until the Turkish keys are there.
      for (let attempt = 0; attempt < 3 && !(await (await safari.key('ç')).isExisting()); attempt++)
        await safari.nextKeyboard()
      for (const letter of letters) await (await safari.key(letter)).click()
    })
    await expect.poll(async () => (await state()).text.split(letters).length - 1).toBe(1)
    const path = test.info().outputPath('turkish-q-input-events.txt')
    await writeFile(path, await safari.device.evaluate(inputLog))
    await test.info().attach('turkish-q-input-events', { path, contentType: 'text/plain' })
    await safari.keep('turkish-q')
  } catch (error) {
    await safari.keep('turkish-q-failure', true).catch(() => {})
    throw error
  } finally {
    await safari.driver.deleteSession()
    simctl(['spawn', udid, 'defaults', 'import', '.GlobalPreferences', '-'], { input: saved })
    restartSimulator()
  }
})
