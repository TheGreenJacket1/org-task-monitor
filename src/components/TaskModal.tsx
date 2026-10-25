import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  AlertCircle,
  Link,
  Plus,
  Trash2,
  Calendar,
  User,
  CheckCircle2,
  Layers,
} from 'lucide-react'
import {
  Task,
  Member,
  TaskCategory,
  TaskPhase,
  TaskPriority,
  TaskStatus,
  TaskReviewStatus,
  TaskTemplate,
} from '../types'
import { validateTask, ValidationError } from '../utils/validation'
import { getJakartaTodayString } from '../utils/date'
import { storageService } from '../services/storage'
import {
  TaskTemplateModal,
  TaskTemplateDraft,
  applyTemplateToTask,
} from './TaskTemplateModal'

interface TaskModalProps {
  isOpen: boolean
  taskToEdit?: Task | null
  activityId: string
  organizationId: string
  members: Member[]
  onClose: () => void
  onSave: (taskData: Partial<Task>) => Promise<void>
}

const CATEGORIES: TaskCategory[] = ['Desain', 'Publikasi', 'Dokumentasi', 'Administrasi', 'Lainnya']
const PHASES: TaskPhase[] = ['Pra-acara', 'Hari-H', 'Pasca-acara']
const PRIORITIES: TaskPriority[] = ['Rendah', 'Sedang', 'Tinggi', 'Mendesak']
const STATUSES: TaskStatus[] = ['Belum dikerjakan', 'Dikerjakan', 'Revisi', 'Selesai']
const REVIEW_STATUSES: TaskReviewStatus[] = [
  'Belum diajukan',
  'Menunggu review',
  'Disetujui',
  'Perlu revisi',
]

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  taskToEdit,
  activityId,
  organizationId,
  members,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TaskCategory>('Desain')
  const [phase, setPhase] = useState<TaskPhase>('Pra-acara')
  const [priority, setPriority] = useState<TaskPriority>('Sedang')
  const [picId, setPicId] = useState('')
  const [startDate, setStartDate] = useState(getJakartaTodayString())
  const [deadline, setDeadline] = useState(getJakartaTodayString())
  const [status, setStatus] = useState<TaskStatus>('Belum dikerjakan')
  const [progress, setProgress] = useState(0)
  const [reviewStatus, setReviewStatus] = useState<TaskReviewStatus>('Belum diajukan')
  const [revisionNotes, setRevisionNotes] = useState('')
  const [referenceLinks, setReferenceLinks] = useState<string[]>([])
  const [resultLinks, setResultLinks] = useState<string[]>([])
  const [newRefLink, setNewRefLink] = useState('')
  const [newResLink, setNewResLink] = useState('')
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Task templates
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templateMode, setTemplateMode] = useState<'pick' | 'manage'>('pick')

  // Active members only for PIC selection
  const activeMembers = members.filter((m) => m.is_active)

  const loadTemplates = useCallback(() => {
    try {
      setTemplates(storageService.getTaskTemplates())
    } catch {
      setTemplates([])
    }
  }, [])

  useEffect(() => {
    if (isOpen) loadTemplates()
  }, [isOpen, loadTemplates])

  // Keep PIC selection valid when members are added/changed while the modal is open.
  useEffect(() => {
    if (!isOpen || taskToEdit) return
    if (!picId || !activeMembers.some((m) => m.id === picId)) {
      setPicId(activeMembers[0]?.id || '')
    }
  }, [isOpen, members, taskToEdit])

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title)
      setDescription(taskToEdit.description || '')
      setCategory(taskToEdit.category)
      setPhase(taskToEdit.phase)
      setPriority(taskToEdit.priority)
      setPicId(taskToEdit.pic_id)
      setStartDate(taskToEdit.start_date)
      setDeadline(taskToEdit.deadline)
      setStatus(taskToEdit.status)
      setProgress(taskToEdit.progress)
      setReviewStatus(taskToEdit.review_status)
      setRevisionNotes(taskToEdit.revision_notes || '')
      setReferenceLinks([...(taskToEdit.reference_links || [])])
      setResultLinks([...(taskToEdit.result_links || [])])
    } else {
      // Default initial form
      setTitle('')
      setDescription('')
      setCategory('Desain')
      setPhase('Pra-acara')
      setPriority('Sedang')
      setPicId(activeMembers[0]?.id || '')
      setStartDate(getJakartaTodayString())
      setDeadline(getJakartaTodayString())
      setStatus('Belum dikerjakan')
      setProgress(0)
      setReviewStatus('Belum diajukan')
      setRevisionNotes('')
      setReferenceLinks([])
      setResultLinks([])
    }
    setErrors([])
    setNewRefLink('')
    setNewResLink('')
  }, [taskToEdit, isOpen])

  if (!isOpen) return null

  // Auto handle status change rules
  const handleStatusChange = (newStatus: TaskStatus) => {
    setStatus(newStatus)
    if (newStatus === 'Selesai') {
      setProgress(100)
      setReviewStatus('Disetujui')
    } else if (status === 'Selesai') {
      if (progress === 100) {
        setProgress(80)
      }
    }
  }

  const handleReviewStatusChange = (newReview: TaskReviewStatus) => {
    setReviewStatus(newReview)
    if (newReview === 'Perlu revisi' && status !== 'Revisi') {
      setStatus('Revisi')
    }
  }

  const addReferenceLink = () => {
    if (!newRefLink.trim()) return
    setReferenceLinks([...referenceLinks, newRefLink.trim()])
    setNewRefLink('')
  }

  const removeReferenceLink = (index: number) => {
    setReferenceLinks(referenceLinks.filter((_, i) => i !== index))
  }

  const addResultLink = () => {
    if (!newResLink.trim()) return
    setResultLinks([...resultLinks, newResLink.trim()])
    setNewResLink('')
  }

  const removeResultLink = (index: number) => {
    setResultLinks(resultLinks.filter((_, i) => i !== index))
  }

  // --- Task templates ---
  const openTemplatePicker = () => {
    setTemplateMode('pick')
    setIsTemplateModalOpen(true)
  }

  const openTemplateManager = () => {
    setTemplateMode('manage')
    setIsTemplateModalOpen(true)
  }

  const handleUseTemplate = (template: TaskTemplate) => {
    const applied = applyTemplateToTask(template, startDate)

    setTitle((applied.title as string) || '')
    setDescription(applied.description || '')
    setCategory(applied.category || 'Desain')
    setPhase(applied.phase || 'Pra-acara')
    setPriority(applied.priority || 'Sedang')
    if (applied.pic_id) setPicId(applied.pic_id as string)
    if (applied.start_date) setStartDate(applied.start_date)
    if (applied.deadline) setDeadline(applied.deadline)
    setErrors([])
    setIsTemplateModalOpen(false)
  }

  const handleSaveTemplate = (template: TaskTemplateDraft) => {
    storageService.saveTaskTemplate(template)
    loadTemplates()
  }

  const handleDeleteTemplate = (id: string) => {
    storageService.deleteTaskTemplate(id)
    loadTemplates()
  }

  const quickTemplates = [...templates]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 5)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!organizationId) {
      setErrors([
        {
          field: 'general',
          message: 'Buat atau pilih organisasi terlebih dahulu sebelum menambah tugas.',
        },
      ])
      return
    }

    if (!taskToEdit && !activityId) {
      setErrors([
        {
          field: 'general',
          message: 'Buat atau aktifkan kegiatan terlebih dahulu sebelum menambah tugas.',
        },
      ])
      return
    }

    const taskPayload: Partial<Task> = {
      organization_id: organizationId,
      activity_id: taskToEdit ? taskToEdit.activity_id : activityId,
      title: title.trim(),
      description: description.trim(),
      category,
      phase,
      priority,
      pic_id: picId,
      start_date: startDate,
      deadline,
      status,
      progress: Number(progress),
      review_status: reviewStatus,
      revision_notes: revisionNotes.trim(),
      reference_links: referenceLinks,
      result_links: resultLinks,
      completed_at: status === 'Selesai' ? (taskToEdit?.completed_at || new Date().toISOString()) : null,
      is_archived: taskToEdit ? taskToEdit.is_archived : false,
    }

    const validationErrors = validateTask(taskPayload)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    setIsSubmitting(true)

    try {
      await onSave(taskPayload)
      onClose()
    } catch (err: any) {
      setErrors([{ field: 'general', message: err.message || 'Terjadi kesalahan saat menyimpan.' }])
    } finally {
      setIsSubmitting(false)
    }
  }

  const getFieldError = (field: string) => errors.find((e) => e.field === field)?.message

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {taskToEdit ? 'Edit Tugas' : 'Tambah Tugas Baru'}
            </h3>
            <p className="text-xs text-slate-500">
              Isi informasi tugas secara lengkap dan tentukan penanggung jawab.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* General Error Banner */}
          {errors.some((e) => e.field === 'general') && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{getFieldError('general')}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Judul Tugas <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Desain Brosur Sponsor & Pamflet"
              className={`w-full px-3.5 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none transition ${
                getFieldError('title') ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            {getFieldError('title') && (
              <p className="mt-1 text-xs text-red-600 font-medium">{getFieldError('title')}</p>
            )}

            {/* Template Shortcuts */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={openTemplatePicker}
                className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                Gunakan Template
              </button>

              <button
                type="button"
                onClick={openTemplateManager}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Kelola Template
              </button>

              {quickTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleUseTemplate(template)}
                  title={`Terapkan template: ${template.name}`}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:border-emerald-400 hover:text-emerald-700 transition max-w-[180px] truncate"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Deskripsi Tugas
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rincian instruksi pengerjaan, spesifikasi ukuran, materi konten, dll..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none transition resize-none"
            />
          </div>

          {/* 3-Column: Category, Phase, Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Fase Acara
              </label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as TaskPhase)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Prioritas
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* PIC & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* PIC */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Penanggung Jawab (PIC) <span className="text-red-500">*</span>
              </label>
              <select
                value={picId}
                onChange={(e) => setPicId(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                  getFieldError('pic_id') ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
                }`}
              >
                <option value="">-- Pilih PIC --</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
              {getFieldError('pic_id') && (
                <p className="mt-1 text-xs text-red-600 font-medium">{getFieldError('pic_id')}</p>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Tanggal Mulai <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Deadline <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                  getFieldError('deadline') ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
                }`}
              />
              {getFieldError('deadline') && (
                <p className="mt-1 text-xs text-red-600 font-medium">{getFieldError('deadline')}</p>
              )}
            </div>
          </div>

          {/* Status & Review Status & Progress */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Status */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Status Tugas
                </label>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Review Status */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Status Review
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => handleReviewStatusChange(e.target.value as TaskReviewStatus)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  {REVIEW_STATUSES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Progres ({progress}%)
                  </label>
                  {status === 'Selesai' && (
                    <span className="text-[10px] font-semibold text-emerald-600">Otomatis 100%</span>
                  )}
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progress}
                  disabled={status === 'Selesai'}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer disabled:opacity-60"
                />
                {getFieldError('progress') && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{getFieldError('progress')}</p>
                )}
              </div>
            </div>

            {/* Revision Notes (Shown or Highlighted if Status is Revisi / Perlu Revisi) */}
            {(status === 'Revisi' || reviewStatus === 'Perlu revisi') && (
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
                  Catatan Revisi <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="Jelaskan bagian mana yang perlu diperbaiki oleh penanggung jawab..."
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none transition resize-none ${
                    getFieldError('revision_notes')
                      ? 'border-red-500 bg-red-50/30'
                      : 'border-amber-300 bg-amber-50/30'
                  }`}
                />
                {getFieldError('revision_notes') && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {getFieldError('revision_notes')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Links Section (Reference Links & Result Links) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reference Links */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Tautan Referensi / Brief
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={newRefLink}
                  onChange={(e) => setNewRefLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addReferenceLink}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {referenceLinks.map((link, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-slate-100 px-2.5 py-1 rounded-md text-slate-700"
                  >
                    <span className="truncate max-w-[200px]">{link}</span>
                    <button
                      type="button"
                      onClick={() => removeReferenceLink(idx)}
                      className="text-slate-400 hover:text-red-600 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Result Links */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Tautan Hasil / Bukti Pekerjaan
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={newResLink}
                  onChange={(e) => setNewResLink(e.target.value)}
                  placeholder="https://figma.com/... atau google drive"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addResultLink}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {resultLinks.map((link, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-slate-100 px-2.5 py-1 rounded-md text-slate-700"
                  >
                    <span className="truncate max-w-[200px]">{link}</span>
                    <button
                      type="button"
                      onClick={() => removeResultLink(idx)}
                      className="text-slate-400 hover:text-red-600 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition flex items-center gap-2"
            >
              {isSubmitting ? 'Menyimpan...' : taskToEdit ? 'Simpan Perubahan' : 'Buat Tugas'}
            </button>
          </div>
        </form>
      </div>

      {/* Task Template Modal (pilih / kelola template) */}
      {createPortal(
        <TaskTemplateModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          members={members}
          templates={templates}
          mode={templateMode}
          onSave={handleSaveTemplate}
          onDelete={handleDeleteTemplate}
          onUse={handleUseTemplate}
        />,
        document.body
      )}
    </div>
  )
}
