import { describe, it, expect, beforeEach } from 'vitest'
import { storageService } from '../services/storage'

describe('StorageService & Business Rules', () => {
  beforeEach(() => {
    localStorage.clear()
    storageService.loadDemoData()
  })

  it('allows multiple active activities per organization', async () => {
    const orgs = storageService.getOrganizations()
    const orgId = orgs[0].id

    const act1 = await storageService.createActivity({
      organization_id: orgId,
      name: 'Kegiatan A',
      start_date: '2026-10-01',
      end_date: '2026-10-10',
      is_active: true,
      is_archived: false,
    })

    const act2 = await storageService.createActivity({
      organization_id: orgId,
      name: 'Kegiatan B',
      start_date: '2026-10-15',
      end_date: '2026-10-25',
      is_active: true,
      is_archived: false,
    })

    const activities = storageService.getActivities(orgId)
    const updatedAct1 = activities.find((a) => a.id === act1.id)
    const updatedAct2 = activities.find((a) => a.id === act2.id)

    // Both remain active (multi-active).
    expect(updatedAct1?.is_active).toBe(true)
    expect(updatedAct2?.is_active).toBe(true)

    // Deactivate one explicitly.
    await storageService.setActivityActive(orgId, act1.id, false)
    const after = storageService.getActivities(orgId)
    expect(after.find((a) => a.id === act1.id)?.is_active).toBe(false)
    expect(after.find((a) => a.id === act2.id)?.is_active).toBe(true)
  })

  it('archives and unarchives activity with zero data loss', async () => {
    const orgs = storageService.getOrganizations()
    const orgId = orgs[0].id
    const activeAct = storageService.getActiveActivity(orgId)!

    // Add a task to this activity
    const task = await storageService.createTask({
      organization_id: orgId,
      activity_id: activeAct.id,
      title: 'Tugas Spesial Arsip',
      description: 'Detail tugas arsip',
      category: 'Publikasi',
      phase: 'Pra-acara',
      priority: 'Tinggi',
      pic_id: 'demo-m-1',
      start_date: '2026-10-01',
      deadline: '2026-10-20',
      status: 'Dikerjakan',
      progress: 40,
      review_status: 'Belum diajukan',
      reference_links: [],
      result_links: [],
      is_archived: false,
    })

    // Archive the activity
    await storageService.archiveActivity(orgId, activeAct.id)
    const activities = storageService.getActivities(orgId)
    const archivedAct = activities.find((a) => a.id === activeAct.id)
    expect(archivedAct?.is_archived).toBe(true)
    expect(archivedAct?.is_active).toBe(false)

    // Tasks under archived activity must remain intact
    const tasks = storageService.getTasks(orgId, activeAct.id, true)
    expect(tasks.some((t) => t.id === task.id)).toBe(true)

    // Unarchive
    await storageService.unarchiveActivity(orgId, activeAct.id)
    const unarchivedAct = storageService.getActivities(orgId).find((a) => a.id === activeAct.id)
    expect(unarchivedAct?.is_archived).toBe(false)
  })

  it('auto-sets 100% progress and completed_at when status changes to Selesai', async () => {
    const orgs = storageService.getOrganizations()
    const orgId = orgs[0].id
    const activeAct = storageService.getActiveActivity(orgId)!

    const task = await storageService.createTask({
      organization_id: orgId,
      activity_id: activeAct.id,
      title: 'Tugas Testing Selesai',
      description: 'Test selesai',
      category: 'Dokumentasi',
      phase: 'Pra-acara',
      priority: 'Sedang',
      pic_id: 'demo-m-1',
      start_date: '2026-10-01',
      deadline: '2026-10-20',
      status: 'Dikerjakan',
      progress: 30,
      review_status: 'Belum diajukan',
      reference_links: [],
      result_links: [],
      is_archived: false,
    })

    const updated = await storageService.updateTask(task.id, {
      status: 'Selesai',
    })

    expect(updated?.progress).toBe(100)
    expect(updated?.completed_at).toBeTruthy()
  })

  it('records revision notes and audit log when status changes to Revisi', async () => {
    const orgs = storageService.getOrganizations()
    const orgId = orgs[0].id
    const activeAct = storageService.getActiveActivity(orgId)!

    const task = await storageService.createTask({
      organization_id: orgId,
      activity_id: activeAct.id,
      title: 'Tugas Desain Spanduk',
      description: 'Detail desain',
      category: 'Desain',
      phase: 'Pra-acara',
      priority: 'Tinggi',
      pic_id: 'demo-m-1',
      start_date: '2026-10-01',
      deadline: '2026-10-20',
      status: 'Dikerjakan',
      progress: 70,
      review_status: 'Menunggu review',
      reference_links: [],
      result_links: [],
      is_archived: false,
    })

    const notes = 'Perbaiki ukuran font pada slogan.'
    const updated = await storageService.updateTask(task.id, {
      status: 'Revisi',
      review_status: 'Perlu revisi',
      revision_notes: notes,
    })

    expect(updated?.status).toBe('Revisi')
    expect(updated?.revision_notes).toBe(notes)

    // Check activity logs
    const logs = storageService.getActivityLogs(orgId)
    expect(logs.some((l) => l.action === 'STATUS_TUGAS_DIUBAH' && l.details.includes(notes))).toBe(true)
  })

  it('exports and imports backup JSON with integrity', async () => {
    const backupJson = storageService.exportAllData()
    expect(typeof backupJson).toBe('string')
    const parsed = JSON.parse(backupJson)
    expect(parsed.organizations.length).toBeGreaterThan(0)
    expect(parsed.tasks.length).toBeGreaterThan(0)

    // Clear and restore
    localStorage.clear()
    const result = storageService.importAllData(backupJson)
    expect(result.success).toBe(true)
    expect(storageService.getOrganizations().length).toBe(parsed.organizations.length)
  })

  it('supports clearDemoData safely without crashing', () => {
    storageService.clearDemoData()
    const orgs = storageService.getOrganizations()
    expect(orgs.some((o) => o.name.includes('[DEMO]'))).toBe(false)
  })

  it('rejects creating activities and members without a valid organization', async () => {
    await expect(
      storageService.createActivity({
        organization_id: '',
        name: 'Kegiatan Tanpa Organisasi',
        start_date: '2026-10-20',
        end_date: '2026-10-30',
        is_active: true,
        is_archived: false,
      })
    ).rejects.toThrow(/organisasi/i)

    await expect(
      storageService.createMember({
        organization_id: 'org-tidak-ada',
        name: 'Anggota Tanpa Organisasi',
        role: 'Staf',
        is_active: true,
      })
    ).rejects.toThrow(/organisasi/i)

    // No orphan rows may be written to localStorage.
    expect(storageService.getActivities('')).toHaveLength(0)
    expect(storageService.getMembers('org-tidak-ada')).toHaveLength(0)
  })

  it('rejects creating a task without a valid activity in the organization', async () => {
    const orgId = storageService.getOrganizations()[0].id

    await expect(
      storageService.createTask({
        organization_id: orgId,
        activity_id: '',
        title: 'Tugas Tanpa Kegiatan',
        description: '',
        category: 'Administrasi',
        phase: 'Pra-acara',
        priority: 'Sedang',
        pic_id: 'demo-m-1',
        start_date: '2026-10-20',
        deadline: '2026-10-30',
        status: 'Belum dikerjakan',
        progress: 0,
        review_status: 'Belum diajukan',
        reference_links: [],
        result_links: [],
        is_archived: false,
      })
    ).rejects.toThrow(/kegiatan/i)
  })

  it('includes all activity logs in exported backups', async () => {
    const orgId = storageService.getOrganizations()[0].id
    await storageService.logActivity(
      orgId,
      undefined,
      undefined,
      'Tester',
      'PENGUJIAN',
      'Log khusus pengujian ekspor'
    )

    const parsed = JSON.parse(storageService.exportAllData())
    expect(
      parsed.activityLogs.some((log: { details: string }) => log.details === 'Log khusus pengujian ekspor')
    ).toBe(true)
  })

  it('keeps real organization logs when clearing demo data', async () => {
    const realOrg = await storageService.createOrganization({
      name: 'Organisasi Nyata',
      code: 'NYATA',
      description: 'Organisasi non-demo',
    })
    await storageService.logActivity(
      realOrg.id,
      undefined,
      undefined,
      'Sistem',
      'PENGUJIAN',
      'Riwayat organisasi nyata'
    )

    storageService.clearDemoData()

    const logs = storageService.getActivityLogs(realOrg.id)
    expect(logs.some((log) => log.details === 'Riwayat organisasi nyata')).toBe(true)
  })

  it('deletes an organization with all dependent local data and switches to a remaining org', async () => {
    const previousOrgId = storageService.getOrganizations()[0].id
    const org = await storageService.createOrganization({
      name: 'Organisasi Sementara',
      code: 'TEMP',
      description: 'Akan dihapus',
    })
    expect(storageService.getCurrentOrgId()).toBe(org.id)

    const member = await storageService.createMember({
      organization_id: org.id,
      name: 'Anggota Sementara',
      role: 'Staf',
      is_active: true,
    })
    const activity = await storageService.createActivity({
      organization_id: org.id,
      name: 'Kegiatan Sementara',
      start_date: '2026-10-21',
      end_date: '2026-10-31',
      is_active: true,
      is_archived: false,
    })
    await storageService.createTask({
      organization_id: org.id,
      activity_id: activity.id,
      title: 'Tugas Sementara',
      description: '',
      category: 'Administrasi',
      phase: 'Pra-acara',
      priority: 'Sedang',
      pic_id: member.id,
      start_date: '2026-10-21',
      deadline: '2026-10-31',
      status: 'Belum dikerjakan',
      progress: 0,
      review_status: 'Belum diajukan',
      reference_links: [],
      result_links: [],
      is_archived: false,
    })

    await storageService.deleteOrganization(org.id)

    expect(storageService.getOrganizations().some((o) => o.id === org.id)).toBe(false)
    expect(storageService.getMembers(org.id)).toHaveLength(0)
    expect(storageService.getActivities(org.id)).toHaveLength(0)
    expect(storageService.getTasks(org.id)).toHaveLength(0)
    expect(storageService.getActivityLogs(org.id)).toHaveLength(0)
    expect(storageService.getCurrentOrgId()).toBe(previousOrgId)
  })
})
