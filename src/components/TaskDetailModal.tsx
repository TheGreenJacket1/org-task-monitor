import React, { useState } from 'react'
import {
  X,
  Edit2,
  Archive,
  Trash2,
  ExternalLink,
  Calendar,
  User,
  Clock,
  RotateCcw,
  CheckCircle2,
  FileCheck2,
  AlertTriangle,
  FolderArchive,
} from 'lucide-react'
import { Task, Member } from '../types'
import { formatIndonesianDate, formatIndonesianDateTime, getDeadlineAlert } from '../utils/date'

interface TaskDetailModalProps {
  isOpen: boolean
  task: Task | null
  members: Member[]
  onClose: () => void
  onEdit: (task: Task) => void
  onArchive: (taskId: string) => void
  onUnarchive: (taskId: string) => void
  onDelete: (taskId: string) => void
  onQuickStatusChange: (taskId: string, status: Task['status'], revisionNotes?: string) => void
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  task,
  members,
  onClose,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onQuickStatusChange,
}) => {
  const [showRevisionInput, setShowRevisionInput] = useState(false)
  const [quickRevisionNotes, setQuickRevisionNotes] = useState('')

  if (!isOpen || !task) return null

  const pic = members.find((m) => m.id === task.pic_id)
  const alert = getDeadlineAlert(task.deadline, task.status)

  const handleApplyRevision = () => {
    if (!quickRevisionNotes.trim()) return
    onQuickStatusChange(task.id, 'Revisi', quickRevisionNotes.trim())
    setShowRevisionInput(false)
    setQuickRevisionNotes('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
                {task.category}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {task.phase}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  task.priority === 'Mendesak'
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : task.priority === 'Tinggi'
                    ? 'bg-orange-100 text-orange-800 border border-orange-300'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {task.priority}
              </span>
              {task.is_archived && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700">
                  Diarsipkan
                </span>
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">{task.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Progress Bar & Status Badges */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Status: <strong className="text-slate-900">{task.status}</strong>
              </span>
              <span className="text-sm font-extrabold text-emerald-600">{task.progress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  task.status === 'Selesai'
                    ? 'bg-emerald-500'
                    : task.status === 'Revisi'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${task.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
              <span>Status Review: <strong className="text-slate-700">{task.review_status}</strong></span>
              {task.completed_at && (
                <span className="text-emerald-700 font-medium">
                  Selesai pada: {formatIndonesianDateTime(task.completed_at)}
                </span>
              )}
            </div>
          </div>

          {/* Revision Callout if applicable */}
          {(task.status === 'Revisi' || task.review_status === 'Perlu revisi') && task.revision_notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider mb-1">
                <RotateCcw className="w-4 h-4" />
                Catatan Revisi
              </div>
              <p className="text-sm text-amber-900 font-medium leading-relaxed">
                {task.revision_notes}
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Deskripsi
            </h4>
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
              {task.description || 'Tidak ada deskripsi rinci.'}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* PIC */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white shadow-sm"
                style={{ backgroundColor: pic?.avatar_color || '#16a34a' }}
              >
                {pic?.name.charAt(0) || 'P'}
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Penanggung Jawab (PIC)
                </span>
                <span className="font-bold text-slate-900">{pic?.name || 'Tidak ditentukan'}</span>
                <span className="text-slate-500 block">{pic?.role || '-'}</span>
              </div>
            </div>

            {/* Dates & Deadline */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Mulai:</span>
                <span className="font-semibold text-slate-800">
                  {formatIndonesianDate(task.start_date)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Deadline:</span>
                <span className="font-bold text-slate-900">
                  {formatIndonesianDate(task.deadline)}
                </span>
              </div>
              {alert && (
                <div className="pt-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${alert.badgeColor}`}
                  >
                    {alert.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Reference & Result Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reference Links */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Tautan Referensi / Brief ({task.reference_links?.length || 0})
              </h4>
              {task.reference_links && task.reference_links.length > 0 ? (
                <div className="space-y-1.5">
                  {task.reference_links.map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 p-2 rounded-lg border border-emerald-100 transition truncate"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{link}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Tidak ada tautan referensi.</p>
              )}
            </div>

            {/* Result Links */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Tautan Hasil Pekerjaan ({task.result_links?.length || 0})
              </h4>
              {task.result_links && task.result_links.length > 0 ? (
                <div className="space-y-1.5">
                  {task.result_links.map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 p-2 rounded-lg border border-blue-100 transition truncate"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{link}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Belum ada tautan hasil pekerjaan.</p>
              )}
            </div>
          </div>

          {/* Quick Status Action Controls */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              Aksi Cepat Status
            </span>

            {showRevisionInput ? (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={quickRevisionNotes}
                  onChange={(e) => setQuickRevisionNotes(e.target.value)}
                  placeholder="Ketik catatan revisi yang dibutuhkan..."
                  className="w-full text-xs p-2.5 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowRevisionInput(false)}
                    className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleApplyRevision}
                    disabled={!quickRevisionNotes.trim()}
                    className="px-3 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
                  >
                    Simpan Revisi
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {task.status !== 'Selesai' && (
                  <button
                    onClick={() => onQuickStatusChange(task.id, 'Selesai')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tandai Selesai (100%)
                  </button>
                )}

                {task.status !== 'Revisi' && (
                  <button
                    onClick={() => setShowRevisionInput(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Minta Revisi...
                  </button>
                )}

                {task.status === 'Belum dikerjakan' && (
                  <button
                    onClick={() => onQuickStatusChange(task.id, 'Dikerjakan')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Mulai Kerjakan
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Toolbar */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {task.is_archived ? (
              <button
                onClick={() => onUnarchive(task.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
              >
                <FolderArchive className="w-3.5 h-3.5 text-slate-600" />
                Buka Arsip
              </button>
            ) : (
              <button
                onClick={() => onArchive(task.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
              >
                <Archive className="w-3.5 h-3.5 text-slate-600" />
                Arsipkan
              </button>
            )}

            <button
              onClick={() => onDelete(task.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              Hapus
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
            >
              Tutup
            </button>
            <button
              onClick={() => onEdit(task)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Tugas Lengkap
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
