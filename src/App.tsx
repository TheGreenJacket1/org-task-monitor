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

type TabType = 'dashboard' | 'tasks' | 'activities' | 'members' | 'logs'

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')

  // Core Data States
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrgId, setCurrentOrgId] = useState<string>('')
  const [members, setMembers] = useState<Member[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
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

  // Confirm delete modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean
    title: string
    message: string
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
  } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    // Cancel the previous timer so an older toast cannot dismiss a newer one.
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    setToastMessage({ text, type })
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null)
      toastTimerRef.current = null
    }, 3500)
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
      setMembers(storageService.getMembers(curId))
      setActivities(storageService.getActivities(curId))
      setTasks(storageService.getTasks(curId, undefined, true))
      setLogs(storageService.getActivityLogs(curId, 100))
    } else {
      setMembers([])
      setActivities([])
      setTasks([])
      setLogs([])
    }
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
  const activeActivity = activities.find((a) => a.is_active && !a.is_archived) || null

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
    if (!activeActivity) {
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
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Tugas',
      message: 'Apakah Anda yakin ingin menghapus tugas ini? Tindakan ini tidak dapat dibatalkan.',
      action: async () => {
        await storageService.deleteTask(taskId)
        refreshData()
        setIsDetailModalOpen(false)
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }))
        showToast('Tugas telah dihapus.')
      },
    })
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
        activeActivity={activeActivity}
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        </div>

        {/* Tab Content Rendering */}
        {activeTab === 'dashboard' && (
          <DashboardView
            tasks={tasks}
            members={members}
            activeActivity={activeActivity}
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
          />
        )}

        {activeTab === 'logs' && <ActivityLogView logs={logs} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Aplikasi Monitoring Tugas Organisasi • Biaya Operasional Rp0 (GitHub Pages & Supabase)</span>
          <span className="text-slate-400">Zona Waktu: Asia/Jakarta (WIB)</span>
        </div>
      </footer>

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
        </div>
      )}

      {/* MODALS */}
      {/* Task Create / Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        taskToEdit={taskToEdit}
        activityId={activeActivity?.id || ''}
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
      />

      {/* Member Management Modal */}
      <MemberManagementModal
        isOpen={isMemberModalOpen}
        organizationId={currentOrgId}
        members={members}
        onClose={() => setIsMemberModalOpen(false)}
        onCreateMember={async (data) => {
          await storageService.createMember(data)
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
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        isDestructive={true}
        onConfirm={confirmConfig.action}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

export default App
