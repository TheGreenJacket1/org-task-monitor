import { describe, it, expect, beforeEach } from 'vitest'
import { storageService } from '../services/storage'

describe('Urutan manual, bulk create, dan template tugas', () => {
  beforeEach(() => {
    localStorage.clear()
    storageService.loadDemoData()
  })

  it('reorderTasks menyimpan urutan baru berdasarkan activity', async () => {
    const orgId = storageService.getOrganizations()[0].id
    const act = storageService.getActivities(orgId).find((a) => !a.is_archived)!
    const tasks = storageService.getTasks(orgId, act.id, true)
    expect(tasks.length).toBeGreaterThan(1)

    const reversed = [...tasks].map((t) => t.id).reverse()
    const changed = storageService.reorderTasks(act.id, reversed)
    expect(changed).toBe(true)

    const after = storageService.getTasks(orgId, act.id, true)
    expect(after.map((t) => t.id)).toEqual(reversed)
    expect(after[0].sort_order).toBe(0)
  })

  it('reorderTasks mengabaikan id yang tidak dikenal', () => {
    const orgId = storageService.getOrganizations()[0].id
    const act = storageService.getActivities(orgId).find((a) => !a.is_archived)!
    const before = storageService.getTasks(orgId, act.id, true).map((t) => t.id)
    const changed = storageService.reorderTasks(act.id, [...before, 'id-hantu'])
    // id-hantu tidak mengubah urutan nyata
    expect(changed).toBe(false)
    expect(storageService.getTasks(orgId, act.id, true).map((t) => t.id)).toEqual(before)
  })

  it('bulkCreateTasks membuat banyak tugas dan mengabaikan judul kosong', async () => {
    const orgId = storageService.getOrganizations()[0].id
    const act = storageService.getActivities(orgId).find((a) => !a.is_archived)!
    const before = storageService.getTasks(orgId, act.id, true).length

    const result = await storageService.bulkCreateTasks([
      { title: 'Tugas Impor 1', activity_id: act.id, organization_id: orgId, pic_id: 'demo-m-1' },
      { title: 'Tugas Impor 2', activity_id: act.id, organization_id: orgId, pic_id: 'demo-m-2' },
      { title: '   ', activity_id: act.id, organization_id: orgId, pic_id: 'demo-m-1' },
    ])

    expect(result.created).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.errors.length).toBe(1)
    const after = storageService.getTasks(orgId, act.id, true).length
    expect(after).toBe(before + 2)
  })

  it('bulkCreateTasks menolak tugas tanpa kegiatan', async () => {
    const orgId = storageService.getOrganizations()[0].id
    const result = await storageService.bulkCreateTasks([
      { title: 'Tanpa Kegiatan', activity_id: '', organization_id: orgId },
    ])
    expect(result.created).toBe(0)
    expect(result.failed).toBe(1)
  })

  it('template tugas bisa disimpan, diubah, dan dihapus', () => {
    expect(storageService.getTaskTemplates()).toHaveLength(0)

    const created = storageService.saveTaskTemplate({
      name: 'Template Proposal',
      description: 'Template untuk proposal',
      category: 'Administrasi',
      phase: 'Pra-acara',
      priority: 'Tinggi',
      default_duration_days: 7,
    })
    expect(storageService.getTaskTemplates()).toHaveLength(1)
    expect(created.id).toBeTruthy()

    const updated = storageService.saveTaskTemplate({
      id: created.id,
      name: 'Template Proposal Revisi',
      description: 'Template untuk proposal',
      category: 'Administrasi',
      phase: 'Pra-acara',
      priority: 'Mendesak',
      default_duration_days: 10,
    })
    expect(updated.name).toBe('Template Proposal Revisi')
    expect(storageService.getTaskTemplates()).toHaveLength(1)

    expect(storageService.deleteTaskTemplate(created.id)).toBe(true)
    expect(storageService.getTaskTemplates()).toHaveLength(0)
    expect(storageService.deleteTaskTemplate('tidak-ada')).toBe(false)
  })
})
