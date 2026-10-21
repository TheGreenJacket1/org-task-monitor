import React, { useState } from 'react'
import { X, RotateCcw, Trash2, AlertTriangle } from 'lucide-react'
import { Task, Activity, Member, ActivityLog } from '../types'
import { formatIndonesianDateTime } from '../utils/date'

type TrashTab = 'tasks' | 'activities' | 'members' | 'logs'

interface TrashModalProps {
  isOpen: boolean
  onClose: () => void
  deletedTasks: Task[]
  deletedActivities: Activity[]
  deletedMembers: Member[]
  deletedLogs: ActivityLog[]
  members: Member[]
  activities: Activity[]
  onRestoreTask: (id: string) => void
  onRestoreActivity: (id: string) => void
  onRestoreMember: (id: string) => void
  onRestoreLog: (id: string) => void
  onPermanentDeleteTask: (id: string) => void
  onPermanentDeleteActivity: (id: string) => void
  onPermanentDeleteMember: (id: string) => void
  onPermanentDeleteLog: (id: string) => void
}

export const TrashModal: React.FC<TrashModalProps> = ({
  isOpen,
  onClose,
  deletedTasks,
  deletedActivities,
  deletedMembers,
  deletedLogs,
  members,
  activities,
  onRestoreTask,
  onRestoreActivity,
  onRestoreMember,
  onRestoreLog,
  onPermanentDeleteTask,
  onPermanentDeleteActivity,
  onPermanentDeleteMember,
  onPermanentDeleteLog,
}) => {
  const [tab, setTab] = useState<TrashTab>('tasks')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (!isOpen) return null

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? id
  const activityName = (id?: string) => (id ? activities.find((a) => a.id === id)?.name ?? id : '(organisasi)')

  const total =
    deletedTasks.length + deletedActivities.length + deletedMembers.length + deletedLogs.length

  const tabs: { key: TrashTab; label: string; count: number }[] = [
    { key: 'tasks', label: 'Tugas', count: deletedTasks.length },
    { key: 'activities', label: 'Kegiatan', count: deletedActivities.length },
    { key: 'members', label: 'Anggota', count: deletedMembers.length },
    { key: 'logs', label: 'Riwayat', count: deletedLogs.length },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-slate-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Tempat Sampah</h3>
              <p className="text-xs text-slate-500">{total} item terhapus. Pulihkan atau hapus permanen.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4 flex gap-2 border-b border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition ${
                tab === t.key ? 'border-red-500 text-red-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-2">
          {tab === 'tasks' && deletedTasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{t.title}</div>
                <div className="text-xs text-slate-500">
                  {t.category} • PIC: {memberName(t.pic_id)} • {activityName(t.activity_id)} • Dihapus {t.deleted_at ? formatIndonesianDateTime(t.deleted_at) : '-'}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => onRestoreTask(t.id)} className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" /> Pulihkan
                </button>
                <button onClick={() => setConfirmId(t.id)} className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Hapus permanen
                </button>
              </div>
              {confirmId === t.id && (
                <div className="w-full mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-2">
                  <span><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />Hapus permanen tidak dapat dibatalkan.</span>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmId(null)} className="px-2 py-1 bg-white border border-slate-300 rounded">Batal</button>
                    <button onClick={() => { onPermanentDeleteTask(t.id); setConfirmId(null) }} className="px-2 py-1 bg-red-600 text-white rounded">Hapus</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {tab === 'tasks' && deletedTasks.length === 0 && <div className="text-center py-8 text-slate-400 text-xs">Tidak ada tugas di tempat sampah.</div>}

          {tab === 'activities' && deletedActivities.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{a.name}</div>
                <div className="text-xs text-slate-500">Dihapus {a.deleted_at ? formatIndonesianDateTime(a.deleted_at) : '-'}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => onRestoreActivity(a.id)} className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" /> Pulihkan
                </button>
                <button onClick={() => setConfirmId(a.id)} className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Hapus permanen
                </button>
              </div>
              {confirmId === a.id && (
                <div className="w-full mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-2">
                  <span><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />Hapus permanen kegiatan + tugasnya. Tidak dapat dibatalkan.</span>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmId(null)} className="px-2 py-1 bg-white border border-slate-300 rounded">Batal</button>
                    <button onClick={() => { onPermanentDeleteActivity(a.id); setConfirmId(null) }} className="px-2 py-1 bg-red-600 text-white rounded">Hapus</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {tab === 'activities' && deletedActivities.length === 0 && <div className="text-center py-8 text-slate-400 text-xs">Tidak ada kegiatan di tempat sampah.</div>}

          {tab === 'members' && deletedMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{m.name}</div>
                <div className="text-xs text-slate-500">{m.role} • Dihapus {m.deleted_at ? formatIndonesianDateTime(m.deleted_at) : '-'}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => onRestoreMember(m.id)} className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" /> Pulihkan
                </button>
                <button onClick={() => setConfirmId(m.id)} className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Hapus permanen
                </button>
              </div>
              {confirmId === m.id && (
                <div className="w-full mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-2">
                  <span><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />Hapus permanen anggota. Diblokir jika masih menjadi PIC tugas.</span>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmId(null)} className="px-2 py-1 bg-white border border-slate-300 rounded">Batal</button>
                    <button onClick={() => { onPermanentDeleteMember(m.id); setConfirmId(null) }} className="px-2 py-1 bg-red-600 text-white rounded">Hapus</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {tab === 'members' && deletedMembers.length === 0 && <div className="text-center py-8 text-slate-400 text-xs">Tidak ada anggota di tempat sampah.</div>}

          {tab === 'logs' && deletedLogs.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{l.action}</div>
                <div className="text-xs text-slate-500 truncate">{l.details}</div>
                <div className="text-xs text-slate-400">Dihapus {l.deleted_at ? formatIndonesianDateTime(l.deleted_at) : '-'}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => onRestoreLog(l.id)} className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" /> Pulihkan
                </button>
                <button onClick={() => setConfirmId(l.id)} className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Hapus permanen
                </button>
              </div>
              {confirmId === l.id && (
                <div className="w-full mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-2">
                  <span><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />Hapus permanen log audit.</span>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmId(null)} className="px-2 py-1 bg-white border border-slate-300 rounded">Batal</button>
                    <button onClick={() => { onPermanentDeleteLog(l.id); setConfirmId(null) }} className="px-2 py-1 bg-red-600 text-white rounded">Hapus</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {tab === 'logs' && deletedLogs.length === 0 && <div className="text-center py-8 text-slate-400 text-xs">Tidak ada riwayat di tempat sampah.</div>}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}