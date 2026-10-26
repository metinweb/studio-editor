import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import {
  deviceMapping,
  editorState,
  elementCenter,
  inputLog,
  installProbe,
  markInput,
  probePoints,
  readProbe,
  recordInput,
  selectEditorText,
} from './touch.js'

/**
 * Taps an element with a real touch. The page-to-screen mapping is measured again before each
 * tap because browser bars and the software keyboard move the web content; the element is
 * located again after that, once scrolling and bar animations have settled.
 */
export async function tapElement(device, target) {
  const visible = await device.evaluate(elementCenter, target)
  expect(visible, `${target.name || target.selector} is visible`).toBeTruthy()
  await new Promise((resolve) => setTimeout(resolve, 400))
  const points = probePoints(await device.screen())
  let touches = []
  // A system dialog or browser bubble can take a probe tap; measure again in that case.
  for (let attempt = 0; attempt < 3 && touches.length !== 2; attempt++) {
    await device.evaluate(installProbe)
    for (const point of points) await device.tap(point)
    await expect
      .poll(() => device.evaluate(() => window.__studioProbe.touches.length))
      .toBe(2)
      .catch(() => {})
    touches = await device.evaluate(readProbe)
  }
  expect(touches.map((touch) => touch.type)).toEqual(['touch', 'touch'])
  const center = await device.evaluate(elementCenter, { ...target, scroll: false })
  await device.tap(deviceMapping(points, touches)(center))
}

/**
 * The same editing session on every device: tap into the document, type with the device's
 * keyboard, format with a toolbar tap, undo, and insert from a menu.
 * `device` provides evaluate(fn, arg), screen(), tap({ x, y }) and type(text).
 */
export async function editWithTouch(device) {
  const state = () => device.evaluate(editorState)
  const bold = async () => (await state()).bold.join(' ').toLowerCase()
  const mark = (step) => device.evaluate(markInput, step)
  await expect.poll(async () => (await state()).text, { timeout: 30000 }).toContain('İyi fikirler')
  expect((await state()).horizontalScroll).toBeLessThanOrEqual(1)
  await device.evaluate(recordInput)
  try {
    await tapElement(device, { selector: 'p', editor: true, text: 'Bir hikâye' })
    await expect.poll(async () => (await state()).focused).toBe(true)
    await mark('tapped')
    await device.type(' dokunmatik')
    await expect.poll(async () => (await state()).text.toLowerCase()).toContain('dokunmatik')
    await mark('typed')

    expect(await device.evaluate(selectEditorText, 'dokunmatik')).toBe(true)
    if (!(await device.evaluate(elementCenter, { selector: 'button', name: 'Kalın' })))
      await tapElement(device, { selector: 'button', name: 'Tüm araçları göster' })
    await tapElement(device, { selector: 'button', name: 'Kalın' })
    await expect.poll(bold).toContain('dokunmatik')
    await mark('bold')
    await tapElement(device, { selector: 'button', name: 'Geri al' })
    await expect.poll(bold).not.toContain('dokunmatik')
    await mark('undone')

    const rules = (await state()).rules
    await tapElement(device, { selector: '.native-menubar button', name: 'Ekle' })
    await expect.poll(async () => (await state()).menu).toBe(true)
    await tapElement(device, { selector: '[role="menuitem"]', name: 'Yatay çizgi' })
    await expect.poll(async () => (await state()).rules).toBe(rules + 1)
    expect((await state()).horizontalScroll).toBeLessThanOrEqual(1)
  } finally {
    await mark('end').catch(() => {})
    const path = test.info().outputPath('input-events.txt')
    await writeFile(path, await device.evaluate(inputLog).catch((error) => String(error)))
    await test.info().attach('input-events', { path, contentType: 'text/plain' })
  }
}
