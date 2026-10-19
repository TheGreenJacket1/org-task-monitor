import { describe, it, expect, beforeEach } from 'vitest'
import { storageService } from '../services/storage'

describe('StorageService & Business Rules', () => {
  beforeEach(() => {
    localStorage.clear()
    storageService.loadDemoData()
  })

  it('enforces single active activity per organization', async () => {
    const orgs = storageService.getOrganizations()
    const orgId = orgs[0].id

    // Create first active activity
    const act1 = await storageService.createActivity({
      organization_id: orgId,
      name: 'Kegiatan A',
      start_date: '2026-10-01',
      end_date: '2026-10-10',
      is_active: true,
      is_archived: false,
    })

    expect(storageService.getActiveActivity(orgId)?.id).toBe(act1.id)

    // Create second active activity -> act1 must become inactive!
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

    expect(updatedAct1?.is_active).toBe(false)
    expect(updatedAct2?.is_active).toBe(true)
    expect(storageService.getActiveActivity(orgId)?.id).toBe(act2.id)

    // Reactivate act1 -> act2 becomes inactive
    await storageService.setActiveActivity(orgId, act1.id)
    expect(storageService.getActiveActivity(orgId)?.id).toBe(act1.id)
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
})
