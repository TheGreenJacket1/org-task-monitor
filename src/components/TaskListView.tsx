import React, { useState, useMemo } from 'react'
import {
  Search,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List,
  Edit2,
  Trash2,
  Archive,
  FolderArchive,
  ExternalLink,
  Plus,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Calendar,
  User,
  Clock,
} from 'lucide-react'
import {
  Task,
  Member,
  TaskCategory,
  TaskPhase,
  TaskPriority,
  TaskStatus,
  TaskReviewStatus,
} from '../types'
import { formatIndonesianDate, getDeadlineAlert } from '../utils/date'

interface TaskListViewProps {
  tasks: Task[]
  members: Member[]
  onSelectTask: (task: Task) => void
  onEditTask: (task: Task) => void
  onArchiveTask: (taskId: string) => void
  onUnarchiveTask: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  onOpenCreateTask: () => void
}

const CATEGORIES: (TaskCategory | 'Semua')[] = ['Semua', 'Desain', 'Publikasi', 'Dokumentasi', 'Administrasi', 'Lainnya']
const PHASES: (TaskPhase | 'Semua')[] = ['Semua', 'Pra-acara', 'Hari-H', 'Pasca-acara']
const PRIORITIES: (TaskPriority | 'Semua')[] = ['Semua', 'Mendesak', 'Tinggi', 'Sedang', 'Rendah']
const STATUSES: (TaskStatus | 'Semua')[] = ['Semua', 'Belum dikerjakan', 'Dikerjakan', 'Revisi', 'Selesai']
const REVIEW_STATUSES: (TaskReviewStatus | 'Semua')[] = ['Semua', 'Belum diajukan', 'Menunggu review', 'Disetujui', 'Perlu revisi']

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  members,
  onSelectTask,
  onEditTask,
  onArchiveTask,
  onUnarchiveTask,
  onDeleteTask,
  onOpenCreateTask,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | 'Semua'>('Semua')
  const [selectedPhase, setSelectedPhase] = useState<TaskPhase | 'Semua'>('Semua')
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | 'Semua'>('Semua')
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'Semua'>('Semua')
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<TaskReviewStatus | 'Semua'>('Semua')
  const [selectedPic, setSelectedPic] = useState<string>('Semua')
  const [showArchived, setShowArchived] = useState(false)
  const [sortBy, setSortBy] = useState<'deadline' | 'priority' | 'progress' | 'updated_at' | 'title'>('deadline')
  const [sortAsc, setSortAsc] = useState(true)

  // Map member names for fast lookup
  const memberMap = useMemo(() => {
    const map = new Map<string, Member>()
    members.forEach((m) => map.set(m.id, m))
    return map
  }, [members])

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        // Archive filter
        if (showArchived ? !task.is_archived : task.is_archived) return false

        // Category
        if (selectedCategory !== 'Semua' && task.category !== selectedCategory) return false

        // Phase
        if (selectedPhase !== 'Semua' && task.phase !== selectedPhase) return false

        // Priority
        if (selectedPriority !== 'Semua' && task.priority !== selectedPriority) return false

        // Status
        if (selectedStatus !== 'Semua' && task.status !== selectedStatus) return false

        // Review Status
        if (selectedReviewStatus !== 'Semua' && task.review_status !== selectedReviewStatus) return false

        // PIC
        if (selectedPic !== 'Semua' && task.pic_id !== selectedPic) return false

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const picName = memberMap.get(task.pic_id)?.name.toLowerCase() || ''
          const matchTitle = task.title.toLowerCase().includes(q)
          const matchDesc = task.description.toLowerCase().includes(q)
          const matchPic = picName.includes(q)
          const matchCategory = task.category.toLowerCase().includes(q)
          if (!matchTitle && !matchDesc && !matchPic && !matchCategory) return false
        }

        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortBy === 'deadline') {
          cmp = a.deadline.localeCompare(b.deadline)
        } else if (sortBy === 'priority') {
          const priorityWeight = { Mendesak: 4, Tinggi: 3, Sedang: 2, Rendah: 1 }
          cmp = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0)
        } else if (sortBy === 'progress') {
          cmp = a.progress - b.progress
        } else if (sortBy === 'title') {
          cmp = a.title.localeCompare(b.title)
        } else if (sortBy === 'updated_at') {
          cmp = a.updated_at.localeCompare(b.updated_at)
        }
        return sortAsc ? cmp : -cmp
      })
  }, [
    tasks,
    showArchived,
    selectedCategory,
    selectedPhase,
    selectedPriority,
    selectedStatus,
    selectedReviewStatus,
    selectedPic,
    searchQuery,
    sortBy,
    sortAsc,
    memberMap,
  ])

  const priorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'Mendesak':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'Tinggi':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'Sedang':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Rendah':
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const statusBadge = (s: TaskStatus) => {
    switch (s) {
      case 'Selesai':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300'
      case 'Revisi':
        return 'bg-amber-100 text-amber-800 border-amber-300'
      case 'Dikerjakan':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'Belum dikerjakan':
        return 'bg-slate-100 text-slate-700 border-slate-300'
    }
  }

  return (
    <div className="space-y-4">
      {/* Search, Filter Toolbar & Views */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        {/* Top Line: Search & View Toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul tugas, deskripsi, atau nama staf..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Active vs Archived Toggle */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
              <button
                onClick={() => setShowArchived(false)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  !showArchived ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tugas Aktif
              </button>
              <button
                onClick={() => setShowArchived(true)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  showArchived ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Arsip
              </button>
            </div>

            {/* View Mode: Table vs Grid */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Tampilan Tabel"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Tampilan Kartu"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Tambah Tugas Button */}
            <button
              onClick={onOpenCreateTask}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tugas</span>
            </button>
          </div>
        </div>

        {/* Filter Pills / Selectors */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* Category */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Kategori
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Phase */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Fase
            </label>
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value as any)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
            >
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Prioritas
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as any)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
            >
              {PRIORITIES.map((pr) => (
                <option key={pr} value={pr}>
                  {pr}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* PIC */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Penanggung Jawab (PIC)
            </label>
            <select
              value={selectedPic}
              onChange={(e) => setSelectedPic(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
            >
              <option value="Semua">Semua Anggota</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Urutkan Berdasarkan
            </label>
            <div className="flex gap-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium truncate"
              >
                <option value="deadline">Deadline</option>
                <option value="priority">Prioritas</option>
                <option value="progress">Progres</option>
                <option value="updated_at">Terbaru</option>
                <option value="title">Judul (A-Z)</option>
              </select>
              <button
                onClick={() => setSortAsc(!sortAsc)}
                className="p-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100"
                title={sortAsc ? 'Menaik (Asc)' : 'Menurun (Desc)'}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Task Count Notice */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Menampilkan <strong>{filteredTasks.length}</strong> tugas{' '}
          {showArchived && '(Diarsipkan)'}
        </span>
      </div>

      {/* Empty State */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Tidak Ada Tugas yang Cocok</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Tidak ditemukan tugas sesuai kriteria pencarian atau filter yang dipilih. Coba reset filter
            atau buat tugas baru.
          </p>
          <button
            onClick={() => {
              setSearchQuery('')
              setSelectedCategory('Semua')
              setSelectedPhase('Semua')
              setSelectedPriority('Semua')
              setSelectedStatus('Semua')
              setSelectedReviewStatus('Semua')
              setSelectedPic('Semua')
            }}
            className="mt-4 px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
          >
            Reset Semua Filter
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Tugas</th>
                  <th className="py-3 px-3">Kategori & Fase</th>
                  <th className="py-3 px-3">Prioritas</th>
                  <th className="py-3 px-3">PIC</th>
                  <th className="py-3 px-3">Deadline</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Progres</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const pic = memberMap.get(task.pic_id)
                  const alert = getDeadlineAlert(task.deadline, task.status)

                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/80 transition group cursor-pointer"
                      onClick={() => onSelectTask(task)}
                    >
                      {/* Title & Description */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 truncate group-hover:text-emerald-700 transition">
                          {task.title}
                        </div>
                        {task.status === 'Revisi' && task.revision_notes && (
                          <div className="text-[11px] text-amber-800 font-medium truncate mt-0.5 flex items-center gap-1">
                            <RotateCcw className="w-3 h-3 shrink-0 text-amber-600" />
                            <span className="truncate">{task.revision_notes}</span>
                          </div>
                        )}
                      </td>

                      {/* Category & Phase */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-700">{task.category}</span>
                        <span className="text-slate-400 block text-[11px]">{task.phase}</span>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] border ${priorityBadge(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                      </td>

                      {/* PIC */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: pic?.avatar_color || '#16a34a' }}
                          >
                            {pic?.name.charAt(0) || 'P'}
                          </div>
                          <span className="font-medium text-slate-800 truncate max-w-[120px]">
                            {pic?.name || 'Tidak ada'}
                          </span>
                        </div>
                      </td>

                      {/* Deadline */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {formatIndonesianDate(task.deadline)}
                        </div>
                        {alert && (
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border mt-0.5 ${alert.badgeColor}`}
                          >
                            {alert.label}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${statusBadge(
                            task.status
                          )}`}
                        >
                          {task.status}
                        </span>
                      </td>

                      {/* Progress */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 w-28">
                          <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                task.status === 'Selesai' ? 'bg-emerald-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700 text-[11px] w-8 text-right">
                            {task.progress}%
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEditTask(task)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                            title="Edit Tugas"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {task.is_archived ? (
                            <button
                              onClick={() => onUnarchiveTask(task.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                              title="Buka Arsip"
                            >
                              <FolderArchive className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => onArchiveTask(task.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                              title="Arsipkan"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onDeleteTask(task.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Hapus Tugas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARD / GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const pic = memberMap.get(task.pic_id)
            const alert = getDeadlineAlert(task.deadline, task.status)

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition cursor-pointer p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityBadge(
                        task.priority
                      )}`}
                    >
                      {task.priority}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(
                        task.status
                      )}`}
                    >
                      {task.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm line-clamp-2">{task.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {task.description || 'Tidak ada deskripsi.'}
                  </p>

                  {task.status === 'Revisi' && task.revision_notes && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                      <strong>Revisi:</strong> {task.revision_notes}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">Progres</span>
                      <span className="font-bold text-slate-900">{task.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${
                          task.status === 'Selesai' ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* PIC & Deadline Info */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: pic?.avatar_color || '#16a34a' }}
                      >
                        {pic?.name.charAt(0) || 'P'}
                      </div>
                      <span className="font-medium text-slate-700 truncate max-w-[100px]">
                        {pic?.name || '-'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-semibold text-slate-800">
                        {formatIndonesianDate(task.deadline)}
                      </span>
                      {alert && (
                        <div className="text-[10px]">
                          <span className={`px-1 rounded border font-semibold ${alert.badgeColor}`}>
                            {alert.label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
