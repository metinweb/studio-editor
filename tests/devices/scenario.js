import { expect } from '@playwright/test'
import {
  deviceMapping,
  editorState,
  elementCenter,
  installProbe,
  probePoints,
  readProbe,
  selectEditorText,
} from './touch.js'

/**
 * Taps an element with a real touch. The page-to-screen mapping is measured again before each
 * tap because browser bars and the software keyboard move the web content.
 */
export async function tapElement(device, target) {
  const center = await device.evaluate(elementCenter, target)
  expect(center, `${target.name || target.selector} is visible`).toBeTruthy()
  await device.evaluate(installProbe)
  const points = probePoints(await device.screen())
  for (const point of points) await device.tap(point)
  await expect.poll(() => device.evaluate(() => window.__studioProbe.touches.length)).toBe(2)
  const touches = await device.evaluate(readProbe)
  expect(touches.map((touch) => touch.type)).toEqual(['touch', 'touch'])
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
  await expect.poll(async () => (await state()).text, { timeout: 30000 }).toContain('İyi fikirler')
  expect((await state()).horizontalScroll).toBeLessThanOrEqual(1)

  await tapElement(device, { selector: 'p', editor: true, text: 'Bir hikâye' })
  await expect.poll(async () => (await state()).focused).toBe(true)
  await device.type(' dokunmatik')
  await expect.poll(async () => (await state()).text.toLowerCase()).toContain('dokunmatik')

  expect(await device.evaluate(selectEditorText, 'dokunmatik')).toBe(true)
  if (!(await device.evaluate(elementCenter, { selector: 'button', name: 'Kalın' })))
    await tapElement(device, { selector: 'button', name: 'Tüm araçları göster' })
  await tapElement(device, { selector: 'button', name: 'Kalın' })
  await expect.poll(bold).toContain('dokunmatik')
  await tapElement(device, { selector: 'button', name: 'Geri al' })
  await expect.poll(bold).not.toContain('dokunmatik')

  const rules = (await state()).rules
  await tapElement(device, { selector: '.native-menubar button', name: 'Ekle' })
  await expect.poll(async () => (await state()).menu).toBe(true)
  await tapElement(device, { selector: '[role="menuitem"]', name: 'Yatay çizgi' })
  await expect.poll(async () => (await state()).rules).toBe(rules + 1)
  expect((await state()).horizontalScroll).toBeLessThanOrEqual(1)
}
