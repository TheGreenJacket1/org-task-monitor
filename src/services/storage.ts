import {
  Organization,
  Member,
  Activity,
  Task,
  ActivityLog,
  SyncStatus,
} from '../types'
import {
  initialDemoOrganization,
  initialDemoMembers,
  initialDemoActivities,
  initialDemoTasks,
  initialDemoLogs,
} from '../data/demoData'
import { getSupabaseClient } from './supabase'

const STORAGE_KEYS = {
  ORGANIZATIONS: 'org_monitor_organizations_v1',
  MEMBERS: 'org_monitor_members_v1',
  ACTIVITIES: 'org_monitor_activities_v1',
  TASKS: 'org_monitor_tasks_v1',
  LOGS: 'org_monitor_logs_v1',
  CURRENT_ORG_ID: 'org_monitor_current_org_id_v1',
  INITIALIZED: 'org_monitor_initialized_v1',
}

export interface BackupData {
  version: string
  exportedAt: string
  organizations: Organization[]
  members: Member[]
  activities: Activity[]
  tasks: Task[]
  activityLogs: ActivityLog[]
}

class StorageService {
  private syncListeners: Set<(status: SyncStatus) => void> = new Set()
  private dataChangeListeners: Set<() => void> = new Set()
  private realtimeChannel: any = null
  private syncStatus: SyncStatus = {
    mode: 'demo',
    isConnected: false,
    isSyncing: false,
    lastSyncAt: null,
  }

  constructor() {
    this.ensureInitialized()
    this.initSupabaseSync()
  }

