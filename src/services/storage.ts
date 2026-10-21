import {
  Organization,
  Member,
  Activity,
  Task,
  ActivityLog,
  ActivityMember,
  TaskTemplate,
  SyncStatus,
} from '../types'
import {
  initialDemoOrganization,
  initialDemoMembers,
  initialDemoActivities,
  initialDemoTasks,
  initialDemoLogs,
} from '../data/demoData'
import { getSupabaseClient, isMissingRelation } from './supabase'
import { migrateLocalData } from './localMigration'

import { STORAGE_KEYS } from './storageKeys'

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
    try {
      migrateLocalData(localStorage)
    } catch (e) {
      console.warn('Migrasi lokal gagal:', e)
    }
    this.initSupabaseSync()
  }

  private ensureInitialized() {
    try {
      const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED)
      // Seed demo data ONLY if every data key is absent. Never overwrite existing data,
      // even if the initialized flag is missing (e.g. after a partial restore).
      const hasAnyData = [
        STORAGE_KEYS.ORGANIZATIONS,
        STORAGE_KEYS.MEMBERS,
        STORAGE_KEYS.ACTIVITIES,
        STORAGE_KEYS.TASKS,
        STORAGE_KEYS.LOGS,
      ].some((k) => localStorage.getItem(k) !== null)

      if (hasAnyData) {
        if (!initialized) {
          localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true')
        }
        return
      }

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
      const { error } = await supabase.from('organizations').select('id').limit(1)
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

  private pullGeneration = 0

  public async pullFromSupabase(_options?: { force?: boolean }): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    const gen = ++this.pullGeneration
    this.updateSyncStatus({ isSyncing: true, errorMessage: undefined })

    try {
      // Fetch all tables in parallel.
      const [orgsRes, memsRes, actsRes, tasksRes, logsRes, amRes, metaRes] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at', { ascending: false }),
        supabase.from('members').select('*').order('created_at', { ascending: true }),
        supabase.from('activities').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        this.fetchAllLogs(supabase),
        supabase.from('activity_members').select('*'),
        supabase.from('app_meta').select('key,value'),
      ])

      // Stale pull: a newer pull started; discard.
      if (gen !== this.pullGeneration) return false

      // Hard errors (except missing activity_members / app_meta) abort the whole pull.
      if (orgsRes.error) throw orgsRes.error
      if (memsRes.error) throw memsRes.error
      if (actsRes.error) throw actsRes.error
      if (tasksRes.error) throw tasksRes.error
      if (logsRes.error) throw logsRes.error

      const amMissing = amRes.error && isMissingRelation(amRes.error)
      if (amRes.error && !amMissing) throw amRes.error

      const metaMissing = metaRes.error && isMissingRelation(metaRes.error)
      if (metaRes.error && !metaMissing) throw metaRes.error

      const orgs = (orgsRes.data ?? []) as any[]
      const members = (memsRes.data ?? []) as any[]
      const activities = (actsRes.data ?? []) as any[]
      const tasks = (tasksRes.data ?? []) as any[]
      const logs = (logsRes.data ?? []) as any[]
      const activityMembers = amMissing ? null : ((amRes.data ?? []) as any[])

      // Parse app_meta.
      const meta: Record<string, unknown> = {}
      if (!metaMissing && Array.isArray(metaRes.data)) {
        for (const row of metaRes.data) {
          if (row && typeof row.key === 'string') meta[row.key] = row.value
        }
      }
      const cloudInitialized = meta['cloud_initialized_at'] !== undefined

      const localHasData = this.getOrganizations().length > 0

      // If cloud is empty AND not explicitly initialized, do NOT overwrite local data.
      // Surface a decision instead.
      if (orgs.length === 0 && !cloudInitialized) {
        this.updateSyncStatus({
          isConnected: true,
          isSyncing: false,
          lastSyncAt: new Date().toISOString(),
          errorMessage: localHasData
            ? 'Cloud kosong. Data lokal belum diunggah. Buka Pengaturan untuk mengunggah atau gunakan cloud kosong.'
            : undefined,
        })
        if (localHasData) {
          // Mark as needs decision by leaving local untouched.
          this.notifyDataChange()
          return false
        }
        // Cloud genuinely empty and local empty: write empty arrays (no-op mostly).
      }

      // Full snapshot replace when cloud is initialized (or cloud has data).
      if (cloudInitialized || orgs.length > 0) {
        localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(orgs))
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members))
        localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities))
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks))
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs))
        if (activityMembers) {
          localStorage.setItem(STORAGE_KEYS.ACTIVITY_MEMBERS, JSON.stringify(activityMembers))
        }
        // If cloud table missing, keep local membership (fallback) but warn.
        if (amMissing) {
          console.warn('Tabel activity_members belum ada di Supabase. Gunakan data membership lokal + jalankan migrasi SQL.')
        }
      }

      this.updateSyncStatus({
        isConnected: true,
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
        errorMessage: amMissing ? 'Migrasi database belum dijalankan (activity_members tidak ditemukan).' : undefined,
      })
      this.notifyDataChange()
      return true
    } catch (err: any) {
      console.warn('Gagal menyinkronkan data dari Supabase:', err?.message)
      this.updateSyncStatus({ isSyncing: false, errorMessage: err?.message || 'Sinkronisasi gagal' })
      return false
    }
  }

  private async fetchAllLogs(supabase: any): Promise<{ data: any[] | null; error: any }> {
    const pageSize = 1000
    const all: any[] = []
    let offset = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)
      if (error) return { data: null, error }
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < pageSize) break
      offset += pageSize
    }
    return { data: all, error: null }
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
        const { error } = await supabase.from('organizations').insert(newOrg)
        if (error) throw error
      } catch (e: any) {
        console.warn('Gagal simpan org ke Supabase:', e)
        this.updateSyncStatus({ errorMessage: e?.message || 'Gagal simpan org ke Supabase' })
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
        const { error } = await supabase.from('organizations').update(updated).eq('id', id)
        if (error) throw error
      } catch (e: any) {
        console.warn('Gagal update org ke Supabase:', e)
        this.updateSyncStatus({ errorMessage: e?.message || 'Gagal update org ke Supabase' })
      }
    }

    this.notifyDataChange()
    return updated
  }

  public async deleteOrganization(id: string): Promise<boolean> {
    const wasCurrentOrg = this.getCurrentOrgId() === id
    let orgs = this.getOrganizations()
    orgs = orgs.filter((o) => o.id !== id)
    localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(orgs))

    // Cascade delete members, activities, tasks, and logs locally
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(this.getAllMembers().filter((m) => m.organization_id !== id)))
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(this.getAllActivities().filter((a) => a.organization_id !== id)))
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(this.getAllTasks().filter((t) => t.organization_id !== id)))
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(this.getAllLogs().filter((l) => l.organization_id !== id)))

    if (wasCurrentOrg) {
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

  /**
   * Prevents creating orphan records (organization_id empty or pointing to a
   * deleted organization) that would never appear in any organization view.
   */
  private assertOrganizationExists(orgId?: string): void {
    if (!orgId) {
      throw new Error('Organisasi belum dipilih. Buat atau pilih organisasi terlebih dahulu.')
    }
    if (!this.getOrganizations().some((o) => o.id === orgId)) {
      throw new Error('Organisasi tidak ditemukan. Muat ulang data atau buat organisasi baru.')
    }
  }

  private getAllMembers(): Member[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MEMBERS)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  public getMembers(orgId: string, onlyActive = false, options?: { includeDeleted?: boolean }): Member[] {
    let all = this.getAllMembers().filter((m) => m.organization_id === orgId)
    if (!options?.includeDeleted) {
      all = all.filter((m) => !m.deleted_at)
    }
    return onlyActive ? all.filter((m) => m.is_active) : all
  }

  public getMemberById(id: string, options?: { includeDeleted?: boolean }): Member | null {
    const m = this.getAllMembers().find((x) => x.id === id)
    if (!m) return null
    if (!options?.includeDeleted && m.deleted_at) return null
    return m
  }

  // --- Trash accessors ---
  public getDeletedTasks(orgId: string, activityId?: string): Task[] {
    return this.getTasks(orgId, activityId, true, { includeDeleted: true, includeTasksOfDeletedActivities: true })
      .filter((t) => !!t.deleted_at)
  }
  public getDeletedActivities(orgId: string): Activity[] {
    return this.getActivities(orgId, { includeDeleted: true }).filter((a) => !!a.deleted_at)
  }
  public getDeletedMembers(orgId: string): Member[] {
    return this.getMembers(orgId, false, { includeDeleted: true }).filter((m) => !!m.deleted_at)
  }
  public getActivityImpact(activityId: string): { tasks: number; members: number; logs: number } {
    const tasks = this.getAllTasks().filter((t) => t.activity_id === activityId && !t.deleted_at).length
    const members = this.getAllActivityMembers().filter((am) => am.activity_id === activityId).length
    const logs = this.getAllLogs().filter((l) => l.activity_id === activityId && !l.deleted_at).length
    return { tasks, members, logs }
  }

  public getOrganizationImpact(orgId: string): { activities: number; tasks: number; members: number; logs: number } {
    const activities = this.getAllActivities().filter((a) => a.organization_id === orgId && !a.deleted_at).length
    const tasks = this.getAllTasks().filter((t) => t.organization_id === orgId && !t.deleted_at).length
    const members = this.getAllMembers().filter((m) => m.organization_id === orgId && !m.deleted_at).length
    const logs = this.getAllLogs().filter((l) => l.organization_id === orgId && !l.deleted_at).length
    return { activities, tasks, members, logs }
  }

  public getDeletedLogs(orgId: string, limit = 200, activityId?: string): ActivityLog[] {
    return this.getActivityLogs(orgId, limit, { includeDeleted: true, includeArchived: true, activityId })
      .filter((l) => !!l.deleted_at)
  }

  // --- activity_members repository ---
  private getAllActivityMembers(): ActivityMember[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITY_MEMBERS)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((x) => (typeof x === 'object' && x && typeof x.activity_id === 'string' && typeof x.member_id === 'string'
          ? { activity_id: x.activity_id, member_id: x.member_id, created_at: typeof x.created_at === 'string' ? x.created_at : new Date().toISOString() }
          : null))
        .filter((x): x is ActivityMember => x !== null)
    } catch {
      return []
    }
  }

  public getActivityMemberIds(activityId: string): string[] {
    return this.getAllActivityMembers()
      .filter((am) => am.activity_id === activityId)
      .map((am) => am.member_id)
  }

  public getActivityMembers(activityId: string, options?: { includeDeleted?: boolean }): Member[] {
    const ids = new Set(this.getActivityMemberIds(activityId))
    const activity = this.getAllActivities().find((a) => a.id === activityId)
    if (!activity) return []
    let members = this.getAllMembers().filter((m) => m.organization_id === activity.organization_id && ids.has(m.id))
    if (!options?.includeDeleted) {
      members = members.filter((m) => !m.deleted_at)
    }
    return members
  }

  public setActivityMembers(activityId: string, memberIds: string[]): boolean {
    const activity = this.getAllActivities().find((a) => a.id === activityId)
    if (!activity) return false
    const orgMembers = new Set(this.getMembers(activity.organization_id, false, { includeDeleted: true }).map((m) => m.id))
    const validIds = memberIds.filter((id) => orgMembers.has(id))
    const others = this.getAllActivityMembers().filter((am) => am.activity_id !== activityId)
    const now = new Date().toISOString()
    const next = [...others, ...validIds.map((id) => ({ activity_id: activityId, member_id: id, created_at: now }))]
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_MEMBERS, JSON.stringify(next))
    this.notifyDataChange()
    return true
  }

  public addMemberToActivity(activityId: string, memberId: string): boolean {
    const ids = this.getActivityMemberIds(activityId)
    if (ids.includes(memberId)) return true
    return this.setActivityMembers(activityId, [...ids, memberId])
  }

  public removeMemberFromActivity(activityId: string, memberId: string): boolean {
    // Block if member is PIC of any task in this activity (including archived/trashed).
    const tasks = this.getAllTasks().filter((t) => t.activity_id === activityId && t.pic_id === memberId)
    if (tasks.length > 0) {
      throw new Error(`Anggota tidak dapat dilepas karena masih menjadi PIC pada ${tasks.length} tugas di kegiatan ini.`)
    }
    const ids = this.getActivityMemberIds(activityId).filter((id) => id !== memberId)
    return this.setActivityMembers(activityId, ids)
  }

  public async createMember(data: Omit<Member, 'id' | 'created_at'>): Promise<Member> {
    this.assertOrganizationExists(data.organization_id)

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
        const { error } = await supabase.from('members').insert(newMember)
        if (error) throw error
      } catch (e: any) {
        console.warn('Gagal simpan anggota ke Supabase:', e)
        this.updateSyncStatus({ errorMessage: e?.message || 'Gagal simpan anggota ke Supabase' })
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
        const { error } = await supabase.from('members').update(updated).eq('id', id)
        if (error) throw error
      } catch (e: any) {
        console.warn('Gagal update anggota di Supabase:', e)
        this.updateSyncStatus({ errorMessage: e?.message || 'Gagal update anggota di Supabase' })
      }
    }

    this.notifyDataChange()
    return updated
  }

  public async deleteMember(id: string): Promise<boolean> {
    // Check if member is PIC in any active tasks
    const allTasks = this.getAllTasks()
    const assignedTasks = allTasks.filter((t) => t.pic_id === id)
    if (assignedTasks.length > 0) {
      throw new Error(`Anggota tidak dapat dihapus karena masih menjadi PIC pada ${assignedTasks.length} tugas (termasuk arsip/tempat sampah). Ubah PIC tugas terlebih dahulu.`)
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

  // --- Urutan manual (drag & drop) ---
  public reorderTasks(activityId: string, orderedIds: string[]): boolean {
    const all = this.getAllTasks()
    const activityTasks = all.filter((t) => t.activity_id === activityId)
    const known = new Set(activityTasks.map((t) => t.id))
    // Only ids that actually belong to this activity are considered.
    const targetOrder = orderedIds.filter((id) => known.has(id))
    if (targetOrder.length === 0) return false

    // Current order: by sort_order when available, otherwise by array position.
    const currentOrder = activityTasks
      .map((t, i) => ({ id: t.id, sort: typeof t.sort_order === 'number' ? t.sort_order : i, i }))
      .sort((a, b) => (a.sort === b.sort ? a.i - b.i : a.sort - b.sort))
      .map((x) => x.id)

    const sameLength = currentOrder.length === targetOrder.length
    const unchanged = sameLength && currentOrder.every((id, i) => id === targetOrder[i])
    if (unchanged) return false

    const index = new Map(targetOrder.map((id, i) => [id, i]))
    for (const t of all) {
      if (t.activity_id !== activityId) continue
      const next = index.get(t.id)
      if (next === undefined) continue
      t.sort_order = next
      t.updated_at = new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(all))
    this.notifyDataChange()
    return true
  }

  // --- Bulk create (CSV import & template batch) ---
  public async bulkCreateTasks(
    items: Array<Partial<Task> & { title: string }>,
    actorName = 'Pengguna'
  ): Promise<{ created: number; failed: number; errors: string[] }> {
    const errors: string[] = []
    let created = 0
    const all = this.getAllTasks()
    for (const item of items) {
      try {
        if (!item.title || !item.title.trim()) {
          errors.push('Judul tugas kosong, dilewati.')
          continue
        }
        if (!item.activity_id) {
          errors.push(`Tugas "${item.title}" tidak punya kegiatan, dilewati.`)
          continue
        }
        const now = new Date().toISOString()
        const task: Task = {
          ...(item as Task),
          id: crypto.randomUUID ? crypto.randomUUID() : 'task-' + Date.now() + '-' + Math.random().toString(16).slice(2),
          title: item.title.trim(),
          description: item.description ?? '',
          category: item.category ?? 'Lainnya',
          phase: item.phase ?? 'Pra-acara',
          priority: item.priority ?? 'Sedang',
          pic_id: item.pic_id ?? '',
          start_date: item.start_date ?? now.slice(0, 10),
          deadline: item.deadline ?? now.slice(0, 10),
          status: item.status ?? 'Belum dikerjakan',
          progress: item.progress ?? 0,
          review_status: item.review_status ?? 'Belum diajukan',
          revision_notes: item.revision_notes ?? '',
          reference_links: item.reference_links ?? [],
          result_links: item.result_links ?? [],
          completed_at: null,
          is_archived: false,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sort_order: all.length,
        }
        all.unshift(task)
        created++
        await this.logActivity(task.organization_id, task.activity_id, task.id, actorName, 'TUGAS_DIBUAT', `Membuat tugas "${task.title}" (bulk import).`)
      } catch (e: any) {
        errors.push(`Gagal menyimpan "${item.title}": ${e?.message ?? 'error'}`)
      }
    }
    if (created > 0) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(all))
      this.notifyDataChange()
    }
    return { created, failed: errors.length, errors }
  }

  // --- Task templates ---
  private getAllTemplates(): TaskTemplate[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TEMPLATES)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  public getTaskTemplates(): TaskTemplate[] {
    return this.getAllTemplates()
  }

  public saveTaskTemplate(template: Omit<TaskTemplate, 'id' | 'created_at'> & { id?: string }): TaskTemplate {
    const all = this.getAllTemplates()
    const now = new Date().toISOString()
    if (template.id) {
      const idx = all.findIndex((t) => t.id === template.id)
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...template, id: template.id, created_at: all[idx].created_at } as TaskTemplate
        localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(all))
        this.notifyDataChange()
        return all[idx]
      }
    }
    const created: TaskTemplate = {
      ...template,
      id: crypto.randomUUID ? crypto.randomUUID() : 'tpl-' + Date.now(),
      created_at: now,
    }
    all.push(created)
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(all))
    this.notifyDataChange()
    return created
  }

  public deleteTaskTemplate(id: string): boolean {
    const all = this.getAllTemplates()
    const next = all.filter((t) => t.id !== id)
    if (next.length === all.length) return false
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(next))
    this.notifyDataChange()
    return true
  }

  // --- Soft delete / restore / permanent delete (Phase 1B) ---

  public async softDeleteTask(id: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllTasks()
    const task = all.find((t) => t.id === id)
    if (!task || task.deleted_at) return false
    task.deleted_at = new Date().toISOString()
    task.updated_at = new Date().toISOString()
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(all))
    await this.logActivity(task.organization_id, task.activity_id, task.id, actorName, 'TUGAS_DIPINDAH_SAMPAH', `Memindahkan tugas "${task.title}" ke tempat sampah.`)
    this.notifyDataChange()
    return true
  }

  public async restoreTask(id: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllTasks()
    const task = all.find((t) => t.id === id)
    if (!task || !task.deleted_at) return false
    const parent = this.getAllActivities().find((a) => a.id === task.activity_id)
    if (parent?.deleted_at) {
      throw new Error('Kegiatan induk masih di tempat sampah. Pulihkan kegiatan terlebih dahulu.')
    }
    task.deleted_at = null
    task.updated_at = new Date().toISOString()
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(all))
    await this.logActivity(task.organization_id, task.activity_id, task.id, actorName, 'TUGAS_DIPULIHKAN', `Memulihkan tugas "${task.title}" dari tempat sampah.`)
    this.notifyDataChange()
    return true
  }

  public async permanentlyDeleteTask(id: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllTasks()
    const task = all.find((t) => t.id === id)
    if (!task || !task.deleted_at) return false
    const filtered = all.filter((t) => t.id !== id)
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(filtered))
    await this.logActivity(task.organization_id, task.activity_id, undefined, actorName, 'TUGAS_DIHAPUS_PERMANEN', `Menghapus permanen tugas "${task.title}".`)
    this.notifyDataChange()
    return true
  }

  public async softDeleteActivity(orgId: string, activityId: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllActivities()
    const act = all.find((a) => a.id === activityId && a.organization_id === orgId)
    if (!act || act.deleted_at) return false
    act.deleted_at = new Date().toISOString()
    act.is_active = false
    act.updated_at = new Date().toISOString()
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(all))
    await this.logActivity(orgId, activityId, undefined, actorName, 'KEGIATAN_DIPINDAH_SAMPAH', `Memindahkan kegiatan "${act.name}" ke tempat sampah.`)
    this.notifyDataChange()
    return true
  }

  public async restoreActivity(orgId: string, activityId: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllActivities()
    const act = all.find((a) => a.id === activityId && a.organization_id === orgId)
    if (!act || !act.deleted_at) return false
    act.deleted_at = null
    act.updated_at = new Date().toISOString()
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(all))
    await this.logActivity(orgId, activityId, undefined, actorName, 'KEGIATAN_DIPULIHKAN', `Memulihkan kegiatan "${act.name}" dari tempat sampah.`)
    this.notifyDataChange()
    return true
  }

  public async permanentlyDeleteActivity(orgId: string, activityId: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllActivities()
    const act = all.find((a) => a.id === activityId && a.organization_id === orgId)
    if (!act || !act.deleted_at) return false
    const tasks = this.getAllTasks().filter((t) => t.activity_id !== activityId)
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks))
    const ams = this.getAllActivityMembers().filter((am) => am.activity_id !== activityId)
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_MEMBERS, JSON.stringify(ams))
    const filtered = all.filter((a) => a.id !== activityId)
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(filtered))
    const logs = this.getAllLogs().map((l) => (l.activity_id === activityId ? { ...l, activity_id: undefined } : l))
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs))
    await this.logActivity(orgId, undefined, undefined, actorName, 'KEGIATAN_DIHAPUS_PERMANEN', `Menghapus permanen kegiatan "${act.name}".`)
    this.notifyDataChange()
    return true
  }

  public async softDeleteMember(id: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllMembers()
    const member = all.find((m) => m.id === id)
    if (!member || member.deleted_at) return false
    const assigned = this.getAllTasks().filter((t) => t.pic_id === id)
    if (assigned.length > 0) {
      throw new Error(`Anggota tidak dapat dihapus karena masih menjadi PIC pada ${assigned.length} tugas. Ubah PIC tugas terlebih dahulu.`)
    }
    member.deleted_at = new Date().toISOString()
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(all))
    const ams = this.getAllActivityMembers().filter((am) => am.member_id !== id)
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_MEMBERS, JSON.stringify(ams))
    await this.logActivity(member.organization_id, undefined, undefined, actorName, 'ANGGOTA_DIPINDAH_SAMPAH', `Memindahkan anggota "${member.name}" ke tempat sampah.`)
    this.notifyDataChange()
    return true
  }

  public async restoreMember(id: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllMembers()
    const member = all.find((m) => m.id === id)
    if (!member || !member.deleted_at) return false
    member.deleted_at = null
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(all))
    await this.logActivity(member.organization_id, undefined, undefined, actorName, 'ANGGOTA_DIPULIHKAN', `Memulihkan anggota "${member.name}" dari tempat sampah.`)
    this.notifyDataChange()
    return true
  }

  public async permanentlyDeleteMember(id: string, actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllMembers()
    const member = all.find((m) => m.id === id)
    if (!member || !member.deleted_at) return false
    const assigned = this.getAllTasks().filter((t) => t.pic_id === id)
    if (assigned.length > 0) {
      throw new Error(`Anggota tidak dapat dihapus permanen karena masih menjadi PIC pada ${assigned.length} tugas.`)
    }
    const filtered = all.filter((m) => m.id !== id)
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(filtered))
    const ams = this.getAllActivityMembers().filter((am) => am.member_id !== id)
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_MEMBERS, JSON.stringify(ams))
    await this.logActivity(member.organization_id, undefined, undefined, actorName, 'ANGGOTA_DIHAPUS_PERMANEN', `Menghapus permanen anggota "${member.name}".`)
    this.notifyDataChange()
    return true
  }

  public async softDeleteLog(id: string, _actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllLogs()
    const log = all.find((l) => l.id === id)
    if (!log || log.deleted_at) return false
    log.deleted_at = new Date().toISOString()
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(all))
    this.notifyDataChange()
    return true
  }

  public async restoreLog(id: string, _actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllLogs()
    const log = all.find((l) => l.id === id)
    if (!log || !log.deleted_at) return false
    log.deleted_at = null
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(all))
    this.notifyDataChange()
    return true
  }

  public async permanentlyDeleteLog(id: string): Promise<boolean> {
    const all = this.getAllLogs()
    const log = all.find((l) => l.id === id)
    if (!log || !log.deleted_at) return false
    const filtered = all.filter((l) => l.id !== id)
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(filtered))
    this.notifyDataChange()
    return true
  }

  public async archiveLog(id: string, _actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllLogs()
    const log = all.find((l) => l.id === id)
    if (!log) return false
    log.is_archived = true
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(all))
    this.notifyDataChange()
    return true
  }

  public async unarchiveLog(id: string, _actorName = 'Pengguna'): Promise<boolean> {
    const all = this.getAllLogs()
    const log = all.find((l) => l.id === id)
    if (!log) return false
    log.is_archived = false
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(all))
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

  public getActivities(orgId: string, options?: { includeDeleted?: boolean }): Activity[] {
    let acts = this.getAllActivities().filter((a) => a.organization_id === orgId)
    if (!options?.includeDeleted) {
      acts = acts.filter((a) => !a.deleted_at)
    }
    return acts
  }

  public getActiveActivity(orgId: string): Activity | null {
    const acts = this.getActivities(orgId)
    return acts.find((a) => a.is_active && !a.is_archived && !a.deleted_at) || null
  }

  public async createActivity(data: Omit<Activity, 'id' | 'created_at' | 'updated_at'>): Promise<Activity> {
    const all = this.getAllActivities()
    const orgId = data.organization_id
    this.assertOrganizationExists(orgId)

    // Phase 2: multiple activities may be active at the same time.
    // No auto-deactivation.

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
        const { error } = await supabase.from('activities').insert(newActivity)
        if (error) throw error
      } catch (e: any) {
        console.warn('Gagal simpan kegiatan di Supabase:', e)
        this.updateSyncStatus({ errorMessage: e?.message || 'Gagal simpan kegiatan di Supabase' })
      }
    }

    await this.logActivity(orgId, newActivity.id, undefined, 'Sistem', 'KEGIATAN_DIBUAT', `Membuat kegiatan "${newActivity.name}" (Status aktif: ${newActivity.is_active ? 'Ya' : 'Tidak'})`)
    this.notifyDataChange()
    return newActivity
  }

  public async setActivityActive(orgId: string, activityId: string, active: boolean): Promise<boolean> {
    const all = this.getAllActivities()
    const act = all.find((a) => a.id === activityId && a.organization_id === orgId)
    if (!act || act.deleted_at) return false
    if (act.is_archived && active) {
      act.is_archived = false
    }
    act.is_active = active
    act.updated_at = new Date().toISOString()
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        const { error } = await supabase.from('activities').update({ is_active: active, is_archived: act.is_archived }).eq('id', activityId)
        if (error) throw error
      } catch (e: any) {
        console.warn('Gagal update status aktif kegiatan di Supabase:', e)
        this.updateSyncStatus({ errorMessage: e?.message || 'Gagal update status aktif kegiatan' })
      }
    }

    await this.logActivity(orgId, activityId, undefined, 'Sistem', active ? 'KEGIATAN_AKTIF' : 'KEGIATAN_NONAKTIF', `Mengubah status aktif kegiatan "${act.name}".`)
    this.notifyDataChange()
    return true
  }

  // Backward-compatible wrapper (activates a single activity, no deactivation of others in Phase 2).
  public async setActiveActivity(orgId: string, activityId: string): Promise<boolean> {
    return this.setActivityActive(orgId, activityId, true)
  }

  // --- Selected activity (Phase 2) ---
  public getSelectedActivityId(orgId: string): string {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SELECTED_ACTIVITY)
      if (!raw) return ''
      const map = JSON.parse(raw)
      if (map && typeof map === 'object' && typeof map[orgId] === 'string') {
        return map[orgId]
      }
    } catch {
      // ignore
    }
    return ''
  }

  public setSelectedActivityId(orgId: string, activityId: string): void {
    try {
      let map: Record<string, string> = {}
      const raw = localStorage.getItem(STORAGE_KEYS.SELECTED_ACTIVITY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') map = parsed
      }
      if (activityId) map[orgId] = activityId
      else delete map[orgId]
      localStorage.setItem(STORAGE_KEYS.SELECTED_ACTIVITY, JSON.stringify(map))
    } catch (e) {
      console.warn('Gagal simpan selected activity:', e)
    }
    this.notifyDataChange()
  }

  public getSelectedActivity(orgId: string): Activity | null {
    const id = this.getSelectedActivityId(orgId)
    const acts = this.getActivities(orgId) // excludes deleted
    if (id) {
      const found = acts.find((a) => a.id === id)
      if (found) return found
    }
    // Fallback: active activity with most tasks, else first with tasks, else first active, else first.
    const tasksByActivity = new Map<string, number>()
    for (const t of this.getTasks(orgId, undefined, true, { includeTasksOfDeletedActivities: false })) {
      tasksByActivity.set(t.activity_id, (tasksByActivity.get(t.activity_id) ?? 0) + 1)
    }
    const sorted = [...acts].sort((a, b) => {
      const ta = tasksByActivity.get(a.id) ?? 0
      const tb = tasksByActivity.get(b.id) ?? 0
      if (tb !== ta) return tb - ta
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return sorted[0] ?? null
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

  public async updateActivity(orgId: string, activityId: string, patch: Partial<Activity>): Promise<Activity | null> {
    const all = this.getAllActivities()
    const idx = all.findIndex((a) => a.id === activityId && a.organization_id === orgId)
    if (idx === -1) return null
    const updated: Activity = { ...all[idx], ...patch, updated_at: new Date().toISOString() }
    all[idx] = updated
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(all))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        const { error } = await supabase.from('activities').update(updated).eq('id', activityId)
        if (error) throw error
      } catch (e: any) {
        console.warn('Gagal update kegiatan di Supabase:', e)
        this.updateSyncStatus({ errorMessage: e?.message || 'Gagal update kegiatan di Supabase' })
      }
    }

    await this.logActivity(orgId, activityId, undefined, 'Sistem', 'KEGIATAN_DIPERBARUI', `Memperbarui kegiatan "${updated.name}".`)
    this.notifyDataChange()
    return updated
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

  public getTasks(orgId: string, activityId?: string, includeArchived = false, options?: { includeDeleted?: boolean; includeTasksOfDeletedActivities?: boolean }): Task[] {
    const deletedActivityIds = new Set(
      this.getAllActivities()
        .filter((a) => a.deleted_at)
        .map((a) => a.id)
    )
    let tasks = this.getAllTasks().filter((t) => t.organization_id === orgId)
    if (activityId) {
      tasks = tasks.filter((t) => t.activity_id === activityId)
    }
    if (!options?.includeTasksOfDeletedActivities) {
      tasks = tasks.filter((t) => !deletedActivityIds.has(t.activity_id))
    }
    if (!includeArchived) {
      tasks = tasks.filter((t) => !t.is_archived)
    }
    if (!options?.includeDeleted) {
      tasks = tasks.filter((t) => !t.deleted_at)
    }
    return this.applyManualOrder(tasks)
  }

  /**
   * Menghormati urutan manual (drag & drop) per kegiatan.
   * Bila sebuah kegiatan belum pernah diurutkan manual, urutan aslinya dipertahankan.
   */
  private applyManualOrder(tasks: Task[]): Task[] {
    const byActivity = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!byActivity.has(t.activity_id)) byActivity.set(t.activity_id, [])
      byActivity.get(t.activity_id)!.push(t)
    }
    const result: Task[] = []
    for (const list of byActivity.values()) {
      const hasManual = list.some((t) => typeof t.sort_order === 'number')
      if (!hasManual) {
        result.push(...list)
        continue
      }
      const indexed = list.map((t, i) => ({ t, i, s: typeof t.sort_order === 'number' ? t.sort_order : Number.MAX_SAFE_INTEGER }))
      indexed.sort((a, b) => (a.s === b.s ? a.i - b.i : a.s - b.s))
      result.push(...indexed.map((x) => x.t))
    }
    return result
  }

  public async createTask(data: Omit<Task, 'id' | 'created_at' | 'updated_at'>, actorName = 'Pengguna'): Promise<Task> {
    this.assertOrganizationExists(data.organization_id)

    const parentActivity = this.getAllActivities().find(
      (a) => a.id === data.activity_id && a.organization_id === data.organization_id
    )
    if (!parentActivity) {
      throw new Error('Kegiatan tidak ditemukan. Buat atau aktifkan kegiatan terlebih dahulu.')
    }

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
        const { error } = await supabase.from('tasks').insert(newTask)
        if (error) throw error
      } catch (e: any) {
        console.warn('Gagal simpan tugas ke Supabase:', e)
        this.updateSyncStatus({ errorMessage: e?.message || 'Gagal simpan tugas ke Supabase' })
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
        const { error } = await supabase.from('tasks').update(updated).eq('id', id)
        if (error) throw error
      } catch (e: any) {
        console.warn('Gagal update tugas di Supabase:', e)
        this.updateSyncStatus({ errorMessage: e?.message || 'Gagal update tugas di Supabase' })
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

  private getAllLogs(): ActivityLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOGS)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  public getActivityLogs(orgId: string, limit = 50, options?: { includeDeleted?: boolean; includeArchived?: boolean; activityId?: string }): ActivityLog[] {
    let logs = this.getAllLogs().filter((l) => l.organization_id === orgId)
    if (options?.activityId) {
      logs = logs.filter((l) => l.activity_id === options.activityId)
    }
    if (!options?.includeDeleted) {
      logs = logs.filter((l) => !l.deleted_at)
    }
    if (options?.includeArchived === false) {
      logs = logs.filter((l) => !l.is_archived)
    }
    return logs.slice(0, limit)
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
        const { error } = await supabase.from('activity_logs').insert(newLog)
        if (error) {
          console.warn('Gagal simpan log ke Supabase:', error.message)
          this.updateSyncStatus({ errorMessage: error.message })
        }
      } catch (e: any) {
        console.warn('Gagal simpan log ke Supabase:', e)
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
    const logs = this.getAllLogs().filter((l) => !l.id.startsWith('demo-') && !l.organization_id.startsWith('demo-'))

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
      activityLogs: this.getAllLogs().slice(0, 1000),
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
