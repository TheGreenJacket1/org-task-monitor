export type TaskCategory = 'Desain' | 'Publikasi' | 'Dokumentasi' | 'Administrasi' | 'Lainnya'

export type TaskPhase = 'Pra-acara' | 'Hari-H' | 'Pasca-acara'

export type TaskPriority = 'Rendah' | 'Sedang' | 'Tinggi' | 'Mendesak'

export type TaskStatus = 'Belum dikerjakan' | 'Dikerjakan' | 'Revisi' | 'Selesai'

export type TaskReviewStatus = 'Belum diajukan' | 'Menunggu review' | 'Disetujui' | 'Perlu revisi'

export interface Organization {
  id: string
  name: string
  code: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  organization_id: string
  name: string
  role: string
  email?: string
  phone?: string
  avatar_color?: string
  is_active: boolean
  created_at: string
}

export interface Activity {
  id: string
  organization_id: string
  name: string
  description?: string
  start_date: string
  end_date: string
  is_active: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  organization_id: string
  activity_id: string
  title: string
  description: string
  category: TaskCategory
  phase: TaskPhase
  priority: TaskPriority
  pic_id: string
  start_date: string
  deadline: string
  status: TaskStatus
  progress: number // 0 - 100
  review_status: TaskReviewStatus
  revision_notes?: string
  reference_links: string[]
  result_links: string[]
  completed_at?: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  organization_id: string
  activity_id?: string
  task_id?: string
  actor_name: string
  action: string
  details: string
  created_at: string
}

export interface TaskFilterOptions {
  searchQuery?: string
  category?: TaskCategory | 'Semua'
  phase?: TaskPhase | 'Semua'
  priority?: TaskPriority | 'Semua'
  status?: TaskStatus | 'Semua'
  reviewStatus?: TaskReviewStatus | 'Semua'
  picId?: string | 'Semua'
  isArchived?: boolean
  sortBy?: 'deadline' | 'priority' | 'progress' | 'updated_at' | 'title'
  sortDirection?: 'asc' | 'desc'
}

export type DeadlineAlertType = 'OVERDUE' | 'TODAY' | 'H-1' | 'H-3' | 'H-7' | 'UPCOMING' | null

export interface DeadlineAlertInfo {
  type: DeadlineAlertType
  label: string
  diffDays: number
  isUrgent: boolean
  badgeColor: string
}

export interface DashboardMetrics {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  notStartedTasks: number
  revisionTasks: number
  overdueTasks: number
  awaitingReviewTasks: number
  completionPercentage: number
}

export interface SyncStatus {
  mode: 'supabase' | 'local' | 'demo'
  isConnected: boolean
  isSyncing: boolean
  lastSyncAt: string | null
  errorMessage?: string
}
