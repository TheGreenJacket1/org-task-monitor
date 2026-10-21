import React, { useState, useMemo } from 'react'
import { History, User, Archive, Trash2, RotateCcw } from 'lucide-react'
import { ActivityLog } from '../types'
import { formatIndonesianDateTime } from '../utils/date'

interface ActivityLogViewProps {
  logs: ActivityLog[]
  onArchiveLog?: (id: string) => void
  onUnarchiveLog?: (id: string) => void
  onDeleteLog?: (id: string) => void
  onPermanentDeleteLog?: (id: string) => void
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ logs, onArchiveLog, onUnarchiveLog, onDeleteLog, onPermanentDeleteLog }) => {
  const [limit, setLimit] = useState(50)
  const [showArchived, setShowArchived] = useState(false)
  const [showTrash, setShowTrash] = useState(false)

  const filtered = useMemo(() => {
    let l = logs
    if (showTrash) l = l.filter((x) => x.deleted_at)
    else l = l.filter((x) => !x.deleted_at)
    if (!showArchived && !showTrash) l = l.filter((x) => !x.is_archived)
    return l.slice(0, limit)
  }, [logs, limit, showArchived, showTrash])
  const getActionBadge = (action: string) => {
    if (action.includes('SELESAI') || action.includes('AKTIF')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300'
    }
    if (action.includes('REVISI')) {
      return 'bg-amber-100 text-amber-800 border-amber-300'
    }
    if (action.includes('ARSIP')) {
      return 'bg-purple-100 text-purple-800 border-purple-300'
    }
    if (action.includes('HAPUS')) {
      return 'bg-red-100 text-red-800 border-red-300'
    }
    return 'bg-blue-100 text-blue-800 border-blue-200'
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Riwayat Perubahan & Audit Trail</h3>
            <p className="text-xs text-slate-500">
              Seluruh riwayat aksi pada kegiatan dan tugas disimpan tanpa penghapusan otomatis.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
          >
            <option value={10}>10 terbaru</option>
            <option value={50}>50 terbaru</option>
            <option value={100}>100 terbaru</option>
            <option value={10000}>Semua</option>
          </select>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${showArchived ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
          >
            {showArchived ? 'Sembunyikan arsip' : 'Tampilkan arsip'}
          </button>
          <button
            onClick={() => setShowTrash(!showTrash)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${showTrash ? 'bg-red-100 text-red-800 border-red-300' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
          >
            {showTrash ? 'Sembunyikan sampah' : 'Tempat sampah'}
          </button>
          <span className="text-xs text-slate-400 font-semibold">{filtered.length} / {logs.length}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 rounded-xl">
          Belum ada riwayat aktivitas yang tercatat.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map((log) => (
            <div key={log.id} className="py-3.5 flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadge(
                      log.action
                    )}`}
                  >
                    {log.action}
                  </span>
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    {log.actor_name}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{log.details}</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <div className="text-right text-[11px] text-slate-400 font-medium mr-1">
                  {formatIndonesianDateTime(log.created_at)}
                </div>
                {!log.deleted_at && onArchiveLog && !log.is_archived && (
                  <button
                    onClick={() => onArchiveLog(log.id)}
                    className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition"
                    title="Arsipkan"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                )}
                {!log.deleted_at && onUnarchiveLog && log.is_archived && (
                  <button
                    onClick={() => onUnarchiveLog(log.id)}
                    className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                    title="Buka arsip"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                {!log.deleted_at && onDeleteLog && (
                  <button
                    onClick={() => onDeleteLog(log.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Pindah ke tempat sampah"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {log.deleted_at && onPermanentDeleteLog && (
                  <button
                    onClick={() => onPermanentDeleteLog(log.id)}
                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                    title="Hapus permanen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
