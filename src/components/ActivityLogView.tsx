import React from 'react'
import { History, Clock, User, CheckCircle2, AlertCircle, Edit, Plus } from 'lucide-react'
import { ActivityLog } from '../types'
import { formatIndonesianDateTime } from '../utils/date'

interface ActivityLogViewProps {
  logs: ActivityLog[]
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ logs }) => {
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
        <span className="text-xs text-slate-400 font-semibold">{logs.length} catatan aktivitas</span>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 rounded-xl">
          Belum ada riwayat aktivitas yang tercatat.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {logs.map((log) => (
            <div key={log.id} className="py-3.5 flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
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

              <div className="text-right shrink-0 text-[11px] text-slate-400 font-medium">
                {formatIndonesianDateTime(log.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
