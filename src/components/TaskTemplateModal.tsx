import React, { useEffect, useState } from 'react'
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Save,
  Copy,
  Layers,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import {
  Member,
  Task,
  TaskCategory,
  TaskPhase,
  TaskPriority,
  TaskTemplate,
} from '../types'
import { getJakartaTodayString } from '../utils/date'

export type TaskTemplateModalMode = 'manage' | 'pick'

/**
 * Payload yang dikirim ke handler onSave / storageService.saveTaskTemplate.
 */
export type TaskTemplateDraft = Omit<TaskTemplate, 'id' | 'created_at'> & { id?: string }

export interface TaskTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  members: Member[]
  templates: TaskTemplate[]
  /** 'manage' = kelola template, 'pick' = pilih template untuk dipakai. Default: 'manage' */
  mode?: TaskTemplateModalMode
  onSave: (template: TaskTemplateDraft) => void
  onDelete: (id: string) => void
  /** Dipanggil saat pengguna memilih template pada mode 'pick'. */
  onUse?: (template: TaskTemplate) => void
}

const CATEGORIES: TaskCategory[] = ['Desain', 'Publikasi', 'Dokumentasi', 'Administrasi', 'Lainnya']
const PHASES: TaskPhase[] = ['Pra-acara', 'Hari-H', 'Pasca-acara']
const PRIORITIES: TaskPriority[] = ['Rendah', 'Sedang', 'Tinggi', 'Mendesak']

interface TemplateFormState {
  name: string
  description: string
  category: TaskCategory
  phase: TaskPhase
  priority: TaskPriority
  default_pic_id: string
  default_duration_days: string
}

const EMPTY_FORM: TemplateFormState = {
  name: '',
  description: '',
  category: 'Desain',
  phase: 'Pra-acara',
  priority: 'Sedang',
  default_pic_id: '',
  default_duration_days: '7',
}

/**
 * Menambahkan sejumlah hari pada tanggal (format YYYY-MM-DD) dan mengembalikan
 * tanggal baru dalam format YYYY-MM-DD. Helper tanggal sederhana (tanpa
 * timezone-dependent Date parsing) agar hasil konsisten.
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dateStr || '') ? dateStr : getJakartaTodayString()
  const [year, month, day] = base.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + (Number(days) || 0)))
  return shifted.toISOString().slice(0, 10)
}

/**
 * Mengubah template menjadi nilai default form tugas.
 * Deadline dihitung dari start_date + default_duration_days.
 */
export function applyTemplateToTask(template: TaskTemplate, startDate: string): Partial<Task> {
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startDate || '') ? startDate : getJakartaTodayString()
  const duration = Math.max(0, Number(template.default_duration_days) || 0)

  return {
    title: template.name,
    description: template.description || '',
    category: template.category,
    phase: template.phase,
    priority: template.priority,
    pic_id: template.default_pic_id || '',
    start_date: start,
    deadline: addDaysToDate(start, duration),
  }
}

export const TaskTemplateModal: React.FC<TaskTemplateModalProps> = ({
  isOpen,
  onClose,
  members,
  templates,
  mode = 'manage',
  onSave,
  onDelete,
  onUse,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const activeMembers = members.filter((m) => m.is_active)
  const isPickMode = mode === 'pick'

  useEffect(() => {
    if (!isOpen) return
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }, [isOpen, mode])

  if (!isOpen) return null

  const getPicName = (picId?: string) => {
    if (!picId) return 'Tanpa PIC default'
    const member = members.find((m) => m.id === picId)
    return member ? member.name : 'PIC tidak ditemukan'
  }

  const handleEdit = (template: TaskTemplate) => {
    setEditingId(template.id)
    setForm({
      name: template.name,
      description: template.description || '',
      category: template.category,
      phase: template.phase,
      priority: template.priority,
      default_pic_id: template.default_pic_id || '',
      default_duration_days: String(template.default_duration_days ?? 0),
    })
    setFormError(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()

    const name = form.name.trim()
    if (!name) {
      setFormError('Nama template wajib diisi.')
      return
    }

    const days = Number(form.default_duration_days)
    if (Number.isNaN(days) || days < 0) {
      setFormError('Durasi default harus berupa angka nol atau lebih.')
      return
    }

    onSave({
      ...(editingId ? { id: editingId } : {}),
      name,
      description: form.description.trim(),
      category: form.category,
      phase: form.phase,
      priority: form.priority,
      ...(form.default_pic_id ? { default_pic_id: form.default_pic_id } : {}),
      default_duration_days: Math.round(days),
    })

    handleCancelEdit()
  }

  const handleDelete = (template: TaskTemplate) => {
    const confirmed = window.confirm(
      `Hapus template "${template.name}"? Template yang sudah dipakai tidak akan mengubah tugas yang ada.`
    )
    if (!confirmed) return

    onDelete(template.id)
    if (editingId === template.id) handleCancelEdit()
  }

  const handleUse = (template: TaskTemplate) => {
    if (onUse) onUse(template)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">
                {isPickMode ? 'Pilih Template Tugas' : 'Kelola Template Tugas'}
              </h3>
              <p className="text-xs text-slate-500">
                {isPickMode
                  ? 'Pilih template untuk mengisi form tugas secara otomatis.'
                  : 'Simpan pola tugas yang sering dipakai agar bisa dibuat dalam sekali klik.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup modal template tugas"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {isPickMode && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
              Deadline tugas akan dihitung otomatis dari Tanggal Mulai + durasi default template.
            </div>
          )}

          {/* Template List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Template Tersimpan ({templates.length})
              </h4>
              {!isPickMode && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setForm(EMPTY_FORM)
                    setFormError(null)
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Template Baru
                </button>
              )}
            </div>

            {templates.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Belum ada template.</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isPickMode
                    ? 'Tambahkan template terlebih dahulu melalui menu Kelola Template Tugas.'
                    : 'Buat template pertama Anda agar tugas rutin bisa dibuat lebih cepat.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-start justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {template.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {template.category}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {template.phase}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          {template.priority}
                        </span>
                      </div>

                      {template.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      )}

                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {template.default_duration_days ?? 0} hari
                        </span>
                        <span>PIC default: {getPicName(template.default_pic_id)}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isPickMode ? (
                        <button
                          type="button"
                          onClick={() => handleUse(template)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Gunakan
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(template)}
                            aria-label={`Edit template ${template.name}`}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(template)}
                            aria-label={`Hapus template ${template.name}`}
                            className="p-1.5 text-red-500 hover:text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Template Form (hanya pada mode kelola) */}
          {!isPickMode && (
            <form onSubmit={handleSave} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {editingId ? 'Edit Template' : 'Tambah Template'}
                </h4>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
                  >
                    Batal edit
                  </button>
                )}
              </div>

              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Nama Template <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: Desain Brosur Sponsor"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Deskripsi
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Rincian singkat langkah pengerjaan..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Kategori
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as TaskCategory })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Fase
                  </label>
                  <select
                    value={form.phase}
                    onChange={(e) => setForm({ ...form, phase: e.target.value as TaskPhase })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    {PHASES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Prioritas
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    PIC Default (opsional)
                  </label>
                  <select
                    value={form.default_pic_id}
                    onChange={(e) => setForm({ ...form, default_pic_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="">-- Tanpa PIC default --</option>
                    {activeMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Durasi Default (hari)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.default_duration_days}
                    onChange={(e) => setForm({ ...form, default_duration_days: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editingId ? 'Simpan Perubahan' : 'Simpan Template'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {templates.length} template tersimpan
          </div>
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