  private ensureInitialized() {
    try {
      const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED)
      if (!initialized) {
        this.loadDemoDataInternal()
        localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true')
      }
    } catch (e) {
      console.warn('LocalStorage tidak dapat diakses:', e)
    }
  }

  private loadDemoDataInternal() {
    localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify([initialDemoOrganization]))
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(initialDemoMembers))
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(initialDemoActivities))
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(initialDemoTasks))
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(initialDemoLogs))
    localStorage.setItem(STORAGE_KEYS.CURRENT_ORG_ID, initialDemoOrganization.id)
  }

  public onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.syncListeners.add(callback)
    callback(this.syncStatus)
    return () => this.syncListeners.delete(callback)
  }

  public onDataChange(callback: () => void): () => void {
    this.dataChangeListeners.add(callback)
    return () => this.dataChangeListeners.delete(callback)
  }

  private notifyDataChange() {
    this.dataChangeListeners.forEach((cb) => {
      try {
        cb()
      } catch (err) {
        console.error('Error on data change listener:', err)
      }
    })
  }

  private updateSyncStatus(patch: Partial<SyncStatus>) {
    this.syncStatus = { ...this.syncStatus, ...patch }
    this.syncListeners.forEach((cb) => {
      try {
        cb(this.syncStatus)
      } catch (err) {
        console.error('Error updating sync listener:', err)
      }
    })
  }

  public async initSupabaseSync() {
    const supabase = getSupabaseClient()
    if (!supabase) {
      this.updateSyncStatus({
        mode: 'local',
        isConnected: false,
        isSyncing: false,
      })
      return
    }

    this.updateSyncStatus({
      mode: 'supabase',
      isConnected: false,
      isSyncing: true,
    })

    try {
      // Test query to organizations
      const { data, error } = await supabase.from('organizations').select('id').limit(1)
      if (error) {
        throw error
      }

      this.updateSyncStatus({
        isConnected: true,
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
      })

      // Pull initial data from Supabase
      await this.pullFromSupabase()

      // Subscribe to Realtime changes across devices
      this.setupRealtimeSubscription(supabase)
    } catch (err: any) {
      console.warn('Gagal terhubung ke Supabase, menggunakan cache lokal:', err.message)
      this.updateSyncStatus({
        isConnected: false,
        isSyncing: false,
        errorMessage: err.message || 'Koneksi gagal',
      })
    }
  }

  private setupRealtimeSubscription(supabase: any) {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel)
    }

    this.realtimeChannel = supabase
      .channel('public:org_monitor_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          this.pullFromSupabase()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        () => {
          this.pullFromSupabase()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => {
          this.pullFromSupabase()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organizations' },
        () => {
          this.pullFromSupabase()
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.updateSyncStatus({ isConnected: true })
        }
      })
  }

  public async pullFromSupabase(): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    try {
      this.updateSyncStatus({ isSyncing: true })
      const [orgsRes, memsRes, actsRes, tasksRes, logsRes] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at', { ascending: false }),
        supabase.from('members').select('*').order('created_at', { ascending: true }),
        supabase.from('activities').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200),
      ])

      if (orgsRes.error) throw orgsRes.error
      if (memsRes.error) throw memsRes.error
      if (actsRes.error) throw actsRes.error
      if (tasksRes.error) throw tasksRes.error

      // Hanya timpa data lokal jika Supabase benar-benar memiliki data,
      // agar data lokal (termasuk demo) tidak hilang saat terhubung ke proyek kosong.
      if (orgsRes.data && orgsRes.data.length > 0) {
        localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(orgsRes.data))
      }
      if (memsRes.data && memsRes.data.length > 0) {
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(memsRes.data))
      }
      if (actsRes.data && actsRes.data.length > 0) {
        localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(actsRes.data))
      }
      if (tasksRes.data && tasksRes.data.length > 0) {
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasksRes.data))
      }
      if (logsRes.data && logsRes.data.length > 0) {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logsRes.data))
      }

      this.updateSyncStatus({
        isConnected: true,
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
      })
      this.notifyDataChange()
      return true
    } catch (err: any) {
      console.warn('Gagal menyinkronkan data dari Supabase:', err.message)
      this.updateSyncStatus({ isSyncing: false, errorMessage: err.message })
      return false
    }
  }

  // --- CRUD: Organizations ---

  public getOrganizations(): Organization[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ORGANIZATIONS)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  public getCurrentOrgId(): string {
    const orgs = this.getOrganizations()
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_ORG_ID)
    if (stored && orgs.some((o) => o.id === stored)) {
      return stored
    }
    if (orgs.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_ORG_ID, orgs[0].id)
      return orgs[0].id
    }
    return ''
  }

  public setCurrentOrgId(id: string): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_ORG_ID, id)
    this.notifyDataChange()
  }

  public async createOrganization(data: Omit<Organization, 'id' | 'created_at' | 'updated_at'>): Promise<Organization> {
    const newOrg: Organization = {
      ...data,
      id: crypto.randomUUID ? crypto.randomUUID() : 'org-' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const orgs = this.getOrganizations()
    orgs.unshift(newOrg)
    localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(orgs))
    this.setCurrentOrgId(newOrg.id)

    // Sync to Supabase if available
    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('organizations').insert(newOrg)
      } catch (e) {
        console.warn('Gagal simpan org ke Supabase:', e)
      }
    }

    await this.logActivity(newOrg.id, undefined, undefined, 'Sistem', 'ORGANISASI_DIBUAT', `Membuat organisasi "${newOrg.name}" (${newOrg.code})`)
    this.notifyDataChange()
    return newOrg
  }

  public async updateOrganization(id: string, patch: Partial<Organization>): Promise<Organization | null> {
    const orgs = this.getOrganizations()
    const idx = orgs.findIndex((o) => o.id === id)
    if (idx === -1) return null

    const updated: Organization = {
      ...orgs[idx],
      ...patch,
      updated_at: new Date().toISOString(),
    }
    orgs[idx] = updated
    localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(orgs))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('organizations').update(updated).eq('id', id)
      } catch (e) {
        console.warn('Gagal update org ke Supabase:', e)
      }
    }

    this.notifyDataChange()
    return updated
  }

  public async deleteOrganization(id: string): Promise<boolean> {
    let orgs = this.getOrganizations()
    orgs = orgs.filter((o) => o.id !== id)
    localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(orgs))

    // Cascade delete members, activities, tasks locally
    const mems = this.getMembers(id)
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(this.getAllMembers().filter((m) => m.organization_id !== id)))
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(this.getAllActivities().filter((a) => a.organization_id !== id)))
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(this.getAllTasks().filter((t) => t.organization_id !== id)))

    if (this.getCurrentOrgId() === id) {
      const remaining = this.getOrganizations()
      if (remaining.length > 0) {
        this.setCurrentOrgId(remaining[0].id)
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG_ID)
      }
    }

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('organizations').delete().eq('id', id)
      } catch (e) {
        console.warn('Gagal hapus org di Supabase:', e)
      }
    }

    this.notifyDataChange()
    return true
  }

  // --- CRUD: Members ---

  private getAllMembers(): Member[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MEMBERS)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  public getMembers(orgId: string, onlyActive = false): Member[] {
    const all = this.getAllMembers().filter((m) => m.organization_id === orgId)
    return onlyActive ? all.filter((m) => m.is_active) : all
  }

  public async createMember(data: Omit<Member, 'id' | 'created_at'>): Promise<Member> {
    const newMember: Member = {
      ...data,
      id: crypto.randomUUID ? crypto.randomUUID() : 'm-' + Date.now(),
      created_at: new Date().toISOString(),
    }

    const all = this.getAllMembers()
    all.push(newMember)
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('members').insert(newMember)
      } catch (e) {
        console.warn('Gagal simpan anggota ke Supabase:', e)
      }
    }

    await this.logActivity(newMember.organization_id, undefined, undefined, 'Sistem', 'ANGGOTA_DITAMBAH', `Menambahkan anggota: ${newMember.name} (${newMember.role})`)
    this.notifyDataChange()
    return newMember
  }

  public async updateMember(id: string, patch: Partial<Member>): Promise<Member | null> {
    const all = this.getAllMembers()
    const idx = all.findIndex((m) => m.id === id)
    if (idx === -1) return null

    const updated: Member = { ...all[idx], ...patch }
    all[idx] = updated
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('members').update(updated).eq('id', id)
      } catch (e) {
        console.warn('Gagal update anggota di Supabase:', e)
      }
    }

    this.notifyDataChange()
    return updated
  }

  public async deleteMember(id: string): Promise<boolean> {
    // Check if member is PIC in any active tasks
    const allTasks = this.getAllTasks()
    const assignedTasks = allTasks.filter((t) => t.pic_id === id && !t.is_archived)
    if (assignedTasks.length > 0) {
      throw new Error(`Anggota tidak dapat dihapus karena masih menjadi PIC pada ${assignedTasks.length} tugas aktif. Ubah PIC tugas terlebih dahulu.`)
    }

    const all = this.getAllMembers().filter((m) => m.id !== id)
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('members').delete().eq('id', id)
      } catch (e) {
        console.warn('Gagal hapus anggota di Supabase:', e)
      }
    }

    this.notifyDataChange()
    return true
  }

  // --- CRUD: Activities ---

  private getAllActivities(): Activity[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITIES)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  public getActivities(orgId: string): Activity[] {
    return this.getAllActivities().filter((a) => a.organization_id === orgId)
  }

  public getActiveActivity(orgId: string): Activity | null {
    const acts = this.getActivities(orgId)
    return acts.find((a) => a.is_active && !a.is_archived) || null
  }

  public async createActivity(data: Omit<Activity, 'id' | 'created_at' | 'updated_at'>): Promise<Activity> {
    const all = this.getAllActivities()
    const orgId = data.organization_id

    // Rule: "Setiap organisasi dapat memiliki beberapa kegiatan, tetapi hanya satu kegiatan aktif pada satu waktu."
    if (data.is_active) {
      for (const act of all) {
        if (act.organization_id === orgId && act.is_active) {
          act.is_active = false
          act.updated_at = new Date().toISOString()
        }
      }
    }

    const newActivity: Activity = {
      ...data,
      id: crypto.randomUUID ? crypto.randomUUID() : 'act-' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    all.unshift(newActivity)
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        if (newActivity.is_active) {
          await supabase.from('activities').update({ is_active: false }).eq('organization_id', orgId)
        }
        await supabase.from('activities').insert(newActivity)
      } catch (e) {
        console.warn('Gagal simpan kegiatan di Supabase:', e)
      }
    }

    await this.logActivity(orgId, newActivity.id, undefined, 'Sistem', 'KEGIATAN_DIBUAT', `Membuat kegiatan "${newActivity.name}" (Status aktif: ${newActivity.is_active ? 'Ya' : 'Tidak'})`)
    this.notifyDataChange()
    return newActivity
  }

  public async setActiveActivity(orgId: string, activityId: string): Promise<boolean> {
    const all = this.getAllActivities()
    let found = false

    for (const act of all) {
      if (act.organization_id === orgId) {
        if (act.id === activityId) {
          act.is_active = true
          act.is_archived = false // Unarchive if archived
          act.updated_at = new Date().toISOString()
          found = true
        } else if (act.is_active) {
          act.is_active = false
          act.updated_at = new Date().toISOString()
        }
      }
    }

    if (!found) return false
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('activities').update({ is_active: false }).eq('organization_id', orgId)
        await supabase.from('activities').update({ is_active: true, is_archived: false }).eq('id', activityId)
      } catch (e) {
        console.warn('Gagal update kegiatan aktif di Supabase:', e)
      }
    }

    await this.logActivity(orgId, activityId, undefined, 'Sistem', 'KEGIATAN_AKTIF', `Menetapkan kegiatan aktif saat ini.`)
    this.notifyDataChange()
    return true
  }

  public async archiveActivity(orgId: string, activityId: string): Promise<boolean> {
    const all = this.getAllActivities()
    const act = all.find((a) => a.id === activityId && a.organization_id === orgId)
    if (!act) return false

    act.is_archived = true
    act.is_active = false // Can't be active if archived
    act.updated_at = new Date().toISOString()

    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('activities').update({ is_archived: true, is_active: false }).eq('id', activityId)
      } catch (e) {
        console.warn('Gagal arsip kegiatan di Supabase:', e)
      }
    }

    await this.logActivity(orgId, activityId, undefined, 'Sistem', 'KEGIATAN_DIARSIPKAN', `Mengarsipkan kegiatan "${act.name}". Seluruh data tugas tetap tersimpan aman.`)
    this.notifyDataChange()
    return true
  }

  public async unarchiveActivity(orgId: string, activityId: string): Promise<boolean> {
    const all = this.getAllActivities()
    const act = all.find((a) => a.id === activityId && a.organization_id === orgId)
    if (!act) return false

    act.is_archived = false
    act.updated_at = new Date().toISOString()

    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('activities').update({ is_archived: false }).eq('id', activityId)
      } catch (e) {
        console.warn('Gagal buka arsip kegiatan di Supabase:', e)
      }
    }

    await this.logActivity(orgId, activityId, undefined, 'Sistem', 'KEGIATAN_DIBUKA_ARSIP', `Membuka kembali arsip kegiatan "${act.name}".`)
    this.notifyDataChange()
    return true
  }

  // --- CRUD: Tasks ---

  private getAllTasks(): Task[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TASKS)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  public getTasks(orgId: string, activityId?: string, includeArchived = false): Task[] {
    let tasks = this.getAllTasks().filter((t) => t.organization_id === orgId)
    if (activityId) {
      tasks = tasks.filter((t) => t.activity_id === activityId)
    }
    if (!includeArchived) {
      tasks = tasks.filter((t) => !t.is_archived)
    }
    return tasks
  }

  public async createTask(data: Omit<Task, 'id' | 'created_at' | 'updated_at'>, actorName = 'Pengguna'): Promise<Task> {
    // Normalization rules
    let progress = Number(data.progress) || 0
    let completed_at = data.completed_at

    if (data.status === 'Selesai') {
      progress = 100
      if (!completed_at) {
        completed_at = new Date().toISOString()
      }
    } else {
      completed_at = null
    }

    const newTask: Task = {
      ...data,
      progress,
      completed_at,
      reference_links: data.reference_links || [],
      result_links: data.result_links || [],
      id: crypto.randomUUID ? crypto.randomUUID() : 'task-' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const all = this.getAllTasks()
    all.unshift(newTask)
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('tasks').insert(newTask)
      } catch (e) {
        console.warn('Gagal simpan tugas ke Supabase:', e)
      }
    }

    await this.logActivity(newTask.organization_id, newTask.activity_id, newTask.id, actorName, 'TUGAS_DIBUAT', `Membuat tugas "${newTask.title}" [${newTask.category} | ${newTask.priority}]`)
    this.notifyDataChange()
    return newTask
  }

  public async updateTask(id: string, patch: Partial<Task>, actorName = 'Pengguna'): Promise<Task | null> {
    const all = this.getAllTasks()
    const idx = all.findIndex((t) => t.id === id)
    if (idx === -1) return null

    const oldTask = all[idx]
    let progress = patch.progress !== undefined ? Number(patch.progress) : oldTask.progress
    let status = patch.status || oldTask.status
    let completed_at = patch.completed_at !== undefined ? patch.completed_at : oldTask.completed_at

    // Enforce business rules
    // Rule: "Tugas berstatus Selesai harus memiliki progres 100% dan tanggal selesai."
    if (status === 'Selesai') {
      progress = 100
      if (!completed_at) {
        completed_at = new Date().toISOString()
      }
    } else if (oldTask.status === 'Selesai') {
      completed_at = null
      if (progress === 100 && patch.progress === undefined) {
        progress = 90
      }
    }

    const updated: Task = {
      ...oldTask,
      ...patch,
      status,
      progress,
      completed_at,
      updated_at: new Date().toISOString(),
    }

    all[idx] = updated
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('tasks').update(updated).eq('id', id)
      } catch (e) {
        console.warn('Gagal update tugas di Supabase:', e)
      }
    }

    // Detail logging
    let actionLog = 'TUGAS_DIPERBARUI'
    let detailLog = `Memperbarui tugas "${updated.title}"`
    if (oldTask.status !== updated.status) {
      actionLog = 'STATUS_TUGAS_DIUBAH'
      detailLog = `Mengubah status dari "${oldTask.status}" menjadi "${updated.status}"`
      if (updated.status === 'Revisi' && updated.revision_notes) {
        detailLog += `. Catatan: "${updated.revision_notes}"`
      }
    } else if (oldTask.progress !== updated.progress) {
      actionLog = 'PROGRES_TUGAS_DIUBAH'
      detailLog = `Mengubah progres dari ${oldTask.progress}% ke ${updated.progress}%`
    }

    await this.logActivity(updated.organization_id, updated.activity_id, updated.id, actorName, actionLog, detailLog)
    this.notifyDataChange()
    return updated
  }

  public async archiveTask(id: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllTasks()
    const task = all.find((t) => t.id === id)
    if (!task) return false

    task.is_archived = true
    task.updated_at = new Date().toISOString()
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('tasks').update({ is_archived: true }).eq('id', id)
      } catch (e) {
        console.warn('Gagal arsip tugas di Supabase:', e)
      }
    }

    await this.logActivity(task.organization_id, task.activity_id, task.id, actorName, 'TUGAS_DIARSIPKAN', `Mengarsipkan tugas "${task.title}".`)
    this.notifyDataChange()
    return true
  }

  public async unarchiveTask(id: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllTasks()
    const task = all.find((t) => t.id === id)
    if (!task) return false

    task.is_archived = false
    task.updated_at = new Date().toISOString()
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('tasks').update({ is_archived: false }).eq('id', id)
      } catch (e) {
        console.warn('Gagal unarchive tugas di Supabase:', e)
      }
    }

    await this.logActivity(task.organization_id, task.activity_id, task.id, actorName, 'TUGAS_DIBUKA_ARSIP', `Mengembalikan tugas "${task.title}" dari arsip.`)
    this.notifyDataChange()
    return true
  }

  public async deleteTask(id: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllTasks()
    const task = all.find((t) => t.id === id)
    if (!task) return false

    const filtered = all.filter((t) => t.id !== id)
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(filtered))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('tasks').delete().eq('id', id)
      } catch (e) {
        console.warn('Gagal hapus tugas di Supabase:', e)
      }
    }

    await this.logActivity(task.organization_id, task.activity_id, undefined, actorName, 'TUGAS_DIHAPUS', `Menghapus tugas "${task.title}".`)
    this.notifyDataChange()
    return true
  }

  // --- CRUD: Logs ---

  public getActivityLogs(orgId: string, limit = 50): ActivityLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOGS)
      const logs: ActivityLog[] = raw ? JSON.parse(raw) : []
      return logs.filter((l) => l.organization_id === orgId).slice(0, limit)
    } catch {
      return []
    }
  }

  public async logActivity(
    orgId: string,
    activityId: string | undefined,
    taskId: string | undefined,
    actorName: string,
    action: string,
    details: string
  ): Promise<void> {
    const newLog: ActivityLog = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'log-' + Date.now(),
      organization_id: orgId,
      activity_id: activityId,
      task_id: taskId,
      actor_name: actorName,
      action,
      details,
      created_at: new Date().toISOString(),
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOGS)
      const logs: ActivityLog[] = raw ? JSON.parse(raw) : []
      logs.unshift(newLog)
      // Keep up to 500 logs locally
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(0, 500)))
    } catch (e) {
      console.warn('Gagal simpan log lokal:', e)
    }

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('activity_logs').insert(newLog)
      } catch (e) {
        // Silently log
      }
    }
  }

  // --- Demo Data Management ---

  public loadDemoData(): void {
    this.loadDemoDataInternal()
    this.notifyDataChange()
  }

  public clearDemoData(): void {
    // Delete items with demo prefix or marked with demo id
    const orgs = this.getOrganizations().filter((o) => !o.id.startsWith('demo-') && !o.name.includes('[DEMO]'))
    const mems = this.getAllMembers().filter((m) => !m.id.startsWith('demo-') && !m.organization_id.startsWith('demo-'))
    const acts = this.getAllActivities().filter((a) => !a.id.startsWith('demo-') && !a.organization_id.startsWith('demo-'))
    const tasks = this.getAllTasks().filter((t) => !t.id.startsWith('demo-') && !t.organization_id.startsWith('demo-'))
    const logs = this.getActivityLogs('').filter((l) => !l.id.startsWith('demo-') && !l.organization_id.startsWith('demo-'))

    localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(orgs))
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(mems))
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(acts))
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks))
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs))

    if (orgs.length > 0) {
      this.setCurrentOrgId(orgs[0].id)
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG_ID)
    }

    this.notifyDataChange()
  }

  // --- Backup & Restore (Rp0 Disaster Recovery) ---

  public exportAllData(): string {
    const backup: BackupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      organizations: this.getOrganizations(),
      members: this.getAllMembers(),
      activities: this.getAllActivities(),
      tasks: this.getAllTasks(),
      activityLogs: this.getActivityLogs('', 1000),
    }
    return JSON.stringify(backup, null, 2)
  }

  public importAllData(jsonStr: string): { success: boolean; message: string; count?: number } {
    try {
      const data = JSON.parse(jsonStr) as BackupData
      if (!data.organizations || !Array.isArray(data.organizations)) {
        return { success: false, message: 'Format data tidak valid: Properti organizations hilang.' }
      }
      if (!data.tasks || !Array.isArray(data.tasks)) {
        return { success: false, message: 'Format data tidak valid: Properti tasks hilang.' }
      }

      localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(data.organizations))
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(data.members || []))
      localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(data.activities || []))
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(data.tasks || []))
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(data.activityLogs || []))

      if (data.organizations.length > 0) {
        this.setCurrentOrgId(data.organizations[0].id)
      }

      this.notifyDataChange()
      return {
        success: true,
        message: 'Pemulihan data berhasil!',
        count: data.tasks.length,
      }
    } catch (e: any) {
      return { success: false, message: `Gagal membaca file JSON: ${e.message}` }
    }
  }
}

export const storageService = new StorageService()
