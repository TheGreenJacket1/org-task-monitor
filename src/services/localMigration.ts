import { STORAGE_KEYS, SCHEMA_VERSION_CURRENT, SCHEMA_VERSION_INITIAL } from './storageKeys'
import {
  Organization,
  Member,
  Activity,
  Task,
  ActivityLog,
  ActivityMember,
  MigrationReport,
  StorageHealth,
} from '../types'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface StoredArrayResult<T> {
  status: 'ok' | 'missing' | 'corrupt' | 'wrong-shape'
  data: T[]
  raw: string | null
  error?: string
}

export function readStoredArray<T>(
  storage: StorageLike,
  key: string,
  normalize?: (item: unknown) => T | null
): StoredArrayResult<T> {
  const raw = storage.getItem(key)
  if (raw === null) {
    return { status: 'missing', data: [], raw: null }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return { status: 'corrupt', data: [], raw, error: (e as Error).message }
  }
  if (!Array.isArray(parsed)) {
    return { status: 'wrong-shape', data: [], raw }
  }
  const out: T[] = []
  for (const item of parsed) {
    if (normalize) {
      const n = normalize(item)
      if (n !== null) out.push(n)
    } else {
      out.push(item as T)
    }
  }
  return { status: 'ok', data: out, raw }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback?: string): string {
  return typeof value === 'string' ? value : (fallback ?? '')
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeOrganization(raw: unknown): Organization | null {
  if (!isRecord(raw)) return null
  const r = raw
  if (typeof r.id !== 'string' || typeof r.organization_id !== 'undefined' && typeof r.id !== 'string') {
    // organization_id is not required on Organization; only id is
  }
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return null
  const now = new Date().toISOString()
  return {
    id: r.id,
    name: r.name,
    code: asString(r.code, ''),
    description: typeof r.description === 'string' ? r.description : undefined,
    created_at: asString(r.created_at, now),
    updated_at: asString(r.updated_at, now),
  }
}

export function normalizeMember(raw: unknown): Member | null {
  if (!isRecord(raw)) return null
  const r = raw
  if (typeof r.id !== 'string' || typeof r.organization_id !== 'string' || typeof r.name !== 'string') {
    return null
  }
  const now = new Date().toISOString()
  return {
    id: r.id,
    organization_id: r.organization_id,
    name: r.name,
    role: asString(r.role, ''),
    email: typeof r.email === 'string' ? r.email : undefined,
    phone: typeof r.phone === 'string' ? r.phone : undefined,
    avatar_color: typeof r.avatar_color === 'string' ? r.avatar_color : undefined,
    is_active: asBoolean(r.is_active, true),
    created_at: asString(r.created_at, now),
    deleted_at: r.deleted_at === null || typeof r.deleted_at === 'string' ? (r.deleted_at as string | null) : null,
  }
}

export function normalizeActivity(raw: unknown): Activity | null {
  if (!isRecord(raw)) return null
  const r = raw
  if (typeof r.id !== 'string' || typeof r.organization_id !== 'string' || typeof r.name !== 'string') {
    return null
  }
  const now = new Date().toISOString()
  return {
    id: r.id,
    organization_id: r.organization_id,
    name: r.name,
    description: typeof r.description === 'string' ? r.description : undefined,
    start_date: asString(r.start_date, now.slice(0, 10)),
    end_date: asString(r.end_date, now.slice(0, 10)),
    is_active: asBoolean(r.is_active, false),
    is_archived: asBoolean(r.is_archived, false),
    created_at: asString(r.created_at, now),
    updated_at: asString(r.updated_at, now),
    deleted_at: r.deleted_at === null || typeof r.deleted_at === 'string' ? (r.deleted_at as string | null) : null,
  }
}

export function normalizeTask(raw: unknown): Task | null {
  if (!isRecord(raw)) return null
  const r = raw
  if (
    typeof r.id !== 'string' ||
    typeof r.organization_id !== 'string' ||
    typeof r.activity_id !== 'string' ||
    typeof r.title !== 'string'
  ) {
    return null
  }
  const now = new Date().toISOString()
  const reference_links = Array.isArray(r.reference_links)
    ? r.reference_links.filter((x): x is string => typeof x === 'string')
    : []
  const result_links = Array.isArray(r.result_links)
    ? r.result_links.filter((x): x is string => typeof x === 'string')
    : []
  return {
    id: r.id,
    organization_id: r.organization_id,
    activity_id: r.activity_id,
    title: r.title,
    description: asString(r.description, ''),
    category: (r.category as Task['category']) ?? 'Lainnya',
    phase: (r.phase as Task['phase']) ?? 'Pra-acara',
    priority: (r.priority as Task['priority']) ?? 'Sedang',
    pic_id: asString(r.pic_id, ''),
    start_date: asString(r.start_date, now.slice(0, 10)),
    deadline: asString(r.deadline, now.slice(0, 10)),
    status: (r.status as Task['status']) ?? 'Belum dikerjakan',
    progress: typeof r.progress === 'number' ? r.progress : 0,
    review_status: (r.review_status as Task['review_status']) ?? 'Belum diajukan',
    revision_notes: typeof r.revision_notes === 'string' ? r.revision_notes : '',
    reference_links,
    result_links,
    completed_at: r.completed_at === null || typeof r.completed_at === 'string' ? (r.completed_at as string | null) : null,
    is_archived: asBoolean(r.is_archived, false),
    created_at: asString(r.created_at, now),
    updated_at: asString(r.updated_at, now),
    deleted_at: r.deleted_at === null || typeof r.deleted_at === 'string' ? (r.deleted_at as string | null) : null,
  }
}

export function normalizeActivityLog(raw: unknown): ActivityLog | null {
  if (!isRecord(raw)) return null
  const r = raw
  if (typeof r.id !== 'string' || typeof r.organization_id !== 'string' || typeof r.actor_name !== 'string') {
    return null
  }
  const now = new Date().toISOString()
  return {
    id: r.id,
    organization_id: r.organization_id,
    activity_id: typeof r.activity_id === 'string' ? r.activity_id : undefined,
    task_id: typeof r.task_id === 'string' ? r.task_id : undefined,
    actor_name: r.actor_name,
    action: asString(r.action, ''),
    details: asString(r.details, ''),
    created_at: asString(r.created_at, now),
    is_archived: asBoolean(r.is_archived, false),
    deleted_at: r.deleted_at === null || typeof r.deleted_at === 'string' ? (r.deleted_at as string | null) : null,
  }
}

export function normalizeActivityMember(raw: unknown): ActivityMember | null {
  if (!isRecord(raw)) return null
  const r = raw
  if (typeof r.activity_id !== 'string' || typeof r.member_id !== 'string') return null
  const now = new Date().toISOString()
  return {
    activity_id: r.activity_id,
    member_id: r.member_id,
    created_at: asString(r.created_at, now),
  }
}

export interface SnapshotPayload {
  createdAt: string
  fromVersion: number
  appVersion: string
  raw: Record<string, string | null>
  counts: {
    organizations: number
    members: number
    activities: number
    tasks: number
    activityLogs: number
  } | null
}

export function createSnapshot(storage: StorageLike, fromVersion: number, now = new Date()): SnapshotPayload {
  const raw: Record<string, string | null> = {
    organizations: storage.getItem(STORAGE_KEYS.ORGANIZATIONS),
    members: storage.getItem(STORAGE_KEYS.MEMBERS),
    activities: storage.getItem(STORAGE_KEYS.ACTIVITIES),
    tasks: storage.getItem(STORAGE_KEYS.TASKS),
    logs: storage.getItem(STORAGE_KEYS.LOGS),
    currentOrgId: storage.getItem(STORAGE_KEYS.CURRENT_ORG_ID),
    initialized: storage.getItem(STORAGE_KEYS.INITIALIZED),
    activityMembers: storage.getItem(STORAGE_KEYS.ACTIVITY_MEMBERS),
  }
  return {
    createdAt: now.toISOString(),
    fromVersion,
    appVersion: '1.0.0',
    raw,
    counts: null,
  }
}

export function migrateLocalData(storage: StorageLike = (typeof localStorage !== 'undefined' ? localStorage : ({} as StorageLike)), now = new Date()): MigrationReport {
  const report: MigrationReport = {
    fromVersion: SCHEMA_VERSION_INITIAL,
    toVersion: SCHEMA_VERSION_INITIAL,
    migrated: false,
    migratedKeys: [],
    skippedKeys: [],
    errors: [],
    counts: {
      organizations: 0,
      members: 0,
      activities: 0,
      tasks: 0,
      activityLogs: 0,
      activityMembers: 0,
    },
  }

  const versionRaw = storage.getItem(STORAGE_KEYS.SCHEMA_VERSION)
  const parsedVersion = versionRaw ? parseInt(versionRaw, 10) : SCHEMA_VERSION_INITIAL
  const fromVersion = isNaN(parsedVersion) ? SCHEMA_VERSION_INITIAL : parsedVersion
  report.fromVersion = fromVersion

  // Snapshot first (only if absent), before any write.
  if (!storage.getItem(STORAGE_KEYS.PRE_MIGRATION_BACKUP)) {
    try {
      const snap = createSnapshot(storage, fromVersion, now)
      storage.setItem(STORAGE_KEYS.PRE_MIGRATION_BACKUP, JSON.stringify(snap))
    } catch (e) {
      report.errors.push(`snapshot_failed: ${(e as Error).message}`)
      return report
    }
  }

  // Read all data keys.
  const orgRes = readStoredArray(storage, STORAGE_KEYS.ORGANIZATIONS, normalizeOrganization)
  const memRes = readStoredArray(storage, STORAGE_KEYS.MEMBERS, normalizeMember)
  const actRes = readStoredArray(storage, STORAGE_KEYS.ACTIVITIES, normalizeActivity)
  const taskRes = readStoredArray(storage, STORAGE_KEYS.TASKS, normalizeTask)
  const logRes = readStoredArray(storage, STORAGE_KEYS.LOGS, normalizeActivityLog)
  const amRes = readStoredArray(storage, STORAGE_KEYS.ACTIVITY_MEMBERS, normalizeActivityMember)

  const results = [orgRes, memRes, actRes, taskRes, logRes, amRes]
  const keys = [
    STORAGE_KEYS.ORGANIZATIONS,
    STORAGE_KEYS.MEMBERS,
    STORAGE_KEYS.ACTIVITIES,
    STORAGE_KEYS.TASKS,
    STORAGE_KEYS.LOGS,
    STORAGE_KEYS.ACTIVITY_MEMBERS,
  ]

  // Abort on corrupt/wrong-shape for any present key.
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'corrupt' || r.status === 'wrong-shape') {
      report.errors.push(`${keys[i]}:${r.status}${r.error ? ':' + r.error : ''}`)
      return report
    }
  }

  // If already current version and activity_members present, skip writes.
  const alreadyCurrent = fromVersion >= SCHEMA_VERSION_CURRENT
  const amPresent = amRes.status !== 'missing'

  if (alreadyCurrent && amPresent) {
    report.toVersion = SCHEMA_VERSION_CURRENT
    report.migrated = false
    report.skippedKeys = keys.slice()
    report.counts = {
      organizations: orgRes.data.length,
      members: memRes.data.length,
      activities: actRes.data.length,
      tasks: taskRes.data.length,
      activityLogs: logRes.data.length,
      activityMembers: amRes.data.length,
    }
    return report
  }

  // Write normalized arrays back to the SAME keys (additive).
  const writes: Array<[string, unknown[]]> = [
    [STORAGE_KEYS.ORGANIZATIONS, orgRes.data],
    [STORAGE_KEYS.MEMBERS, memRes.data],
    [STORAGE_KEYS.ACTIVITIES, actRes.data],
    [STORAGE_KEYS.TASKS, taskRes.data],
    [STORAGE_KEYS.LOGS, logRes.data],
  ]

  for (const [key, data] of writes) {
    try {
      storage.setItem(key, JSON.stringify(data))
      report.migratedKeys.push(key)
    } catch (e) {
      report.errors.push(`write_failed:${key}:${(e as Error).message}`)
      return report
    }
  }

  // Backfill activity_members (all-to-all per org) only if key was missing.
  let activityMembers: ActivityMember[] = amRes.data
  if (!amPresent) {
    const orgIds = new Set(orgRes.data.map((o) => o.id))
    const byOrgMembers = new Map<string, Member[]>()
    const byOrgActivities = new Map<string, Activity[]>()
    for (const m of memRes.data) {
      if (!orgIds.has(m.organization_id)) continue
      if (!byOrgMembers.has(m.organization_id)) byOrgMembers.set(m.organization_id, [])
      byOrgMembers.get(m.organization_id)!.push(m)
    }
    for (const a of actRes.data) {
      if (!orgIds.has(a.organization_id)) continue
      if (!byOrgActivities.has(a.organization_id)) byOrgActivities.set(a.organization_id, [])
      byOrgActivities.get(a.organization_id)!.push(a)
    }
    const existing = new Set(activityMembers.map((am) => `${am.activity_id}:${am.member_id}`))
    for (const [orgId, members] of byOrgMembers) {
      const acts = byOrgActivities.get(orgId) ?? []
      for (const m of members) {
        for (const a of acts) {
          const k = `${a.id}:${m.id}`
          if (!existing.has(k)) {
            activityMembers.push({ activity_id: a.id, member_id: m.id, created_at: now.toISOString() })
            existing.add(k)
          }
        }
      }
    }
    try {
      storage.setItem(STORAGE_KEYS.ACTIVITY_MEMBERS, JSON.stringify(activityMembers))
      report.migratedKeys.push(STORAGE_KEYS.ACTIVITY_MEMBERS)
    } catch (e) {
      report.errors.push(`write_failed:${STORAGE_KEYS.ACTIVITY_MEMBERS}:${(e as Error).message}`)
      return report
    }
  } else {
    report.skippedKeys.push(STORAGE_KEYS.ACTIVITY_MEMBERS)
  }

  // Write version last.
  try {
    storage.setItem(STORAGE_KEYS.SCHEMA_VERSION, String(SCHEMA_VERSION_CURRENT))
    report.migratedKeys.push(STORAGE_KEYS.SCHEMA_VERSION)
  } catch (e) {
    report.errors.push(`write_failed:${STORAGE_KEYS.SCHEMA_VERSION}:${(e as Error).message}`)
    return report
  }

  report.toVersion = SCHEMA_VERSION_CURRENT
  report.migrated = true
  report.counts = {
    organizations: orgRes.data.length,
    members: memRes.data.length,
    activities: actRes.data.length,
    tasks: taskRes.data.length,
    activityLogs: logRes.data.length,
    activityMembers: activityMembers.length,
  }
  return report
}

