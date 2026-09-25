import { test, expect } from '@playwright/test'
const body = (page) => page.frameLocator('.studio-editor-frame').first().locator('body')
test('schema operations integrate with HTML, identity, undo and stale revisions', async ({
  page,
}) => {
  await page.goto('/')
  await expect(body(page)).toHaveText('Birinci belge')
  await page.getByRole('button', { name: 'Şemalı belgeyi oku' }).click()
  const before = JSON.parse(await page.locator('#schema-model').textContent())
  expect(before.schemaVersion).toBe(2)
  await page.getByRole('button', { name: 'Şemalı işlem uygula' }).click()
  await expect(body(page)).toHaveText('Şemalı belge')
  await page.getByRole('button', { name: 'Şemalı işlem uygula' }).click()
  await expect(page.locator('#model-error')).toContainText('Belge değişti')
  await expect(body(page)).toHaveText('Şemalı belge')
  await page.getByRole('button', { name: 'API geri al' }).click()
  await expect(body(page)).toHaveText('Birinci belge')
  await page.getByRole('button', { name: 'Şemalı belgeyi oku' }).click()
  const after = JSON.parse(await page.locator('#schema-model').textContent())
  expect(after.blocks[0].id).toBe(before.blocks[0].id)
})
