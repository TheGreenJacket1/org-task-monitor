import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Users,
  History,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  Organization,
  Member,
  Activity,
  Task,
  ActivityLog,
  SyncStatus,
} from './types'
import { storageService } from './services/storage'
import { getDeadlineAlert } from './utils/date'

// Components
import { Navbar } from './components/Navbar'
import { DashboardView } from './components/DashboardView'
import { TaskListView } from './components/TaskListView'
import { ActivityManagementModal } from './components/ActivityManagementModal'
import { MemberManagementModal } from './components/MemberManagementModal'
import { OrganizationModal } from './components/OrganizationModal'
import { TaskModal } from './components/TaskModal'
import { TaskDetailModal } from './components/TaskDetailModal'
import { NotificationModal } from './components/NotificationModal'
import { SettingsModal } from './components/SettingsModal'
import { ConfirmModal } from './components/ConfirmModal'
import { ActivityLogView } from './components/ActivityLogView'
import { TrashModal } from './components/TrashModal'
import { ActivitySelector } from './components/ActivitySelector'
import { BottomNav } from './components/BottomNav'
import { CommandPalette } from './components/CommandPalette'
import { QuickAddTaskModal } from './components/QuickAddTaskModal'

type TabType = 'dashboard' | 'tasks' | 'activities' | 'members' | 'logs'

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')

  // Core Data States
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrgId, setCurrentOrgId] = useState<string>('')
  const [members, setMembers] = useState<Member[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [activityTaskCounts, setActivityTaskCounts] = useState<Record<string, number>>({})
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [deletedTasks, setDeletedTasks] = useState<Task[]>([])
  const [deletedActivities, setDeletedActivities] = useState<Activity[]>([])
  const [deletedMembers, setDeletedMembers] = useState<Member[]>([])
  const [deletedLogs, setDeletedLogs] = useState<ActivityLog[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    mode: 'demo',
    isConnected: false,
    isSyncing: false,
    lastSyncAt: null,
  })

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isTrashOpen, setIsTrashOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)

  // Confirm delete modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean
    title: string
    message: string
    impactSummary?: string[]
    requireTypedText?: string
    action: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
  })

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{
    text: string
    type: 'success' | 'error' | 'info'
    action?: { label: string; onClick: () => void }
    duration?: number
  } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (
    text: string,
    type: 'success' | 'error' | 'info' = 'success',
    options?: { action?: { label: string; onClick: () => void }; duration?: number }
  ) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    const duration = options?.duration ?? (options?.action ? 8000 : 3500)
    setToastMessage({ text, type, action: options?.action, duration })
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null)
      toastTimerRef.current = null
    }, duration)
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // Load state from StorageService
  const refreshData = useCallback(() => {
    const orgs = storageService.getOrganizations()
    setOrganizations(orgs)

    const curId = storageService.getCurrentOrgId()
    setCurrentOrgId(curId)

    if (curId) {
      const acts = storageService.getActivities(curId)
      setActivities(acts)
      const sel = storageService.getSelectedActivity(curId)
      setSelectedActivity(sel)
      // Persist fallback selection if nothing stored yet.
      if (!storageService.getSelectedActivityId(curId) && sel) {
        storageService.setSelectedActivityId(curId, sel.id)
      }
      const orgTasks = storageService.getTasks(curId, undefined, true, { includeTasksOfDeletedActivities: false })
      const counts: Record<string, number> = {}
      for (const t of orgTasks) {
        counts[t.activity_id] = (counts[t.activity_id] ?? 0) + 1
      }
      setActivityTaskCounts(counts)
      setMembers(sel ? storageService.getActivityMembers(sel.id) : storageService.getMembers(curId))
      setTasks(storageService.getTasks(curId, sel?.id, true))
      setLogs(storageService.getActivityLogs(curId, 100))
      setDeletedTasks(storageService.getDeletedTasks(curId))
      setDeletedActivities(storageService.getDeletedActivities(curId))
      setDeletedMembers(storageService.getDeletedMembers(curId))
      setDeletedLogs(storageService.getDeletedLogs(curId, 200))
    } else {
      setMembers([])
      setActivities([])
      setSelectedActivity(null)
      setTasks([])
      setLogs([])
      setActivityTaskCounts({})
      setDeletedTasks([])
      setDeletedActivities([])
      setDeletedMembers([])
      setDeletedLogs([])
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen(true)
        return
      }
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (!typing && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        setIsQuickAddOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    refreshData()

    const unsubData = storageService.onDataChange(() => {
      refreshData()
    })

    const unsubSync = storageService.onSyncStatusChange((st) => {
      setSyncStatus(st)
    })

    return () => {
      unsubData()
      unsubSync()
    }
  }, [refreshData])

  const currentOrg = organizations.find((o) => o.id === currentOrgId) || null
  // activeActivity concept replaced by selectedActivity (Phase 2)

  // Calculate unread notification count
  const notificationCount = tasks.filter((t) => {
    if (t.is_archived || t.status === 'Selesai') return false
    const alert = getDeadlineAlert(t.deadline, t.status)
    const isUrgentDate =
      alert?.type === 'OVERDUE' ||
      alert?.type === 'TODAY' ||
      alert?.type === 'H-1' ||
      alert?.type === 'H-3' ||
      alert?.type === 'H-7'
    const isRevision = t.status === 'Revisi' || t.review_status === 'Perlu revisi'
    return isUrgentDate || isRevision
  }).length

  // Handlers
  const handleSelectOrg = (id: string) => {
    storageService.setCurrentOrgId(id)
    refreshData()
    showToast('Beralih ke organisasi terpilih.', 'info')
  }

  const handleSelectActivity = (id: string) => {
    if (!currentOrgId) return
    storageService.setSelectedActivityId(currentOrgId, id)
    refreshData()
    const act = storageService.getActivities(currentOrgId).find((a) => a.id === id)
    showToast(`Menampilkan kegiatan "${act?.name ?? ''}".`, 'info')
  }

  const handleOpenOrgModal = () => setIsOrgModalOpen(true)

  const handleOpenActivityModal = () => {
    if (!currentOrg) {
      setIsOrgModalOpen(true)
      showToast('Buat atau pilih organisasi terlebih dahulu sebelum menambah kegiatan.', 'info')
      return
    }
    setIsActivityModalOpen(true)
  }

  const handleOpenMemberModal = () => {
    if (!currentOrg) {
      setIsOrgModalOpen(true)
      showToast('Buat atau pilih organisasi terlebih dahulu sebelum menambah anggota.', 'info')
      return
    }
    setIsMemberModalOpen(true)
  }

  const handleOpenCreateTask = () => {
    if (!currentOrg) {
      setIsOrgModalOpen(true)
      showToast('Buat atau pilih organisasi terlebih dahulu sebelum menambah tugas.', 'info')
      return
    }
    if (!selectedActivity) {
      setIsActivityModalOpen(true)
      showToast('Buat atau aktifkan kegiatan terlebih dahulu untuk menambah tugas.', 'info')
      return
    }
    setTaskToEdit(null)
    setIsTaskModalOpen(true)
  }

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (taskToEdit) {
      await storageService.updateTask(taskToEdit.id, taskData)
      showToast('Tugas berhasil diperbarui!')
    } else {
      await storageService.createTask(taskData as any)
      showToast('Tugas baru berhasil dibuat!')
    }
    refreshData()
  }

  const handleQuickStatusChange = async (
    taskId: string,
    status: Task['status'],
    revisionNotes?: string
  ) => {
    await storageService.updateTask(taskId, {
      status,
      revision_notes: revisionNotes,
      review_status: status === 'Selesai' ? 'Disetujui' : status === 'Revisi' ? 'Perlu revisi' : undefined,
    })
    refreshData()
    if (selectedTask && selectedTask.id === taskId) {
      const updated = storageService.getTasks(currentOrgId, undefined, true).find((t) => t.id === taskId)
      if (updated) setSelectedTask(updated)
    }
    showToast(`Status tugas diubah menjadi "${status}".`)
  }

  const handleArchiveTask = async (taskId: string) => {
    await storageService.archiveTask(taskId)
    refreshData()
    if (selectedTask?.id === taskId) setIsDetailModalOpen(false)
    showToast('Tugas berhasil diarsipkan.')
  }

  const handleUnarchiveTask = async (taskId: string) => {
    await storageService.unarchiveTask(taskId)
    refreshData()
    if (selectedTask?.id === taskId) setIsDetailModalOpen(false)
    showToast('Tugas berhasil dikembalikan dari arsip.')
  }

  const handleDeleteTask = (taskId: string) => {
    const task = storageService.getTasks(currentOrgId, undefined, true, { includeDeleted: true }).find((t) => t.id === taskId)
    setConfirmConfig({
      isOpen: true,
      title: 'Pindahkan Tugas ke Tempat Sampah',
      message: 'Tugas akan dipindahkan ke Tempat Sampah. Anda dapat memulihkannya nanti.',
      impactSummary: task ? [`Tugas: ${task.title}`] : undefined,
      action: async () => {
        await storageService.softDeleteTask(taskId)
        refreshData()
        setIsDetailModalOpen(false)
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }))
        showToast('Tugas dipindahkan ke Tempat Sampah.', 'info', {
          action: {
            label: 'Urungkan',
            onClick: async () => {
              await storageService.restoreTask(taskId)
              refreshData()
              showToast('Penghapusan dibatalkan.')
            },
          },
        })
      },
    })
  }

  const handleRestoreTask = async (taskId: string) => {
    await storageService.restoreTask(taskId)
    refreshData()
    showToast('Tugas dipulihkan.')
  }
  const handlePermanentDeleteTask = async (taskId: string) => {
    await storageService.permanentlyDeleteTask(taskId)
    refreshData()
    showToast('Tugas dihapus permanen.')
  }
  const handleRestoreActivity = async (activityId: string) => {
    await storageService.restoreActivity(currentOrgId, activityId)
    refreshData()
    showToast('Kegiatan dipulihkan.')
  }
  const handlePermanentDeleteActivity = async (activityId: string) => {
    await storageService.permanentlyDeleteActivity(currentOrgId, activityId)
    refreshData()
    showToast('Kegiatan dihapus permanen.')
  }
  const handleRestoreMember = async (memberId: string) => {
    await storageService.restoreMember(memberId)
    refreshData()
    showToast('Anggota dipulihkan.')
  }
  const handlePermanentDeleteMember = async (memberId: string) => {
    await storageService.permanentlyDeleteMember(memberId)
    refreshData()
    showToast('Anggota dihapus permanen.')
  }
  const handleRestoreLog = async (logId: string) => {
    await storageService.restoreLog(logId)
    refreshData()
    showToast('Riwayat dipulihkan.')
  }
  const handlePermanentDeleteLog = async (logId: string) => {
    await storageService.permanentlyDeleteLog(logId)
    refreshData()
    showToast('Riwayat dihapus permanen.')
  }

  const handleExportData = () => {
    const jsonStr = storageService.exportAllData()
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-orgtask-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('File cadangan JSON berhasil diunduh.')
  }

  const handleImportData = async (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (content) {
        const result = storageService.importAllData(content)
        if (result.success) {
          refreshData()
          showToast(result.message)
        } else {
          showToast(result.message, 'error')
        }
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        organizations={organizations}
        currentOrg={currentOrg}
        activeActivity={selectedActivity}
        syncStatus={syncStatus}
        notificationCount={notificationCount}
        onSelectOrg={handleSelectOrg}
        onOpenOrgModal={handleOpenOrgModal}
        onOpenActivityModal={handleOpenActivityModal}
        onOpenNotifications={() => setIsNotificationOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCreateTask={handleOpenCreateTask}
      />

      {/* Demo Mode Notice Banner if viewing demo organization */}
      {currentOrg?.name.includes('[DEMO]') && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs font-semibold flex items-center justify-between border-b border-amber-600">
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              Anda sedang melihat <strong>Data Demo</strong>. Anda dapat mencoba seluruh fitur, atau
              membuat organisasi baru dan menghapus data demo melalui menu Pengaturan.
            </span>
          </div>
        </div>
      )}

      {/* Activity selector sub-header */}
      {currentOrg && (
        <div className="sticky top-16 z-30 bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3">
            <ActivitySelector
              activities={activities}
              selectedActivityId={selectedActivity?.id || ''}
              taskCounts={activityTaskCounts}
              onSelect={handleSelectActivity}
              onManage={handleOpenActivityModal}
            />
            <span className="text-xs text-slate-500 hidden sm:inline">
              {selectedActivity ? `${selectedActivity.name} dipilih` : 'Belum ada kegiatan terpilih'}
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-6 overflow-x-auto pb-1 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard Ringkasan
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Daftar Tugas ({tasks.filter((t) => !t.is_archived).length})
          </button>

          <button
            onClick={handleOpenActivityModal}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition whitespace-nowrap"
          >
            <Calendar className="w-4 h-4" />
            Kelola Kegiatan ({activities.length})
          </button>

          <button
            onClick={handleOpenMemberModal}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition whitespace-nowrap"
          >
            <Users className="w-4 h-4" />
            Anggota & PIC ({members.length})
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
              activeTab === 'logs'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <History className="w-4 h-4" />
            Riwayat Aktivitas ({logs.length})
          </button>

          <button
            onClick={() => setIsTrashOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4" />
            Tempat Sampah ({deletedTasks.length + deletedActivities.length + deletedMembers.length + deletedLogs.length})
          </button>
        </div>

        {/* Tab Content Rendering */}
        {activeTab === 'dashboard' && (
          <DashboardView
            tasks={tasks}
            members={members}
            activeActivity={selectedActivity}
            hasOrganization={!!currentOrg}
            onSelectTask={(task) => {
              setSelectedTask(task)
              setIsDetailModalOpen(true)
            }}
            onNavigateToTasks={() => setActiveTab('tasks')}
            onOpenActivityModal={handleOpenActivityModal}
            onOpenOrgModal={handleOpenOrgModal}
          />
        )}

        {activeTab === 'tasks' && (
          <TaskListView
            tasks={tasks}
            members={members}
            onSelectTask={(task) => {
              setSelectedTask(task)
              setIsDetailModalOpen(true)
            }}
            onEditTask={(task) => {
              setTaskToEdit(task)
              setIsTaskModalOpen(true)
            }}
            onArchiveTask={handleArchiveTask}
            onUnarchiveTask={handleUnarchiveTask}
            onDeleteTask={handleDeleteTask}
            onOpenCreateTask={handleOpenCreateTask}
            onBulkArchive={async (ids) => {
              for (const id of ids) await storageService.archiveTask(id)
              refreshData()
              showToast(`${ids.length} tugas diarsipkan.`)
            }}
            onBulkDelete={async (ids) => {
              for (const id of ids) await storageService.softDeleteTask(id)
              refreshData()
              showToast(`${ids.length} tugas dipindah ke tempat sampah.`)
            }}
            onReorderTasks={(orderedIds) => {
              if (!selectedActivity) return
              storageService.reorderTasks(selectedActivity.id, orderedIds)
              refreshData()
              showToast('Urutan tugas diperbarui.')
            }}
          />
        )}

        {activeTab === 'logs' && (
          <ActivityLogView
            logs={logs}
            onArchiveLog={async (id) => { await storageService.archiveLog(id); refreshData(); showToast('Riwayat diarsipkan.') }}
            onUnarchiveLog={async (id) => { await storageService.unarchiveLog(id); refreshData(); showToast('Arsip riwayat dibuka.') }}
            onDeleteLog={async (id) => { await storageService.softDeleteLog(id); refreshData(); showToast('Riwayat dipindah ke tempat sampah.') }}
            onPermanentDeleteLog={async (id) => { await storageService.permanentlyDeleteLog(id); refreshData(); showToast('Riwayat dihapus permanen.') }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Aplikasi Monitoring Tugas Organisasi • Biaya Operasional Rp0 (GitHub Pages & Supabase)</span>
          <span className="text-slate-400">Zona Waktu: Asia/Jakarta (WIB)</span>
        </div>
      </footer>

      {/* Quick Add Task (Expert Mode) */}
      <QuickAddTaskModal
        isOpen={isQuickAddOpen}
        activityId={selectedActivity?.id || ''}
        organizationId={currentOrgId}
        members={members}
        onClose={() => setIsQuickAddOpen(false)}
        onSave={handleSaveTask}
      />

      {/* Command Palette (Expert Mode) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={[
          { id: 'new-task', label: 'Tugas baru', hint: 'N', run: handleOpenCreateTask },
          { id: 'switch-activity', label: 'Kelola / ganti kegiatan', run: handleOpenActivityModal },
          { id: 'org', label: 'Kelola organisasi', run: handleOpenOrgModal },
          { id: 'members', label: 'Kelola anggota', run: handleOpenMemberModal },
          { id: 'trash', label: 'Buka tempat sampah', run: () => setIsTrashOpen(true) },
          { id: 'export', label: 'Ekspor cadangan JSON', run: handleExportData },
          { id: 'dashboard', label: 'Tab Dashboard', run: () => setActiveTab('dashboard') },
          { id: 'tasks', label: 'Tab Daftar Tugas', run: () => setActiveTab('tasks') },
          { id: 'logs', label: 'Tab Riwayat', run: () => setActiveTab('logs') },
          ...activities
            .filter((a) => !a.is_archived && !a.deleted_at)
            .map((a) => ({
              id: `act-${a.id}`,
              label: `Tampilkan kegiatan: ${a.name}`,
              run: () => handleSelectActivity(a.id),
            })),
        ]}
      />

      {/* Bottom Nav (mobile) */}
      <BottomNav
        activeTab={activeTab === 'activities' || activeTab === 'members' ? 'dashboard' : (activeTab as 'dashboard' | 'tasks' | 'logs')}
        onNavigate={setActiveTab}
        onOpenActivities={handleOpenActivityModal}
        onOpenMembers={handleOpenMemberModal}
        onOpenTrash={() => setIsTrashOpen(true)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-slide-up">
          <span
            className={`w-2 h-2 rounded-full ${
              toastMessage.type === 'error'
                ? 'bg-red-400'
                : toastMessage.type === 'info'
                ? 'bg-blue-400'
                : 'bg-emerald-400'
            }`}
          />
          {toastMessage.text}
          {toastMessage.action && (
            <button
              onClick={() => {
                toastMessage.action!.onClick()
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
                setToastMessage(null)
              }}
              className="ml-2 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold"
            >
              {toastMessage.action.label}
            </button>
          )}
        </div>
      )}

      {/* MODALS */}
      {/* Task Create / Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        taskToEdit={taskToEdit}
        activityId={selectedActivity?.id || ''}
        organizationId={currentOrgId}
        members={members}
        onClose={() => {
          setIsTaskModalOpen(false)
          setTaskToEdit(null)
        }}
        onSave={handleSaveTask}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isDetailModalOpen}
        task={selectedTask}
        members={members}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedTask(null)
        }}
        onEdit={(task) => {
          setIsDetailModalOpen(false)
          setTaskToEdit(task)
          setIsTaskModalOpen(true)
        }}
        onArchive={handleArchiveTask}
        onUnarchive={handleUnarchiveTask}
        onDelete={handleDeleteTask}
        onQuickStatusChange={handleQuickStatusChange}
        onDuplicate={async (dup) => {
          try {
            await storageService.createTask(dup as any)
            refreshData()
            showToast('Salinan tugas dibuat.')
          } catch (e: any) {
            showToast(e?.message || 'Gagal membuat salinan tugas.', 'error')
          }
        }}
      />

      {/* Activity Management Modal */}
      <ActivityManagementModal
        isOpen={isActivityModalOpen}
        organizationId={currentOrgId}
        activities={activities}
        onClose={() => setIsActivityModalOpen(false)}
        onCreateActivity={async (data) => {
          await storageService.createActivity(data)
          refreshData()
          showToast('Kegiatan baru berhasil dibuat!')
        }}
        onUpdateActivity={async (id, patch) => {
          await storageService.updateActivity(currentOrgId, id, patch)
          refreshData()
          showToast('Kegiatan berhasil diperbarui.')
        }}
        onSetActiveActivity={async (id) => {
          await storageService.setActiveActivity(currentOrgId, id)
          refreshData()
          showToast('Kegiatan aktif telah diperbarui.')
        }}
        onArchiveActivity={async (id) => {
          await storageService.archiveActivity(currentOrgId, id)
          refreshData()
          showToast('Kegiatan berhasil diarsipkan.')
        }}
        onUnarchiveActivity={async (id) => {
          await storageService.unarchiveActivity(currentOrgId, id)
          refreshData()
          showToast('Arsip kegiatan telah dibuka kembali.')
        }}
        onDeleteActivity={(id) => {
          const act = activities.find((a) => a.id === id)
          const impact = storageService.getActivityImpact(id)
          setConfirmConfig({
            isOpen: true,
            title: 'Pindahkan Kegiatan ke Tempat Sampah',
            message: `Kegiatan "${act?.name}" akan dipindahkan ke Tempat Sampah.`,
            impactSummary: [
              `Tugas: ${impact.tasks}`,
              `Anggota terdaftar: ${impact.members}`,
              `Riwayat: ${impact.logs}`,
            ],
            requireTypedText: act?.name,
            action: async () => {
              await storageService.softDeleteActivity(currentOrgId, id)
              refreshData()
              setConfirmConfig((prev) => ({ ...prev, isOpen: false }))
              showToast('Kegiatan dipindahkan ke Tempat Sampah.')
            },
          })
        }}
      />

      {/* Member Management Modal */}
      <MemberManagementModal
        isOpen={isMemberModalOpen}
        organizationId={currentOrgId}
        activityId={selectedActivity?.id}
        members={members}
        allMembers={storageService.getMembers(currentOrgId, false, { includeDeleted: false })}
        onClose={() => setIsMemberModalOpen(false)}
        onCreateMember={async (data) => {
          const newMember = await storageService.createMember(data)
          if (selectedActivity) {
            storageService.addMemberToActivity(selectedActivity.id, newMember.id)
          }
          refreshData()
          showToast('Anggota baru berhasil ditambahkan!')
        }}
        onUpdateMember={async (id, patch) => {
          await storageService.updateMember(id, patch)
          refreshData()
          showToast('Data anggota diperbarui.')
        }}
        onDeleteMember={async (id) => {
          await storageService.deleteMember(id)
          refreshData()
          showToast('Anggota berhasil dihapus.')
        }}
        onAddMemberToActivity={async (memberId) => {
          if (!selectedActivity) return
          storageService.addMemberToActivity(selectedActivity.id, memberId)
          refreshData()
          showToast('Anggota ditambahkan ke kegiatan.')
        }}
        onRemoveMemberFromActivity={async (memberId) => {
          if (!selectedActivity) return
          try {
            storageService.removeMemberFromActivity(selectedActivity.id, memberId)
            refreshData()
            showToast('Anggota dilepas dari kegiatan.')
          } catch (e: any) {
            showToast(e?.message || 'Gagal melepas anggota.', 'error')
          }
        }}
      />

      {/* Organization Modal */}
      <OrganizationModal
        isOpen={isOrgModalOpen}
        organizations={organizations}
        currentOrgId={currentOrgId}
        onClose={() => setIsOrgModalOpen(false)}
        onSelectOrg={handleSelectOrg}
        onCreateOrg={async (data) => {
          const newOrg = await storageService.createOrganization(data)
          refreshData()
          showToast(`Organisasi "${newOrg.name}" berhasil dibuat!`)
        }}
        onUpdateOrg={async (id, patch) => {
          await storageService.updateOrganization(id, patch)
          refreshData()
          showToast('Organisasi berhasil diperbarui.')
        }}
        onDeleteOrg={async (id) => {
          await storageService.deleteOrganization(id)
          refreshData()
          showToast('Organisasi dihapus.')
        }}
      />

      {/* In-App Notifications Modal */}
      <NotificationModal
        isOpen={isNotificationOpen}
        tasks={tasks}
        members={members}
        onClose={() => setIsNotificationOpen(false)}
        onSelectTask={(task) => {
          setSelectedTask(task)
          setIsDetailModalOpen(true)
        }}
      />

      {/* Settings & Disaster Recovery Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        syncStatus={syncStatus}
        onClose={() => setIsSettingsOpen(false)}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onLoadDemoData={() => {
          storageService.loadDemoData()
          refreshData()
          showToast('Data demo berhasil dimuat ulang.')
        }}
        onClearDemoData={() => {
          storageService.clearDemoData()
          refreshData()
          showToast('Data demo berhasil dibersihkan.')
        }}
        onReloadData={async () => {
          await storageService.initSupabaseSync()
          refreshData()
        }}
        organizationId={currentOrgId}
        activities={activities}
        members={members}
        selectedActivityId={selectedActivity?.id}
        onImported={(r) => {
          refreshData()
          if (r.created > 0) {
            showToast(`${r.created} tugas berhasil diimpor.${r.failed > 0 ? ` ${r.failed} baris dilewati.` : ''}`)
          } else if (r.failed > 0) {
            showToast('Tidak ada tugas yang berhasil diimpor. Periksa format CSV.', 'error')
          }
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        impactSummary={confirmConfig.impactSummary}
        requireTypedText={confirmConfig.requireTypedText}
        isDestructive={true}
        onConfirm={confirmConfig.action}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Trash Modal */}
      <TrashModal
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        deletedTasks={deletedTasks}
        deletedActivities={deletedActivities}
        deletedMembers={deletedMembers}
        deletedLogs={deletedLogs}
        members={members}
        activities={activities}
        onRestoreTask={handleRestoreTask}
        onRestoreActivity={handleRestoreActivity}
        onRestoreMember={handleRestoreMember}
        onRestoreLog={handleRestoreLog}
        onPermanentDeleteTask={handlePermanentDeleteTask}
        onPermanentDeleteActivity={handlePermanentDeleteActivity}
        onPermanentDeleteMember={handlePermanentDeleteMember}
        onPermanentDeleteLog={handlePermanentDeleteLog}
      />
    </div>
  )
}

export default App
