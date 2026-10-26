import { test, _android as android } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { editWithTouch } from './scenario.js'

// Chrome on an Android emulator or a USB device. Touches and keys go through Android's input
// system (`adb shell input`), the same path a finger or a keyboard takes; the page is only read.
const adb = (...args) => execFileSync('adb', args.map(String), { encoding: 'utf8' })
function installed(pkg) {
  try {
    return !!adb('shell', 'pm', 'path', pkg).trim()
  } catch {
    return false
  }
}

test('touch and key input edit the document in Chrome on Android', async () => {
  const [device] = await android.devices()
  test.skip(!device, 'No Android emulator or device is connected')
  if (!installed('com.android.chrome'))
    throw new Error('Chrome is not installed on the Android device')
  adb('reverse', 'tcp:4173', 'tcp:4173')
  // Lets Chrome read Playwright's command line on images that are not rooted.
  adb('shell', 'am', 'set-debug-app', '--persistent', 'com.android.chrome')
  // Android 13+ would otherwise cover Chrome with a notification permission prompt.
  try {
    adb('shell', 'pm', 'grant', 'com.android.chrome', 'android.permission.POST_NOTIFICATIONS')
  } catch {}
  const context = await device.launchBrowser()
  const screenshot = async (name) => {
    const path = test.info().outputPath(`${name}.png`)
    await device.screenshot({ path })
    await test.info().attach(name, { path, contentType: 'image/png' })
  }
  try {
    await context.addInitScript(() => localStorage.setItem('studio-locale', 'tr'))
    const page = context.pages()[0] ?? (await context.newPage())
    await page.goto('http://127.0.0.1:4173/')
    const size = adb('shell', 'wm', 'size')
    const [width, height] = (size.match(/Override size: (\d+)x(\d+)/) || size.match(/(\d+)x(\d+)/))
      .slice(1)
      .map(Number)
    console.log('Browser:', await page.evaluate(() => navigator.userAgent), `${width}x${height}`)
    try {
      await editWithTouch({
        evaluate: (fn, arg) => page.evaluate(fn, arg),
        screen: async () => ({ width, height }),
        tap: async ({ x, y }) => adb('shell', 'input', 'tap', x, y),
        type: async (text) => adb('shell', 'input', 'text', text.replaceAll(' ', '%s')),
      })
    } catch (error) {
      await screenshot('android-failure')
      console.log(adb('shell', 'dumpsys', 'window').match(/mCurrentFocus=.*/)?.[0])
      throw error
    }
    await screenshot('android-chrome')
  } finally {
    await context.close()
    await device.close()
  }
})
