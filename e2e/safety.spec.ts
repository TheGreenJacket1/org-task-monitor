import { test, expect } from '@playwright/test'

test.describe('Safety & multi-activity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('selector kegiatan menampilkan jumlah tugas', async ({ page }) => {
    const sel = page.locator('select[title="Pilih kegiatan yang ditampilkan"]')
    await expect(sel).toBeVisible()
    await expect(sel).toContainText('tugas')
  })

  test('tempat sampah dapat dibuka', async ({ page }) => {
    await page.click('button:has-text("Tempat Sampah")')
    await expect(page.getByRole('heading', { name: 'Tempat Sampah' })).toBeVisible()
  })

  test('command palette terbuka dengan Ctrl+K', async ({ page }) => {
    await page.waitForTimeout(1000)
    await page.keyboard.down('Control')
    await page.keyboard.press('k')
    await page.keyboard.up('Control')
    await expect(page.getByPlaceholder('Cari aksi atau kegiatan...')).toBeVisible({ timeout: 10000 })
    await page.keyboard.press('Escape')
  })
})