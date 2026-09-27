import { test, expect } from '@playwright/test'

test('installed package lazily converts text to an editable molecule with Turkish labels', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Bilimsel içerik aç', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Matematik ve kimya' })
  await dialog.getByRole('button', { name: 'Molekül çizimi', exact: true }).click()
  await dialog.getByRole('button', { name: 'Metinden çiz', exact: true }).click()
  await page.getByLabel('Formül, molekül adı veya SMILES').fill('CH₃CH₂OH')
  await page.getByRole('button', { name: 'Çizime dönüştür', exact: true }).click()
  await expect(dialog.locator('.molecule-atom')).toHaveCount(4)
  await dialog.getByRole('button', { name: 'Ekle', exact: true }).click()
  const first = page.frameLocator('.studio-editor-frame').first().locator('body')
  const image = first.locator('img[data-studio-science="molecule"]')
  await expect(image).toHaveCount(1)
  expect(JSON.parse(await image.getAttribute('data-studio-source')).bonds).toHaveLength(3)
  expect(errors).toEqual([])
})

test('installed science addon is lazy, isolated and respects readonly/disabled API calls', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const first = page.frameLocator('.studio-editor-frame').first().locator('body')
  const second = page.frameLocator('.studio-editor-frame').nth(1).locator('body')
  await expect(first).toHaveText('Birinci belge')
  await page.getByRole('button', { name: 'Bilimsel içerik aç', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Matematik ve kimya' })
  await page.getByLabel('LaTeX denklemi').fill('x^2 + y^2 = r^2')
  await expect(dialog.locator('.science-preview img')).toBeVisible()
  await dialog.getByRole('button', { name: 'Ekle', exact: true }).click()
  await expect(first.locator('img[data-studio-science="math"]')).toHaveCount(1)
  await expect(second.locator('img')).toHaveCount(0)
  await page.getByLabel('Salt okunur örnek', { exact: true }).check()
  await page.getByRole('button', { name: 'Bilimsel içerik aç', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByLabel('Salt okunur örnek', { exact: true }).uncheck()
  await page.getByLabel('Devre dışı örnek', { exact: true }).check()
  await page.getByRole('button', { name: 'Bilimsel içerik aç', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(errors).toEqual([])
})
