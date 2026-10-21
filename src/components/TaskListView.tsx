import React, { useState, useMemo, useRef } from 'react'
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
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  Task,
  Member,
  TaskCategory,
  TaskPhase,
  TaskPriority,
  TaskStatus,
  TaskReviewStatus,
  DeadlineAlertInfo,
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
  onBulkArchive?: (ids: string[]) => void
  onBulkDelete?: (ids: string[]) => void
  /**
   * Dipanggil ketika user mengurutkan ulang tugas lewat drag & drop.
   * `orderedIds` berisi id tugas dalam urutan yang sedang terlihat di layar.
   */
  onReorderTasks?: (orderedIds: string[]) => void
}

const CATEGORIES: (TaskCategory | 'Semua')[] = ['Semua', 'Desain', 'Publikasi', 'Dokumentasi', 'Administrasi', 'Lainnya']
const PHASES: (TaskPhase | 'Semua')[] = ['Semua', 'Pra-acara', 'Hari-H', 'Pasca-acara']
const PRIORITIES: (TaskPriority | 'Semua')[] = ['Semua', 'Mendesak', 'Tinggi', 'Sedang', 'Rendah']
const STATUSES: (TaskStatus | 'Semua')[] = ['Semua', 'Belum dikerjakan', 'Dikerjakan', 'Revisi', 'Selesai']
const REVIEW_STATUSES: (TaskReviewStatus | 'Semua')[] = ['Semua', 'Belum diajukan', 'Menunggu review', 'Disetujui', 'Perlu revisi']

/** True bila drag baru saja selesai (untuk menahan klik baris yang tidak disengaja). */
const isRecentDrag = (lastDragEnd: number) => Date.now() - lastDragEnd < 300

interface TaskCardProps {
  task: Task
  pic?: Member
  alert: DeadlineAlertInfo | null
  priorityClass: string
  statusClass: string
  selected: boolean
  onToggleSelect: () => void
  onSelect: () => void
  onEdit: () => void
  onArchive: () => void
  onUnarchive: () => void
  onDelete: () => void
}

/**
 * Kartu tugas untuk layar kecil (< md), menggantikan tabel agar tidak terjadi
 * scroll horizontal. Semua target sentuh memiliki minimal 44x44px.
 */
