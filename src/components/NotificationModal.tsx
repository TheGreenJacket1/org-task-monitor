import React from 'react'
import {
  X,
  Bell,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowRight,
  Info,
} from 'lucide-react'
import { Task, Member } from '../types'
import { getDeadlineAlert, formatIndonesianDate } from '../utils/date'

interface NotificationModalProps {
  isOpen: boolean
  tasks: Task[]
  members: Member[]
  onClose: () => void
  onSelectTask: (task: Task) => void
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  tasks,
  members,
  onClose,
  onSelectTask,
}) => {
  if (!isOpen) return null

  const memberMap = new Map<string, Member>()
  members.forEach((m) => memberMap.set(m.id, m))

  // Filter tasks that need attention
  // Exclude completed tasks (rule: completed tasks never generate deadline alerts)
  const activeTasks = tasks.filter((t) => !t.is_archived && t.status !== 'Selesai')

  const overdueTasks: Task[] = []
  const todayTasks: Task[] = []
  const h1Tasks: Task[] = []
  const h3Tasks: Task[] = []
  const h7Tasks: Task[] = []
  const revisionTasks: Task[] = []

  activeTasks.forEach((task) => {
    const alert = getDeadlineAlert(task.deadline, task.status)
    if (alert?.type === 'OVERDUE') overdueTasks.push(task)
    else if (alert?.type === 'TODAY') todayTasks.push(task)
    else if (alert?.type === 'H-1') h1Tasks.push(task)
    else if (alert?.type === 'H-3') h3Tasks.push(task)
    else if (alert?.type === 'H-7') h7Tasks.push(task)

    if (task.status === 'Revisi' || task.review_status === 'Perlu revisi') {
      revisionTasks.push(task)
    }
  })

  const totalUrgent =
    overdueTasks.length +
    todayTasks.length +
    h1Tasks.length +
    h3Tasks.length +
    h7Tasks.length +
    revisionTasks.length

  const renderSection = (
    title: string,
    badgeText: string,
    badgeClass: string,
    items: Task[],
    icon: React.ReactNode
  ) => {
    if (items.length === 0) return null

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {title}
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
            {items.length} {badgeText}
          </span>
        </div>

        <div className="space-y-1.5">
          {items.map((task) => {
            const pic = memberMap.get(task.pic_id)

            return (
              <div
                key={task.id}
                onClick={() => {
                  onSelectTask(task)
                  onClose()
                }}
                className="p-3 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-slate-50/80 rounded-xl transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-0.5">
                    <span className="font-semibold text-slate-700">{task.category}</span>
                    <span>•</span>
                    <span>PIC: {pic?.name || 'Belum diset'}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition truncate">
                    {task.title}
                  </h4>
                  {task.status === 'Revisi' && task.revision_notes && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded mt-1 border border-amber-100 truncate">
                      <strong>Revisi:</strong> {task.revision_notes}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0 flex items-center gap-2">
                  <div className="text-[11px]">
                    <span className="font-semibold text-slate-800 block">
                      {formatIndonesianDate(task.deadline)}
                    </span>
                    <span className="text-slate-400 text-[10px]">{task.progress}% progres</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="modal-sheet bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Pusat Peringatan & Deadline</h3>
              <p className="text-xs text-slate-500">
                Peringatan H-7, H-3, H-1, dan tugas terlambat (Zona Waktu: Asia/Jakarta).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-11 w-11 md:h-auto md:w-auto md:p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition shrink-0"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Callout */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 px-6 py-2.5 text-xs text-emerald-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Notifikasi diperbarui secara langsung saat aplikasi dibuka atau data tugas disinkronkan.
          </span>
        </div>

        {/* Content */}
        <div className="modal-sheet-body p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {totalUrgent === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-2xl p-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-bold text-slate-900 text-sm">Semua Tugas Terkendali</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Tidak ada tugas terlambat, deadline mendekat (H-7/3/1), maupun tugas yang membutuhkan
                revisi saat ini.
              </p>
            </div>
          ) : (
            <>
              {/* Overdue */}
              {renderSection(
                'Tugas Melewati Deadline (Terlambat)',
                'Tugas',
                'bg-red-100 text-red-800 border-red-300',
                overdueTasks,
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}

              {/* Today */}
              {renderSection(
                'Deadline Hari Ini',
                'Tugas',
                'bg-amber-100 text-amber-900 border-amber-300',
                todayTasks,
                <Clock className="w-4 h-4 text-amber-600" />
              )}

              {/* H-1 */}
              {renderSection(
                'Peringatan H-1 (Deadline Besok)',
                'Tugas',
                'bg-amber-100 text-amber-800 border-amber-300',
                h1Tasks,
                <Clock className="w-4 h-4 text-amber-500" />
              )}

              {/* H-3 */}
              {renderSection(
                'Peringatan H-3 (3 Hari Lagi)',
                'Tugas',
                'bg-yellow-100 text-yellow-800 border-yellow-300',
                h3Tasks,
                <Calendar className="w-4 h-4 text-yellow-600" />
              )}

              {/* H-7 */}
              {renderSection(
                'Peringatan H-7 (1 Minggu Lagi)',
                'Tugas',
                'bg-blue-100 text-blue-800 border-blue-200',
                h7Tasks,
                <Calendar className="w-4 h-4 text-blue-600" />
              )}

              {/* Needs Revision */}
              {renderSection(
                'Tugas Memerlukan Revisi',
                'Tugas',
                'bg-orange-100 text-orange-800 border-orange-300',
                revisionTasks,
                <RotateCcw className="w-4 h-4 text-orange-600" />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-sheet-footer px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
