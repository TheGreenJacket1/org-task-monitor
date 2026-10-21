import { test, expect, Page } from '@playwright/test'

const EMPTY_STATE: Record<string, string> = {
  org_monitor_organizations_v1: '[]',
  org_monitor_members_v1: '[]',
  org_monitor_activities_v1: '[]',
  org_monitor_tasks_v1: '[]',
  org_monitor_logs_v1: '[]',
  org_monitor_current_org_id_v1: '',
  org_monitor_initialized_v1: 'true',
}

async function openModal(page: Page, title: string) {
  const modal = page.locator('div.fixed.inset-0').filter({ hasText: title })
  await expect(modal).toBeVisible()
  return modal
}

test.describe('Regresi alur organisasi pertama', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript((state) => {
      for (const [key, value] of Object.entries(state)) {
        localStorage.setItem(key, value)
      }
    }, EMPTY_STATE)
  })

  test('membuat organisasi, kegiatan, anggota, dan tugas dari keadaan kosong', async ({ page }) => {
    await page.goto('/')

    // Empty state: no organization, no orphan records.
    await expect(page.getByRole('heading', { name: 'Belum Ada Organisasi' })).toBeVisible()
    const orgSelect = page.locator('select[title="Pilih Organisasi"]')
    await expect(orgSelect).toHaveValue('')
    await expect(orgSelect.locator('option').first()).toHaveText('-- Belum ada organisasi --')

    // Selecting the "NEW" entry opens the organization form directly.
    await orgSelect.selectOption('NEW')
    const orgModal = await openModal(page, 'Kelola Organisasi')
    await expect(orgModal.getByText('Formulir Organisasi Baru')).toBeVisible()

    await orgModal
      .getByPlaceholder('Contoh: BEM Universitas Indonesia')
      .fill('Himpunan Mahasiswa Informatika')
    await orgModal.getByPlaceholder('BEM-UI').fill('HIMATIF')
    await orgModal.getByRole('button', { name: 'Buat Organisasi', exact: true }).click()

    await expect(orgModal.getByText('Himpunan Mahasiswa Informatika')).toBeVisible()
    await expect(page.getByText(/berhasil dibuat/)).toBeVisible()
    await orgModal.locator('button').first().click()
    await expect(orgModal).toBeHidden()

    // Organization exists but has no active activity yet.
    await expect(page.getByRole('heading', { name: 'Belum Ada Kegiatan Aktif' })).toBeVisible()
    await page.getByRole('button', { name: 'Kelola / Aktifkan Kegiatan' }).click()

    const activityModal = await openModal(page, 'Kelola Kegiatan Organisasi')
    await activityModal.getByRole('button', { name: 'Buat Kegiatan Baru' }).click()
    await activityModal
      .getByPlaceholder('Contoh: Dies Natalis & Seminar Nasional 2026')
      .fill('Seminar Nasional Teknologi 2026')
    await activityModal.locator('input[type="date"]').nth(0).fill('2026-10-21')
    await activityModal.locator('input[type="date"]').nth(1).fill('2026-12-31')
    await activityModal.getByRole('button', { name: 'Simpan Kegiatan' }).click()

    await expect(activityModal.getByText('Seminar Nasional Teknologi 2026')).toBeVisible()
    await activityModal.locator('button').first().click()
    await expect(activityModal).toBeHidden()

    // Dashboard now reflects the active activity.
    await expect(page.getByText('Kegiatan Aktif', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Seminar Nasional Teknologi 2026' })
    ).toBeVisible()

    // Add a member.
    await page.getByRole('button', { name: /Anggota & PIC/ }).click()
    const memberModal = await openModal(page, 'Kelola Anggota & Panitia')
    await memberModal.getByRole('button', { name: 'Tambah Anggota', exact: true }).click()
    await memberModal.getByPlaceholder('Contoh: Rian Pratama').fill('Rian Pratama')
    await memberModal
      .getByPlaceholder('Contoh: Koordinator Desain / Staf Acara')
      .fill('Koordinator Acara')
    await memberModal.getByRole('button', { name: 'Tambah Anggota', exact: true }).click()

    await expect(memberModal.getByText('Rian Pratama')).toBeVisible()
    await memberModal.locator('button').first().click()
    await expect(memberModal).toBeHidden()

    // Add a task through the navbar primary action.
    await page.getByRole('button', { name: 'Tambah Tugas', exact: true }).click()
    const taskModal = await openModal(page, 'Tambah Tugas Baru')
    await taskModal
      .getByPlaceholder('Contoh: Desain Brosur Sponsor & Pamflet')
      .fill('Desain Poster Seminar Nasional')
    await taskModal.getByRole('button', { name: 'Buat Tugas', exact: true }).click()

    await expect(taskModal).toBeHidden()
    await expect(page.getByText(/Tugas baru berhasil dibuat/)).toBeVisible()
    await expect(page.getByText('Desain Poster Seminar Nasional')).toBeVisible()

    // Task list and history receive the new data.
    await page.getByRole('button', { name: /Daftar Tugas/ }).click()
    await expect(page.getByText('Desain Poster Seminar Nasional')).toBeVisible()

    await page.getByRole('button', { name: /Riwayat Aktivitas/ }).click()
    await expect(page.getByText('Riwayat Perubahan & Audit Trail')).toBeVisible()
    await expect(page.getByText(/Membuat tugas "Desain Poster Seminar Nasional"/)).toBeVisible()
    await expect(page.getByText('ORGANISASI_DIBUAT')).toBeVisible()
    await expect(page.getByText('KEGIATAN_DIBUAT')).toBeVisible()
    await expect(page.getByText('ANGGOTA_DITAMBAH')).toBeVisible()
  })

  test('mengarahkan semua aksi ke pembuatan organisasi saat data kosong', async ({ page }) => {
    await page.goto('/')

    // Task CTA routes to organization creation instead of creating orphan data.
    await page.getByRole('button', { name: 'Tambah Tugas', exact: true }).click()
    let orgModal = await openModal(page, 'Kelola Organisasi')
    await expect(page.getByText(/sebelum menambah tugas/)).toBeVisible()
    await orgModal.locator('button').first().click()

    // Activity and member CTA follow the same guard.
    await page.getByRole('button', { name: /Kelola Kegiatan/ }).click()
    orgModal = await openModal(page, 'Kelola Organisasi')
    await orgModal.locator('button').first().click()

    await page.getByRole('button', { name: /Anggota & PIC/ }).click()
    orgModal = await openModal(page, 'Kelola Organisasi')
    await orgModal.locator('button').first().click()

    // No orphan rows were persisted while there is no organization.
    const persisted = await page.evaluate(() => ({
      organizations: JSON.parse(localStorage.getItem('org_monitor_organizations_v1') || '[]'),
      activities: JSON.parse(localStorage.getItem('org_monitor_activities_v1') || '[]'),
      members: JSON.parse(localStorage.getItem('org_monitor_members_v1') || '[]'),
      tasks: JSON.parse(localStorage.getItem('org_monitor_tasks_v1') || '[]'),
    }))
    expect(persisted.organizations).toHaveLength(0)
    expect(persisted.activities).toHaveLength(0)
    expect(persisted.members).toHaveLength(0)
    expect(persisted.tasks).toHaveLength(0)
  })
})
