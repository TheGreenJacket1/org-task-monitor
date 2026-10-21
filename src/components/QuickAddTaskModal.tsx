import React, { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { Task, Member, TaskCategory, TaskPhase, TaskPriority } from '../types'
import { getJakartaTodayString } from '../utils/date'

interface QuickAddTaskModalProps {
  isOpen: boolean
  activityId: string
  organizationId: string
  members: Member[]
  onClose: () => void
  onSave: (taskData: Partial<Task>) => Promise<void>
}

export const QuickAddTaskModal: React.FC<QuickAddTaskModalProps> = ({
  isOpen,
  activityId,
  organizationId,
  members,
  onClose,
  onSave,
}) => {
  const activeMembers = members.filter((m) => m.is_active)
  const [title, setTitle] = useState('')
  const [picId, setPicId] = useState(activeMembers[0]?.id || '')
  const [deadline, setDeadline] = useState(getJakartaTodayString())
  const [priority, setPriority] = useState<TaskPriority>('Sedang')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setPicId(activeMembers[0]?.id || '')
      setDeadline(getJakartaTodayString())
      setPriority('Sedang')
    }
  }, [isOpen])

  if (!isOpen) return null

  const submit = async (keepOpen: boolean) => {
    if (!title.trim() || !activityId) return
    setIsSubmitting(true)
    try {
      await onSave({
        organization_id: organizationId,
        activity_id: activityId,
        title: title.trim(),
        description: '',
        category: 'Lainnya' as TaskCategory,
        phase: 'Pra-acara' as TaskPhase,
        priority,
        pic_id: picId || activeMembers[0]?.id || '',
        start_date: getJakartaTodayString(),
        deadline,
        status: 'Belum dikerjakan',
        progress: 0,
        review_status: 'Belum diajukan',
        reference_links: [],
        result_links: [],
        is_archived: false,
      })
      if (keepOpen) {
        setTitle('')
        setDeadline(getJakartaTodayString())
      } else {
        onClose()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Quick Add Tugas</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Judul Tugas</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(true) } }}
              placeholder="Judul tugas..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">PIC</label>
              <select
                value={picId}
                onChange={(e) => setPicId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Prioritas</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="Rendah">Rendah</option>
              <option value="Sedang">Sedang</option>
              <option value="Tinggi">Tinggi</option>
              <option value="Mendesak">Mendesak</option>
            </select>
          </div>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={() => submit(false)}
            disabled={isSubmitting || !title.trim()}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
          >
            Simpan & tutup
          </button>
          <button
            onClick={() => submit(true)}
            disabled={isSubmitting || !title.trim()}
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Simpan & tambah lagi
          </button>
        </div>
      </div>
    </div>
  )
}