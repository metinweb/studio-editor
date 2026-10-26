import { test } from '@playwright/test'
import { editWithTouch } from './scenario.js'

// Mobile Safari on an iOS Simulator through Appium (XCUITest). Taps are XCTest touch events and
// text is typed by tapping keys on the iOS software keyboard; the page is only read.
// Needs Appium with the XCUITest driver on port 4723, `webdriverio`, and IOS_UDID/IOS_VERSION.
test('touch and the software keyboard edit the document in Safari on iOS', async () => {
  test.skip(!process.env.IOS_UDID, 'Set IOS_UDID to an iOS Simulator and start Appium')
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
      'appium:udid': process.env.IOS_UDID,
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
  const screenshot = async (name) => {
    const path = test.info().outputPath(`${name}.png`)
    await driver.saveScreenshot(path)
    await test.info().attach(name, { path, contentType: 'image/png' })
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
  const native = async (action) => {
    const web = await driver.getAppiumContext()
    await driver.switchAppiumContext('NATIVE_APP')
    try {
      return await action()
    } finally {
      await driver.switchAppiumContext(web)
    }
  }
  const keyboardKey = async (character) => {
    const name = character === ' ' ? 'space' : character
    const key = await driver.$(`~${name}`)
    return (await key.isExisting()) ? key : driver.$(`~${name.toUpperCase()}`)
  }
  try {
    // A retry must not find the previous attempt's document: the deletions are queued behind the
    // open connections and run when the page reloads. The first visit then creates the welcome
    // document in the interface language.
    await load()
    await driver.execute(() => {
      localStorage.clear()
      for (const name of ['tinymce-studio', 'studio-content-tools']) indexedDB.deleteDatabase(name)
    })
    await load()
    const { width, height } = await native(() => driver.getWindowSize())
    console.log('Browser:', await driver.execute(() => navigator.userAgent), `${width}x${height}`)
    try {
      await editWithTouch({
        evaluate: (fn, arg) => driver.execute(fn, arg),
        screen: async () => ({ width, height }),
        tap: ({ x, y }) => driver.execute('mobile: tap', { x, y }),
        type: (text) =>
          native(async () => {
            for (const character of text) await (await keyboardKey(character)).click()
          }),
      })
    } catch (error) {
      await screenshot('ios-failure')
      throw error
    }
    await screenshot('ios-safari')
  } finally {
    await driver.deleteSession()
  }
})