export function getStorageHealth(storage: StorageLike = (typeof localStorage !== 'undefined' ? localStorage : ({} as StorageLike))): StorageHealth {
  const keys: StorageHealth['keys'] = {}
  // (no-op placeholder removed)
  const orgRes = readStoredArray(storage, STORAGE_KEYS.ORGANIZATIONS)
  const memRes = readStoredArray(storage, STORAGE_KEYS.MEMBERS)
  const actRes = readStoredArray(storage, STORAGE_KEYS.ACTIVITIES)
  const taskRes = readStoredArray(storage, STORAGE_KEYS.TASKS)
  const logRes = readStoredArray(storage, STORAGE_KEYS.LOGS)
  const amRes = readStoredArray(storage, STORAGE_KEYS.ACTIVITY_MEMBERS)

  keys[STORAGE_KEYS.ORGANIZATIONS] = { status: orgRes.status, count: orgRes.data.length }
  keys[STORAGE_KEYS.MEMBERS] = { status: memRes.status, count: memRes.data.length }
  keys[STORAGE_KEYS.ACTIVITIES] = { status: actRes.status, count: actRes.data.length }
  keys[STORAGE_KEYS.TASKS] = { status: taskRes.status, count: taskRes.data.length }
  keys[STORAGE_KEYS.LOGS] = { status: logRes.status, count: logRes.data.length }
  keys[STORAGE_KEYS.ACTIVITY_MEMBERS] = { status: amRes.status, count: amRes.data.length }

  const statuses = [orgRes.status, memRes.status, actRes.status, taskRes.status, logRes.status]
  const hasCorrupt = statuses.includes('corrupt') || statuses.includes('wrong-shape')
  const allMissing = statuses.every((s) => s === 'missing')
  const overall: StorageHealth['status'] = hasCorrupt ? 'corrupt' : allMissing ? 'missing' : 'ok'

  const versionRaw = storage.getItem(STORAGE_KEYS.SCHEMA_VERSION)
  const schemaVersion = versionRaw ? (isNaN(parseInt(versionRaw, 10)) ? SCHEMA_VERSION_INITIAL : parseInt(versionRaw, 10)) : SCHEMA_VERSION_INITIAL

  return {
    status: overall,
    keys,
    schemaVersion,
    hasSnapshot: storage.getItem(STORAGE_KEYS.PRE_MIGRATION_BACKUP) !== null,
    canMutate: !hasCorrupt,
    errors: [],
  }
}