import { test, expect } from '@playwright/test'

test.describe('Aplikasi Monitoring Tugas Organisasi (OrgTaskFlow)', () => {
  test.beforeEach(async ({ page }) => {
    // Open app
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('menampilkan judul aplikasi, organisasi demo, dan ringkasan dashboard', async ({ page }) => {
    await expect(page.getByText('OrgTaskFlow')).toBeVisible()
    await expect(page.getByText(/Data Demo/)).toBeVisible()
    await expect(page.getByText('Penyelesaian Tugas')).toBeVisible()
    await expect(page.getByText('Distribusi Status Tugas')).toBeVisible()
    await expect(page.getByText('Ringkasan Tugas per Staf')).toBeVisible()
  })

  test('dapat beralih antar tab navigasi dan memfilter tugas', async ({ page }) => {
    // Navigate to tasks tab
    await page.click('button:has-text("Daftar Tugas")')
    await expect(page.getByPlaceholder('Cari judul tugas, deskripsi, atau nama staf...')).toBeVisible()

    // Test filter search
    const searchInput = page.getByPlaceholder('Cari judul tugas, deskripsi, atau nama staf...')
    await searchInput.fill('Proposal')

    await expect(page.getByText(/Proposal dan Pengajuan Dana Sponsor/)).toBeVisible()
    await expect(page.getByText(/Uji Coba Alat Streaming/)).not.toBeVisible()

    // Clear search
    await searchInput.clear()
    await expect(page.getByText(/Uji Coba Alat Streaming/)).toBeVisible()
  })

  test('dapat membuka modal detail tugas dan melihat informasi lengkap', async ({ page }) => {
    await page.click('button:has-text("Daftar Tugas")')
    
    // Click on a task row
    await page.locator('text=/Proposal dan Pengajuan/').first().click()

    // Verify detail modal
    await expect(page.getByText('Aksi Cepat Status')).toBeVisible()
    await expect(page.getByText(/Tautan Referensi/)).toBeVisible()

    // Close modal
    await page.click('button:has-text("Tutup")')
  })

  test('dapat membuka pusat peringatan deadline dan notifikasi in-app', async ({ page }) => {
    // Click bell icon
    await page.click('button[title*="Peringatan Deadline"]')
    await expect(page.getByText('Pusat Peringatan & Deadline')).toBeVisible()
    await expect(page.getByText(/Peringatan H-7, H-3, H-1/)).toBeVisible()
  })

  test('dapat membuka modal pengaturan dan pencadangan Rp0', async ({ page }) => {
    // Click settings icon
    await page.click('button[title*="Pengaturan & Backup"]')
    await expect(page.getByText('Pengaturan & Pencadangan Data')).toBeVisible()
    await expect(page.getByText(/Operasional Biaya Rp0/)).toBeVisible()
    await expect(page.getByText('Unduh File Backup (.json)')).toBeVisible()
  })
})
