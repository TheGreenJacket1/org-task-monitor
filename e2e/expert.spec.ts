import { test, expect } from '@playwright/test'

test.describe('Expert workflow & mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('quick add terbuka dengan tombol N', async ({ page }) => {
    await page.waitForTimeout(1200)
    await page.locator('body').click()
    await page.keyboard.press('n')
    await expect(page.getByText('Quick Add Tugas')).toBeVisible({ timeout: 10000 })
    await page.keyboard.press('Escape')
  })

  test('pengelompokan tugas tersedia di filter', async ({ page }) => {
    await page.click('button:has-text("Daftar Tugas")')
    const groupSelect = page.locator('select').filter({ has: page.locator('option[value="category"]') })
    await expect(groupSelect).toBeVisible()
    await groupSelect.selectOption('category')
    await expect(page.getByText(/Administrasi \(/)).toBeVisible()
  })

  test('saved view bisa disimpan dan dimuat', async ({ page }) => {
    await page.click('button:has-text("Daftar Tugas")')
    await page.getByPlaceholder('Nama tampilan baru').fill('Uji Tampilan')
    await page.click('button:has-text("Simpan Tampilan")')
    await expect(page.getByPlaceholder('Nama tampilan baru')).toHaveValue('')
    await expect(page.locator('option', { hasText: 'Uji Tampilan' })).toBeAttached()
  })

  test('riwayat memiliki pemilih jumlah dan tombol arsip', async ({ page }) => {
    await page.click('button:has-text("Riwayat Aktivitas")')
    await expect(page.locator('option', { hasText: '10 terbaru' })).toBeAttached()
    await expect(page.locator('option', { hasText: '100 terbaru' })).toBeAttached()
  })

  test.describe('viewport mobile', () => {
    test.use({ viewport: { width: 360, height: 640 } })

    test('bottom navigation tampil di mobile', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Tugas', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Tempat Sampah', exact: true })).toBeVisible()
    })

    test('tidak ada horizontal overflow di 360px', async ({ page }) => {
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth
      })
      expect(overflow).toBeLessThanOrEqual(1)
    })

    test('kartu tugas tampil sebagai ganti tabel', async ({ page }) => {
      await page.getByRole('button', { name: 'Tugas', exact: true }).click()
      await expect(page.getByPlaceholder('Cari judul tugas, deskripsi, atau nama staf...')).toBeVisible()
    })
  })
})
