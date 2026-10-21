import { describe, it, expect } from 'vitest'
import {
  migrateLocalData,
  readStoredArray,
  normalizeTask,
} from '../services/localMigration'
import { STORAGE_KEYS, SCHEMA_VERSION_CURRENT } from '../services/storageKeys'
import { StorageLike } from '../services/localMigration'

function makeStorage(initial: Record<string, string> = {}): StorageLike & { _store: Record<string, string> } {
  const store: Record<string, string> = { ...initial }
  return {
    _store: store,
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key: string, value: string) {
      store[key] = value
    },
    removeItem(key: string) {
      delete store[key]
    },
  }
}

const V1_TASKS = JSON.stringify([
  {
    id: 't1',
    organization_id: 'org1',
    activity_id: 'act1',
    title: 'Tugas 1',
    description: '',
    category: 'Administrasi',
    phase: 'Pra-acara',
    priority: 'Sedang',
    pic_id: 'm1',
    start_date: '2026-10-01',
    deadline: '2026-10-10',
    status: 'Belum dikerjakan',
    progress: 0,
    review_status: 'Belum diajukan',
    revision_notes: '',
    reference_links: [],
    result_links: [],
    completed_at: null,
    is_archived: false,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
])

describe('migrateLocalData', () => {
  it('M3: is idempotent on v1 data', () => {
    const storage = makeStorage({
      [STORAGE_KEYS.ORGANIZATIONS]: JSON.stringify([{ id: 'org1', name: 'Org', code: 'O', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }]),
      [STORAGE_KEYS.MEMBERS]: JSON.stringify([{ id: 'm1', organization_id: 'org1', name: 'M', role: 'R', is_active: true, created_at: '2026-10-01T00:00:00Z' }]),
      [STORAGE_KEYS.ACTIVITIES]: JSON.stringify([{ id: 'act1', organization_id: 'org1', name: 'A', start_date: '2026-10-01', end_date: '2026-10-10', is_active: true, is_archived: false, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }]),
      [STORAGE_KEYS.TASKS]: V1_TASKS,
      [STORAGE_KEYS.LOGS]: JSON.stringify([{ id: 'l1', organization_id: 'org1', actor_name: 'S', action: 'X', details: 'd', created_at: '2026-10-01T00:00:00Z' }]),
    })

    const r1 = migrateLocalData(storage)
    expect(r1.migrated).toBe(true)
    expect(r1.toVersion).toBe(SCHEMA_VERSION_CURRENT)
    const after1 = storage.getItem(STORAGE_KEYS.TASKS)
    const am1 = storage.getItem(STORAGE_KEYS.ACTIVITY_MEMBERS)

    const r2 = migrateLocalData(storage)
    expect(r2.migrated).toBe(false)
    expect(storage.getItem(STORAGE_KEYS.TASKS)).toBe(after1)
    expect(storage.getItem(STORAGE_KEYS.ACTIVITY_MEMBERS)).toBe(am1)
  })

  it('M4/M5: snapshot is created before writes and not overwritten', () => {
    const storage = makeStorage({
      [STORAGE_KEYS.TASKS]: V1_TASKS,
    })
    const before = storage.getItem(STORAGE_KEYS.TASKS)
    // simulate: ensure snapshot key absent, then migrate
    migrateLocalData(storage)
    const snapRaw = storage.getItem(STORAGE_KEYS.PRE_MIGRATION_BACKUP)
    expect(snapRaw).not.toBeNull()
    const snap = JSON.parse(snapRaw!)
    expect(snap.raw.tasks).toBe(before)
    const snapTime = snap.createdAt

    // second run must not overwrite
    migrateLocalData(storage)
    const snap2 = JSON.parse(storage.getItem(STORAGE_KEYS.PRE_MIGRATION_BACKUP)!)
    expect(snap2.createdAt).toBe(snapTime)
  })

  it('M6: aborts on corrupt JSON and writes nothing', () => {
    const storage = makeStorage({
      [STORAGE_KEYS.TASKS]: '{bad json',
      [STORAGE_KEYS.ORGANIZATIONS]: JSON.stringify([{ id: 'org1', name: 'Org', code: 'O', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }]),
    })
    const beforeTasks = storage.getItem(STORAGE_KEYS.TASKS)
    const beforeVersion = storage.getItem(STORAGE_KEYS.SCHEMA_VERSION)
    const r = migrateLocalData(storage)
    expect(r.migrated).toBe(false)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(storage.getItem(STORAGE_KEYS.TASKS)).toBe(beforeTasks)
    expect(storage.getItem(STORAGE_KEYS.SCHEMA_VERSION)).toBe(beforeVersion)
  })

  it('M7: wrong-shape JSON is treated as wrong-shape, not empty', () => {
    const storage = makeStorage({
      [STORAGE_KEYS.TASKS]: JSON.stringify({ not: 'an array' }),
    })
    const r = migrateLocalData(storage)
    expect(r.migrated).toBe(false)
    expect(r.errors.some((e) => e.includes('wrong-shape'))).toBe(true)
  })

  it('M8: missing keys do not abort migration', () => {
    const storage = makeStorage({})
    const r = migrateLocalData(storage)
    // no corrupt/wrong-shape; migration may run (or skip) but no errors
    expect(r.errors).toEqual([])
  })

  it('M1: activity_members backfill is all-to-all per org', () => {
    const storage = makeStorage({
      [STORAGE_KEYS.ORGANIZATIONS]: JSON.stringify([{ id: 'org1', name: 'Org', code: 'O', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }]),
      [STORAGE_KEYS.MEMBERS]: JSON.stringify([
        { id: 'm1', organization_id: 'org1', name: 'M1', role: 'R', is_active: true, created_at: '2026-10-01T00:00:00Z' },
        { id: 'm2', organization_id: 'org1', name: 'M2', role: 'R', is_active: true, created_at: '2026-10-01T00:00:00Z' },
      ]),
      [STORAGE_KEYS.ACTIVITIES]: JSON.stringify([
        { id: 'a1', organization_id: 'org1', name: 'A1', start_date: '2026-10-01', end_date: '2026-10-10', is_active: true, is_archived: false, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' },
        { id: 'a2', organization_id: 'org1', name: 'A2', start_date: '2026-10-01', end_date: '2026-10-10', is_active: false, is_archived: false, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' },
      ]),
    })
    migrateLocalData(storage)
    const am = JSON.parse(storage.getItem(STORAGE_KEYS.ACTIVITY_MEMBERS)!)
    expect(am).toHaveLength(4)
    const keys = am.map((x: any) => `${x.activity_id}:${x.member_id}`).sort()
    expect(keys).toEqual(['a1:m1', 'a1:m2', 'a2:m1', 'a2:m2'])
  })

  it('M2: missing activity_members key is honored as empty on second run', () => {
    const storage = makeStorage({
      [STORAGE_KEYS.ORGANIZATIONS]: JSON.stringify([{ id: 'org1', name: 'Org', code: 'O', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }]),
      [STORAGE_KEYS.MEMBERS]: JSON.stringify([{ id: 'm1', organization_id: 'org1', name: 'M', role: 'R', is_active: true, created_at: '2026-10-01T00:00:00Z' }]),
      [STORAGE_KEYS.ACTIVITIES]: JSON.stringify([{ id: 'a1', organization_id: 'org1', name: 'A', start_date: '2026-10-01', end_date: '2026-10-10', is_active: true, is_archived: false, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }]),
      [STORAGE_KEYS.ACTIVITY_MEMBERS]: JSON.stringify([]),
    })
    migrateLocalData(storage)
    const am = JSON.parse(storage.getItem(STORAGE_KEYS.ACTIVITY_MEMBERS)!)
    expect(am).toHaveLength(0)
  })

  it('normalizers fill defaults for v1 rows', () => {
    const n = normalizeTask(JSON.parse(V1_TASKS)[0])
    expect(n).not.toBeNull()
    expect(n!.deleted_at).toBeNull()
    expect(n!.is_archived).toBe(false)
    expect(n!.reference_links).toEqual([])
  })

  it('readStoredArray reports missing/corrupt/wrong-shape', () => {
    const s = makeStorage({})
    expect(readStoredArray(s, 'nope').status).toBe('missing')
    s.setItem('bad', '{bad')
    expect(readStoredArray(s, 'bad').status).toBe('corrupt')
    s.setItem('wrong', '{"a":1}')
    expect(readStoredArray(s, 'wrong').status).toBe('wrong-shape')
  })
})