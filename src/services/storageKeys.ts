// Centralized localStorage key constants.
//
// IMPORTANT: the keys below that end in `_v1` are the ORIGINAL keys used by
// the production app. They MUST NOT be renamed or removed. All new fields are
// stored inside the same JSON payloads (additive), and any additional state
// uses new keys with a `_v2` suffix or a new logical name.

export const STORAGE_KEYS = {
  // Original keys (do not rename/remove)
  ORGANIZATIONS: 'org_monitor_organizations_v1',
  MEMBERS: 'org_monitor_members_v1',
  ACTIVITIES: 'org_monitor_activities_v1',
  TASKS: 'org_monitor_tasks_v1',
  LOGS: 'org_monitor_logs_v1',
  CURRENT_ORG_ID: 'org_monitor_current_org_id_v1',
  INITIALIZED: 'org_monitor_initialized_v1',

  // New keys (Phase 1+)
  ACTIVITY_MEMBERS: 'org_monitor_activity_members_v1',
  SCHEMA_VERSION: 'org_monitor_schema_version_v1',
  PRE_MIGRATION_BACKUP: 'org_monitor_pre_migration_backup_v2',
  PRE_IMPORT_BACKUP: 'org_monitor_pre_import_backup_v1',
  LAST_DESTRUCTIVE_BACKUP: 'org_monitor_last_destructive_backup_v1',
  SYNC_META: 'org_monitor_sync_meta_v1',
  PENDING_WRITES: 'org_monitor_pending_writes_v1',
  TEMPLATES: 'org_monitor_task_templates_v1',

  // Phase 2+
  SELECTED_ACTIVITY: 'org_monitor_selected_activity_v1',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export const SCHEMA_VERSION_CURRENT = 2
export const SCHEMA_VERSION_INITIAL = 1