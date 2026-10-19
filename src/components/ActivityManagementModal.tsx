import React, { useState } from 'react'
import {
  X,
  Plus,
  Calendar,
  CheckCircle2,
  Archive,
  FolderArchive,
  AlertCircle,
  Clock,
  Radio,
} from 'lucide-react'
import { Activity } from '../types'
import { formatIndonesianDate } from '../utils/date'
import { validateActivity, ValidationError } from '../utils/validation'

interface ActivityManagementModalProps {
  isOpen: boolean
  organizationId: string
  activities: Activity[]
  onClose: () => void
  onCreateActivity: (activityData: Omit<Activity, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onSetActiveActivity: (activityId: string) => Promise<void>
  onArchiveActivity: (activityId: string) => Promise<void>
  onUnarchiveActivity: (activityId: string) => Promise<void>
}

export const ActivityManagementModal: React.FC<ActivityManagementModalProps> = ({
  isOpen,
  organizationId,
  activities,
  onClose,
  onCreateActivity,
  onSetActiveActivity,
  onArchiveActivity,
  onUnarchiveActivity,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      organization_id: organizationId,
      name: name.trim(),
      description: description.trim(),
      start_date: startDate,
      end_date: endDate,
      is_active: isActive,
      is_archived: false,
    }

    const valErrors = validateActivity(payload)
    if (valErrors.length > 0) {
      setErrors(valErrors)
      return
    }

    setErrors([])
    setIsSubmitting(true)

    try {
      await onCreateActivity(payload)
      setShowCreateForm(false)
      setName('')
      setDescription('')
      setStartDate('')
      setEndDate('')
      setIsActive(true)
    } catch (err: any) {
      setErrors([{ field: 'general', message: err.message || 'Gagal menyimpan kegiatan.' }])
    } finally {
      setIsSubmitting(false)
    }
  }

  const getFieldError = (field: string) => errors.find((e) => e.field === field)?.message

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Kelola Kegiatan Organisasi</h3>
              <p className="text-xs text-slate-500">
                Hanya 1 kegiatan aktif pada satu waktu. Kegiatan lama dapat diarsipkan tanpa kehilangan data.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Daftar Kegiatan ({activities.length})
            </span>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {showCreateForm ? 'Tutup Formulir' : 'Buat Kegiatan Baru'}
            </button>
          </div>

          {/* Create Form Drawer */}
          {showCreateForm && (
            <form onSubmit={handleCreateSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Formulir Kegiatan Baru
              </h4>

              {errors.some((e) => e.field === 'general') && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
                  {getFieldError('general')}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Nama Kegiatan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Dies Natalis & Seminar Nasional 2026"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                {getFieldError('name') && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{getFieldError('name')}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Deskripsi Kegiatan
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ringkasan tujuan atau tema kegiatan..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Tanggal Mulai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {getFieldError('start_date') && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{getFieldError('start_date')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Tanggal Selesai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {getFieldError('end_date') && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{getFieldError('end_date')}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <label htmlFor="isActiveCheck" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Langsung jadikan sebagai kegiatan aktif saat ini
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Kegiatan'}
                </button>
              </div>
            </form>
          )}

          {/* Activity Cards List */}
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl">
                Belum ada kegiatan yang dibuat. Silakan klik tombol "Buat Kegiatan Baru".
              </div>
            ) : (
              activities.map((act) => (
                <div
                  key={act.id}
                  className={`p-4 rounded-xl border transition ${
                    act.is_active
                      ? 'border-emerald-400 bg-emerald-50/40 shadow-sm'
                      : act.is_archived
                      ? 'border-slate-200 bg-slate-50/70 opacity-80'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {act.is_active && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shadow-xs">
                            <Radio className="w-3 h-3 animate-pulse" />
                            Aktif
                          </span>
                        )}
                        {act.is_archived && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            Diarsipkan
                          </span>
                        )}
                        {!act.is_active && !act.is_archived && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                            Tidak Aktif
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{act.name}</h4>
                      {act.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{act.description}</p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                        <span>Mulai: {formatIndonesianDate(act.start_date)}</span>
                        <span>•</span>
                        <span>Target: {formatIndonesianDate(act.end_date)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                      {!act.is_active && !act.is_archived && (
                        <button
                          onClick={() => onSetActiveActivity(act.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition"
                          title="Jadikan kegiatan ini sebagai kegiatan aktif organisasi"
                        >
                          Jadikan Aktif
                        </button>
                      )}

                      {act.is_archived ? (
                        <button
                          onClick={() => onUnarchiveActivity(act.id)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition flex items-center gap-1"
                        >
                          <FolderArchive className="w-3.5 h-3.5" />
                          Buka Arsip
                        </button>
                      ) : (
                        !act.is_active && (
                          <button
                            onClick={() => onArchiveActivity(act.id)}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition flex items-center gap-1"
                            title="Arsipkan kegiatan ini"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            Arsipkan
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
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
