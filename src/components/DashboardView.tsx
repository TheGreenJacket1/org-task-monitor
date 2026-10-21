import React from 'react'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  FileCheck2,
  ListTodo,
  TrendingUp,
  User,
  ArrowRight,
  Calendar,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { Task, Member, Activity } from '../types'
import { getDeadlineAlert, formatIndonesianDate } from '../utils/date'

interface DashboardViewProps {
  tasks: Task[]
  members: Member[]
  activeActivity: Activity | null
  hasOrganization?: boolean
  onSelectTask: (task: Task) => void
  onNavigateToTasks: () => void
  onOpenActivityModal: () => void
  onOpenOrgModal?: () => void
}

const STATUS_COLORS: Record<string, string> = {
  'Belum dikerjakan': '#94a3b8', // slate-400
  'Dikerjakan': '#3b82f6', // blue-500
  'Revisi': '#f59e0b', // amber-500
  'Selesai': '#10b981', // emerald-500
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tasks,
  members,
  activeActivity,
  hasOrganization = true,
  onSelectTask,
  onNavigateToTasks,
  onOpenActivityModal,
  onOpenOrgModal,
}) => {
  // If there is no organization yet, all data views are empty by design.
  if (!hasOrganization) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Belum Ada Organisasi</h2>
        <p className="text-slate-600 mt-2 text-sm leading-relaxed">
          Buat organisasi terlebih dahulu. Setelah itu Anda dapat menambahkan kegiatan, anggota/PIC,
          tugas, dan melihat riwayat aktivitas.
        </p>
        {onOpenOrgModal && (
          <button
            onClick={onOpenOrgModal}
            className="mt-6 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-sm transition"
          >
            Buat Organisasi Baru
          </button>
        )}
      </div>
    )
  }

  // If there is an organization but no active activity
  if (!activeActivity) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Belum Ada Kegiatan Aktif</h2>
        <p className="text-slate-600 mt-2 text-sm leading-relaxed">
          Setiap organisasi hanya dapat memiliki satu kegiatan aktif pada satu waktu.
          Silakan pilih atau buat kegiatan baru untuk mulai memonitor progres tugas organisasi.
        </p>
        <button
          onClick={onOpenActivityModal}
          className="mt-6 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-sm transition"
        >
          Kelola / Aktifkan Kegiatan
        </button>
      </div>
    )
  }

  // Calculate metrics
  const activeTasks = tasks.filter((t) => !t.is_archived)
  const totalTasks = activeTasks.length
  const completedTasks = activeTasks.filter((t) => t.status === 'Selesai').length
  const inProgressTasks = activeTasks.filter((t) => t.status === 'Dikerjakan').length
  const notStartedTasks = activeTasks.filter((t) => t.status === 'Belum dikerjakan').length
  const revisionTasks = activeTasks.filter(
    (t) => t.status === 'Revisi' || t.review_status === 'Perlu revisi'
  ).length
  const awaitingReviewTasks = activeTasks.filter(
    (t) => t.review_status === 'Menunggu review' && t.status !== 'Selesai'
  ).length

  // Overdue tasks
  const overdueTasks = activeTasks.filter((t) => {
    const alert = getDeadlineAlert(t.deadline, t.status)
    return alert?.type === 'OVERDUE'
  })

  // Percentage
  const completionPercentage =
    totalTasks > 0 ? Number(((completedTasks / totalTasks) * 100).toFixed(1)) : 0

  // Distribution for Pie Chart
  const statusDistribution = [
    { name: 'Belum dikerjakan', count: notStartedTasks, color: STATUS_COLORS['Belum dikerjakan'] },
    { name: 'Dikerjakan', count: inProgressTasks, color: STATUS_COLORS['Dikerjakan'] },
    { name: 'Revisi', count: revisionTasks, color: STATUS_COLORS['Revisi'] },
    { name: 'Selesai', count: completedTasks, color: STATUS_COLORS['Selesai'] },
  ].filter((item) => item.count > 0)

  // Staff summary for Bar Chart
  const staffSummary = members
    .filter((m) => m.is_active)
    .map((member) => {
      const memberTasks = activeTasks.filter((t) => t.pic_id === member.id)
      const done = memberTasks.filter((t) => t.status === 'Selesai').length
      const active = memberTasks.length - done
      return {
        name: member.name.split(' ')[0], // first name for chart
        fullName: member.name,
        role: member.role,
        Selesai: done,
        'Belum Selesai': active,
        total: memberTasks.length,
      }
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  // Nearest deadlines (exclude completed, sort by deadline ascending)
  const nearestDeadlines = [...activeTasks]
    .filter((t) => t.status !== 'Selesai')
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 5)

  // Needs attention (Overdue or Needs Revision)
  const needsAttention = activeTasks
    .filter((t) => {
      if (t.status === 'Selesai') return false
      const alert = getDeadlineAlert(t.deadline, t.status)
      return alert?.type === 'OVERDUE' || t.status === 'Revisi' || t.review_status === 'Perlu revisi'
    })
    .slice(0, 6)

  return (
    <div className="space-y-6">
      {/* Activity Header Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/30 text-xs font-semibold text-emerald-100 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Kegiatan Aktif
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {activeActivity.name}
            </h2>
            <p className="text-emerald-100/90 text-sm mt-1 max-w-2xl">
              {activeActivity.description || 'Tidak ada deskripsi kegiatan.'}
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-emerald-200">
              <span>Mulai: {formatIndonesianDate(activeActivity.start_date)}</span>
              <span>•</span>
              <span>Target Selesai: {formatIndonesianDate(activeActivity.end_date)}</span>
            </div>
          </div>

          {/* Big Progress Metric */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[200px] text-center">
            <span className="text-xs uppercase tracking-wider text-emerald-200 font-medium">
              Penyelesaian Tugas
            </span>
            <div className="text-4xl font-extrabold text-white mt-1">
              {completionPercentage}%
            </div>
            <div className="w-full bg-white/20 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-emerald-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <div className="text-[11px] text-emerald-200 mt-2">
              {completedTasks} dari {totalTasks} tugas selesai
            </div>
          </div>
        </div>
      </div>

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Tasks */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total</span>
            <ListTodo className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900">{totalTasks}</div>
            <div className="text-xs text-slate-500">Tugas aktif</div>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-xl p-4 border border-emerald-100 bg-emerald-50/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Selesai</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-600">{completedTasks}</div>
            <div className="text-xs text-emerald-700 font-medium">{completionPercentage}% total</div>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white rounded-xl p-4 border border-blue-100 bg-blue-50/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Berjalan</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
            <div className="text-xs text-blue-600">Sedang diproses</div>
          </div>
        </div>

        {/* Awaiting Review */}
        <div className="bg-white rounded-xl p-4 border border-purple-100 bg-purple-50/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Review</span>
            <FileCheck2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-purple-600">{awaitingReviewTasks}</div>
            <div className="text-xs text-purple-600">Menunggu review</div>
          </div>
        </div>

        {/* Needs Revision */}
        <div className="bg-white rounded-xl p-4 border border-amber-100 bg-amber-50/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Revisi</span>
            <RotateCcw className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-amber-600">{revisionTasks}</div>
            <div className="text-xs text-amber-600">Perlu perbaikan</div>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white rounded-xl p-4 border border-red-100 bg-red-50/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-red-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Terlambat</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-red-600">{overdueTasks.length}</div>
            <div className="text-xs text-red-600 font-medium">Melewati deadline</div>
          </div>
        </div>
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Distribusi Status Tugas</h3>
              <p className="text-xs text-slate-500">Pembagian proporsi seluruh tugas aktif saat ini</p>
            </div>
            <TrendingUp className="w-5 h-5 text-slate-400" />
          </div>

          {statusDistribution.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              Belum ada data tugas untuk ditampilkan.
            </div>
          ) : (
            <div className="h-64 flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="w-full sm:w-1/2 h-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [`${value} tugas`, name]}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend List */}
              <div className="w-full sm:w-1/2 space-y-2">
                {statusDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-slate-700 font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-900">
                      {item.count}{' '}
                      <span className="text-slate-400 font-normal">
                        ({Math.round((item.count / totalTasks) * 100)}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Staff Task Summary Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Ringkasan Tugas per Staf</h3>
              <p className="text-xs text-slate-500">Perbandingan tugas selesai vs aktif per anggota</p>
            </div>
            <User className="w-5 h-5 text-slate-400" />
          </div>

          {staffSummary.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              Belum ada tugas yang ditugaskan ke anggota aktif.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffSummary} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="Selesai" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="Belum Selesai" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Action Lists: Overdue/Revision & Nearest Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Attention (Overdue / Revisi) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">
                !
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Perhatian Mendesak</h3>
                <p className="text-xs text-slate-500">Tugas terlambat dan yang membutuhkan revisi</p>
              </div>
            </div>
            <button
              onClick={onNavigateToTasks}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {needsAttention.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl text-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Bagus! Tidak ada tugas yang terlambat atau memerlukan revisi saat ini.
            </div>
          ) : (
            <div className="space-y-3">
              {needsAttention.map((task) => {
                const pic = members.find((m) => m.id === task.pic_id)
                const alert = getDeadlineAlert(task.deadline, task.status)
                const isOverdue = alert?.type === 'OVERDUE'

                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 transition cursor-pointer flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            isOverdue
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isOverdue ? alert?.label : 'Perlu Revisi'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {task.category} • {task.phase}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 truncate">
                        {task.title}
                      </h4>
                      {task.status === 'Revisi' && task.revision_notes && (
                        <p className="text-xs text-amber-800 bg-amber-50/70 p-2 rounded-lg mt-1.5 border border-amber-100 line-clamp-2">
                          <strong>Catatan Revisi:</strong> {task.revision_notes}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-medium text-slate-700">
                        {pic?.name || 'PIC tidak diset'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Deadline: {formatIndonesianDate(task.deadline)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Nearest Deadlines */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Deadline Terdekat</h3>
                <p className="text-xs text-slate-500">Tugas yang mendekati tenggat waktu kalender</p>
              </div>
            </div>
            <button
              onClick={onNavigateToTasks}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              Kelola Tugas <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {nearestDeadlines.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl text-sm">
              Seluruh tugas aktif telah diselesaikan.
            </div>
          ) : (
            <div className="space-y-3">
              {nearestDeadlines.map((task) => {
                const pic = members.find((m) => m.id === task.pic_id)
                const alert = getDeadlineAlert(task.deadline, task.status)

                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 transition cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {alert && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${alert.badgeColor}`}
                          >
                            {alert.label}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 font-medium">
                          PIC: {pic?.name || '-'}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 truncate">
                        {task.title}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-900">
                        {formatIndonesianDate(task.deadline)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Progres: {task.progress}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
