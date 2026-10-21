import React from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { Activity } from '../types'

interface ActivitySelectorProps {
  activities: Activity[]
  selectedActivityId: string
  taskCounts?: Record<string, number>
  onSelect: (activityId: string) => void
  onManage: () => void
}

export const ActivitySelector: React.FC<ActivitySelectorProps> = ({
  activities,
  selectedActivityId,
  taskCounts = {},
  onSelect,
  onManage,
}) => {
  const visible = activities.filter((a) => !a.is_archived && !a.deleted_at)
  const selected = visible.find((a) => a.id === selectedActivityId) || visible[0]

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center">
        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <select
          value={selected?.id || ''}
          onChange={(e) => {
            if (e.target.value === 'MANAGE') {
              onManage()
              e.target.value = selected?.id || ''
            } else if (e.target.value) {
              onSelect(e.target.value)
            }
          }}
          className="pl-9 pr-8 py-1.5 text-sm font-semibold bg-slate-100 hover:bg-slate-200 border-none rounded-lg text-slate-800 cursor-pointer focus:ring-2 focus:ring-emerald-500 transition max-w-[220px] sm:max-w-[280px] truncate"
          title="Pilih kegiatan yang ditampilkan"
        >
          {visible.length === 0 && <option value="">-- Belum ada kegiatan aktif --</option>}
          {visible.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({taskCounts[a.id] ?? 0} tugas){a.is_active ? ' • Aktif' : ''}
            </option>
          ))}
          <option value="MANAGE">Kelola kegiatan...</option>
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
      </div>
      <button
        onClick={onManage}
        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
        title="Kelola Kegiatan"
      >
        <Calendar className="w-4 h-4" />
      </button>
    </div>
  )
}