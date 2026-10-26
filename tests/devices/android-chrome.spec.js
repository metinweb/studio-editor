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
const focusedWindow = () => adb('shell', 'dumpsys', 'window').match(/mCurrentFocus=.*/)?.[0] || ''
// Busy emulators show "… isn't responding" for system apps; choose Wait so taps reach Chrome.
// (Back would also close the dialog but navigates Chrome when the dialog is already gone.)
async function dismissNotResponding() {
  for (let attempt = 0; attempt < 10 && /Not Responding/.test(focusedWindow()); attempt++) {
    let wait
    try {
      adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
      wait = adb('shell', 'cat', '/sdcard/window.xml').match(
        /resource-id="android:id\/aerr_wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/,
      )
    } catch {}
    if (wait) {
      const [left, top, right, bottom] = wait.slice(1).map(Number)
      adb('shell', 'input', 'tap', Math.round((left + right) / 2), Math.round((top + bottom) / 2))
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
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
    await context.addInitScript(() => {
      localStorage.setItem('studio-locale', 'tr')
      // Keeps Chrome's install banner for the web app from covering the page.
      addEventListener('beforeinstallprompt', (event) => event.preventDefault())
    })
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
        tap: async ({ x, y }) => {
          await dismissNotResponding()
          adb('shell', 'input', 'tap', x, y)
        },
        type: async (text) => adb('shell', 'input', 'text', text.replaceAll(' ', '%s')),
      })
    } catch (error) {
      await screenshot('android-failure')
      console.log(focusedWindow())
      throw error
    }
    await screenshot('android-chrome')
  } finally {
    await context.close()
    await device.close()
  }
})
