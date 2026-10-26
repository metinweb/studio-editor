import { test, expect } from '@playwright/test'

const body = (page) => page.frameLocator('.studio-editor-frame').locator('body')
async function openDiagram(page) {
  await page.locator('.native-menubar').getByRole('button', { name: 'Ekle', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Diyagram (Mermaid)' }).click()
  return page.getByRole('dialog', { name: 'Diyagram (Mermaid)' })
}

test('Mermaid diagrams preview, insert as images with source, edit and undo', async ({ page }) => {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await body(page).locator('h1').click()
  const dialog = await openDiagram(page)
  const preview = dialog.getByRole('img', { name: 'Diyagram önizlemesi' })
  await expect(preview).toBeVisible({ timeout: 20000 })
  await dialog
    .getByRole('textbox', { name: 'Mermaid kaynağı' })
    .fill('flowchart LR\n  A[Bir] --> B[İki]')
  await dialog.getByRole('textbox', { name: 'Diyagram alternatif metni' }).fill('Bir ikiye gider')
  await expect(preview).toBeVisible()
  await dialog.getByRole('button', { name: 'Diyagramı ekle' }).click()
  const image = body(page).locator('img[data-studio-diagram="mermaid"]')
  await expect(image).toHaveCount(1)
  await expect(image).toHaveAttribute(
    'data-studio-source',
    encodeURIComponent('flowchart LR\n  A[Bir] --> B[İki]'),
  )
  await expect(image).toHaveAttribute('alt', 'Bir ikiye gider')
  expect(await image.getAttribute('src')).toMatch(/^data:image\/(png|svg\+xml);base64,/)
  expect(await image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(50)

  await image.dblclick()
  const edit = page.getByRole('dialog', { name: 'Diyagram (Mermaid)' })
  await expect(edit.getByRole('textbox', { name: 'Mermaid kaynağı' })).toHaveValue(
    'flowchart LR\n  A[Bir] --> B[İki]',
  )
  await edit.getByRole('textbox', { name: 'Mermaid kaynağı' }).fill('flowchart TD\n  A --> B --> C')
  await expect(edit.getByRole('img', { name: 'Diyagram önizlemesi' })).toBeVisible()
  await edit.getByRole('button', { name: 'Diyagramı güncelle' }).click()
  await expect(image).toHaveAttribute(
    'data-studio-source',
    encodeURIComponent('flowchart TD\n  A --> B --> C'),
  )
  await body(page).locator('h1').click()
  await page.keyboard.press('Control+z')
  await expect(image).toHaveAttribute(
    'data-studio-source',
    encodeURIComponent('flowchart LR\n  A[Bir] --> B[İki]'),
  )
})

test('invalid Mermaid source reports an error and cannot be inserted', async ({ page }) => {
  await page.goto('/')
  await expect(body(page)).toContainText('İyi fikirler')
  await body(page).locator('h1').click()
  const dialog = await openDiagram(page)
  await dialog.getByRole('textbox', { name: 'Mermaid kaynağı' }).fill('flowchart LR\n  A -->')
  await expect(dialog.getByRole('alert')).toBeVisible({ timeout: 20000 })
  await expect(dialog.getByRole('button', { name: 'Diyagramı ekle' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Akış şeması' }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Diyagramı ekle' })).toBeEnabled()
})