const TaskCard: React.FC<TaskCardProps> = ({
  task,
  pic,
  alert,
  priorityClass,
  statusClass,
  selected,
  onToggleSelect,
  onSelect,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}) => {
  const actionBtn =
    'h-11 w-11 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Judul + checkbox bulk select */}
      <div className="flex items-start gap-3 p-4 pb-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 h-5 w-5 rounded shrink-0"
          aria-label={`Pilih ${task.title}`}
        />
        <button onClick={onSelect} className="min-w-0 flex-1 text-left">
          <h4 className="font-bold text-sm text-slate-900 leading-snug">{task.title}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{task.category}</span>
            <span className="text-slate-300">|</span>
            <span>{task.phase}</span>
          </div>
        </button>
      </div>

      {/* Badge prioritas & status */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`px-2 py-1 rounded-full font-bold text-[10px] border ${priorityClass}`}
        >
          {task.priority}
        </span>
        <span
          className={`px-2 py-1 rounded-full font-bold text-[10px] border ${statusClass}`}
        >
          {task.status}
        </span>
      </div>

      {task.status === 'Revisi' && task.revision_notes && (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-800 flex items-start gap-1.5">
          <RotateCcw className="w-3 h-3 mt-0.5 shrink-0 text-amber-600" />
          <span className="line-clamp-2">{task.revision_notes}</span>
        </div>
      )}

      {/* PIC, deadline & progres */}
      <div className="px-4 pb-3 space-y-2.5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div
              className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
              style={{ backgroundColor: pic?.avatar_color || '#16a34a' }}
            >
              {pic?.name.charAt(0) || 'P'}
            </div>
            <span className="font-medium text-slate-800 truncate">{pic?.name || 'Tidak ada'}</span>
          </div>

          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1 font-semibold text-slate-900">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatIndonesianDate(task.deadline)}
            </div>
            {alert && (
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border mt-1 ${alert.badgeColor}`}
              >
                {alert.label}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full ${
                task.status === 'Selesai' ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${task.progress}%` }}
            />
          </div>
          <span className="font-bold text-slate-700 text-[11px] w-9 text-right">{task.progress}%</span>
        </div>
      </div>

      {/* Aksi - target sentuh 44x44px */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2">
        <button
          onClick={onEdit}
          className={`${actionBtn} hover:text-slate-800 hover:bg-slate-100`}
          title="Edit Tugas"
          aria-label="Edit Tugas"
        >
          <Edit2 className="w-4 h-4" />
        </button>

        {task.is_archived ? (
          <button
            onClick={onUnarchive}
            className={`${actionBtn} hover:text-slate-800 hover:bg-slate-100`}
            title="Buka Arsip"
            aria-label="Buka Arsip"
          >
            <FolderArchive className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onArchive}
            className={`${actionBtn} hover:text-slate-800 hover:bg-slate-100`}
            title="Arsipkan"
            aria-label="Arsipkan"
          >
            <Archive className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onDelete}
          className={`${actionBtn} text-red-500 hover:text-red-700 hover:bg-red-50 hover:border-red-200`}
          title="Hapus Tugas"
          aria-label="Hapus Tugas"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  members,
  onSelectTask,
  onEditTask,
  onArchiveTask,
  onUnarchiveTask,
  onDeleteTask,
  onOpenCreateTask,
  onBulkArchive,
  onBulkDelete,
  onReorderTasks,
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
  const [sortBy, setSortBy] = useState<'deadline' | 'priority' | 'progress' | 'updated_at' | 'title' | 'manual'>('deadline')
  const [sortAsc, setSortAsc] = useState(true)
  const [groupBy, setGroupBy] = useState<'none' | 'category' | 'phase' | 'priority' | 'status' | 'pic'>('none')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(true)
  const [savedViews, setSavedViews] = useState<Array<{ name: string; filters: Record<string, string> }>>([])
  const [viewName, setViewName] = useState('')
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    try { return (localStorage.getItem('org_monitor_density_v1') as any) || 'comfortable' } catch { return 'comfortable' }
  })

  // --- Urutan manual (drag & drop) ---
  const [manualOrder, setManualOrder] = useState<string[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const lastDragEndRef = useRef(0)
  const dragOriginRef = useRef<HTMLElement | null>(null)

  // --- Tampilan mobile (kartu) ---
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(max-width: 767px)').matches
  })

  const toggleDensity = () => {
    const next = density === 'comfortable' ? 'compact' : 'comfortable'
    setDensity(next)
    try { localStorage.setItem('org_monitor_density_v1', next) } catch {}
  }

  // Deteksi ukuran layar: < md (767px) -> tampilkan kartu, bukan tabel
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(max-width: 767px)')
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    }
    mql.addListener(onChange)
    return () => mql.removeListener(onChange)
  }, [])

  // Load saved views
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('org_monitor_saved_views_v1')
      if (raw) setSavedViews(JSON.parse(raw))
    } catch {}
  }, [])

  const saveCurrentView = () => {
    if (!viewName.trim()) return
    const filters = {
      category: selectedCategory,
      phase: selectedPhase,
      priority: selectedPriority,
      status: selectedStatus,
      reviewStatus: selectedReviewStatus,
      pic: selectedPic,
      search: searchQuery,
      groupBy,
    }
    const next = [...savedViews.filter((v) => v.name !== viewName.trim()), { name: viewName.trim(), filters }]
    setSavedViews(next)
    localStorage.setItem('org_monitor_saved_views_v1', JSON.stringify(next))
    setViewName('')
  }

  const applyView = (v: { name: string; filters: Record<string, string> }) => {
    setSelectedCategory((v.filters.category as any) || 'Semua')
    setSelectedPhase((v.filters.phase as any) || 'Semua')
    setSelectedPriority((v.filters.priority as any) || 'Semua')
    setSelectedStatus((v.filters.status as any) || 'Semua')
    setSelectedReviewStatus((v.filters.reviewStatus as any) || 'Semua')
    setSelectedPic(v.filters.pic || 'Semua')
    setSearchQuery(v.filters.search || '')
    setGroupBy((v.filters.groupBy as any) || 'none')
  }

  // Map member names for fast lookup
  const memberMap = useMemo(() => {
    const map = new Map<string, Member>()
    members.forEach((m) => map.set(m.id, m))
    return map
  }, [members])

  // Peta urutan manual hasil drag & drop (id -> posisi)
  const manualRank = useMemo(() => {
    const map = new Map<string, number>()
    manualOrder.forEach((id, i) => map.set(id, i))
    return map
  }, [manualOrder])

  // Urutan manual hanya tersedia saat tidak ada pengelompokan & mode tabel
  const canReorder = groupBy === 'none' && viewMode === 'table'

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
        // Urutan manual: selalu menaik, mengabaikan sortAsc
        if (sortBy === 'manual') {
          const ra = manualRank.get(a.id)
          const rb = manualRank.get(b.id)
          if (ra !== undefined && rb !== undefined) return ra - rb
          if (ra !== undefined) return -1
          if (rb !== undefined) return 1
          const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER
          const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER
          if (sa !== sb) return sa - sb
          return a.deadline.localeCompare(b.deadline)
        }
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
    manualRank,
  ])

  // Grouped tasks for grouping view
  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return null
    const groups = new Map<string, Task[]>()
    for (const t of filteredTasks) {
      let key = ''
      switch (groupBy) {
        case 'category': key = t.category; break
        case 'phase': key = t.phase; break
        case 'priority': key = t.priority; break
        case 'status': key = t.status; break
        case 'pic': key = memberMap.get(t.pic_id)?.name || t.pic_id; break
      }
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredTasks, groupBy, memberMap])

  // Baris tabel: menyisipkan header grup di antara tugas bila pengelompokan aktif
  const tableRows = useMemo(() => {
    if (!groupedTasks) {
      return filteredTasks.map((task) => ({ kind: 'task' as const, task }))
    }
    const rows: Array<
      { kind: 'group'; label: string; count: number } | { kind: 'task'; task: Task }
    > = []
    for (const [groupName, groupTasks] of groupedTasks) {
      rows.push({ kind: 'group', label: groupName, count: groupTasks.length })
      for (const task of groupTasks) rows.push({ kind: 'task', task })
    }
    return rows
  }, [groupedTasks, filteredTasks])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAllFiltered = () => setSelectedIds(new Set(filteredTasks.map((t) => t.id)))
  const clearSelection = () => setSelectedIds(new Set())

  // Jumlah filter aktif (selain "Semua")
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedCategory !== 'Semua') count++
    if (selectedPhase !== 'Semua') count++
    if (selectedPriority !== 'Semua') count++
    if (selectedStatus !== 'Semua') count++
    if (selectedPic !== 'Semua') count++
    if (groupBy !== 'none') count++
    return count
  }, [selectedCategory, selectedPhase, selectedPriority, selectedStatus, selectedPic, groupBy])

  // --- Drag & drop (HTML5 native, tanpa dependency tambahan) ---
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, taskId: string) => {
    // Batalkan drag yang dimulai dari tombol/checkbox agar aksi tetap bisa diklik
    const origin = dragOriginRef.current
    if (origin && origin.closest('button, input, a, select, textarea')) {
      e.preventDefault()
      return
    }
    setDraggingId(taskId)
    setDragOverId(null)
    try {
      e.dataTransfer.effectAllowed = 'move'
      // Wajib di-set agar drag berjalan di Firefox
      e.dataTransfer.setData('text/plain', taskId)
    } catch {
      /* abaikan: browser tidak mendukung dataTransfer */
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, taskId: string) => {
    if (!canReorder || !draggingId || draggingId === taskId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(taskId)
  }

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetId: string) => {
    if (!canReorder) return
    e.preventDefault()
    e.stopPropagation()
    const sourceId = draggingId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '')
    setDraggingId(null)
    setDragOverId(null)
    if (!sourceId || sourceId === targetId) return

    // Hitung ulang urutan dari urutan yang SEDANG DITAMPILKAN (filteredTasks)
    const currentIds = filteredTasks.map((t) => t.id)
    const from = currentIds.indexOf(sourceId)
    const to = currentIds.indexOf(targetId)
    if (from === -1 || to === -1) return

    const nextIds = [...currentIds]
    nextIds.splice(from, 1)
    nextIds.splice(to, 0, sourceId)

    setManualOrder(nextIds)
    setSortBy('manual')
    onReorderTasks?.(nextIds)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverId(null)
    lastDragEndRef.current = Date.now()
  }

  // Cegah klik baris terpicu oleh aksi drag
  const handleRowClick = (task: Task) => {
    if (isRecentDrag(lastDragEndRef.current)) return
    onSelectTask(task)
  }

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

            {/* Density Toggle */}
            <button
              onClick={toggleDensity}
              className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
              title="Toggle kepadatan tampilan"
            >
              {density === 'compact' ? 'Rapat' : 'Nyaman'}
            </button>

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

        {/* Mobile: tombol buka/tutup blok filter */}
        <div className="md:hidden flex items-center justify-between gap-2">
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            aria-expanded={showFilters}
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
            {showFilters ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setSelectedCategory('Semua')
                setSelectedPhase('Semua')
                setSelectedPriority('Semua')
                setSelectedStatus('Semua')
                setSelectedPic('Semua')
                setGroupBy('none')
              }}
              className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* Sort - selalu terlihat (bukan bagian dari filter yang bisa dilipat) */}
        <div className="text-xs">
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
            Urutkan Berdasarkan
          </label>
          <div className="flex gap-1 max-w-xs">
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
              <option value="manual">Urutan Manual</option>
            </select>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              disabled={sortBy === 'manual'}
              className="p-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title={sortAsc ? 'Menaik (Asc)' : 'Menurun (Desc)'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Pills / Selectors - dapat dilipat di mobile, selalu terlihat di desktop */}
        <div
          className={`${showFilters ? 'grid' : 'hidden'} md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs`}
        >
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

          {/* Group By */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Kelompokkan
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
            >
              <option value="none">Tidak ada</option>
              <option value="category">Kategori</option>
              <option value="phase">Fase</option>
              <option value="priority">Prioritas</option>
              <option value="status">Status</option>
              <option value="pic">PIC</option>
            </select>
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

      {selectedIds.size > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-emerald-800">{selectedIds.size} tugas dipilih</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onBulkArchive?.(Array.from(selectedIds)); clearSelection() }}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50"
            >
              Arsipkan
            </button>
            <button
              onClick={() => { onBulkDelete?.(Array.from(selectedIds)); clearSelection() }}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
            >
              Pindah ke Sampah
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Saved Views */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
        <select
          value=""
          onChange={(e) => {
            const v = savedViews.find((x) => x.name === e.target.value)
            if (v) applyView(v)
          }}
          className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
        >
          <option value="">Pilih tampilan tersimpan...</option>
          {savedViews.map((v) => (
            <option key={v.name} value={v.name}>{v.name}</option>
          ))}
        </select>
        <input
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
          placeholder="Nama tampilan baru"
          className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
        />
        <button
          onClick={saveCurrentView}
          disabled={!viewName.trim()}
          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
        >
          Simpan Tampilan
        </button>
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
        isMobile ? (
          /* MOBILE CARD VIEW - menggantikan tabel agar tidak ada scroll horizontal */
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const pic = memberMap.get(task.pic_id)
              const alert = getDeadlineAlert(task.deadline, task.status)

              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  pic={pic}
                  alert={alert}
                  priorityClass={priorityBadge(task.priority)}
                  statusClass={statusBadge(task.status)}
                  selected={selectedIds.has(task.id)}
                  onToggleSelect={() => toggleSelect(task.id)}
                  onSelect={() => onSelectTask(task)}
                  onEdit={() => onEditTask(task)}
                  onArchive={() => onArchiveTask(task.id)}
                  onUnarchive={() => onUnarchiveTask(task.id)}
                  onDelete={() => onDeleteTask(task.id)}
                />
              )
            })}
          </div>
        ) : (
        /* TABLE VIEW */
        <div
          className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm ${
            density === 'compact' ? 'density-compact' : ''
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  {canReorder && (
                    <th className="py-3 px-1 w-8" title="Urutan manual">
                      <GripVertical className="w-3.5 h-3.5 text-slate-300 mx-auto" />
                    </th>
                  )}
                  <th className="py-3 px-2 w-8">
                     <input
                       type="checkbox"
                       checked={filteredTasks.length > 0 && filteredTasks.every((t) => selectedIds.has(t.id))}
                       onChange={(e) => (e.target.checked ? selectAllFiltered() : clearSelection())}
                       className="rounded"
                     />
                   </th>
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
                {tableRows.map((row) => {
                  if (row.kind === 'group') {
                    return (
                      <tr key={`grp-${row.label}`} className="bg-slate-100/80">
                        <td colSpan={9} className="py-2 px-4 text-xs font-bold uppercase text-slate-600 tracking-wider">
                          {row.label} ({row.count})
                        </td>
                      </tr>
                    )
                  }
                  const task = row.task
                  const pic = memberMap.get(task.pic_id)
                  const alert = getDeadlineAlert(task.deadline, task.status)

                  return (
                    <tr
                      key={task.id}
                      draggable={canReorder}
                      onMouseDown={(e) => {
                        dragOriginRef.current = e.target as HTMLElement
                      }}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragOver={(e) => handleDragOver(e, task.id)}
                      onDrop={(e) => handleDrop(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onDragLeave={() => setDragOverId((prev) => (prev === task.id ? null : prev))}
                      className={`hover:bg-slate-50/80 transition group cursor-pointer ${
                        draggingId === task.id ? 'opacity-40' : ''
                      } ${dragOverId === task.id ? 'bg-emerald-50' : ''}`}
                      onClick={() => handleRowClick(task)}
                    >
                      {canReorder && (
                        <td
                          className="py-3 px-1 w-8"
                          onClick={(e) => e.stopPropagation()}
                          title="Seret baris ini untuk mengurutkan ulang"
                        >
                          <span className="flex items-center justify-center text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing transition">
                            <GripVertical className="w-4 h-4" />
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-2 w-8" onClick={(e) => e.stopPropagation()}>
                         <input
                           type="checkbox"
                           checked={selectedIds.has(task.id)}
                           onChange={() => toggleSelect(task.id)}
                           className="rounded"
                         />
                       </td>
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
        )
      ) : (
        /* CARD / GRID VIEW */
        <div className="space-y-6">
          {(groupedTasks ?? [['', filteredTasks]]).map(([groupName, groupTasks]) => (
            <div key={groupName || 'all'}>
              {groupName && (
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
                  {groupName} ({groupTasks.length})
                </h3>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupTasks.map((task) => {
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
