import React, { useState } from 'react'
import {
  X,
  UserPlus,
  Edit2,
  Trash2,
  Users,
  Phone,
  Mail,
} from 'lucide-react'
import { Member } from '../types'
import { validateMember, ValidationError } from '../utils/validation'

interface MemberManagementModalProps {
  isOpen: boolean
  organizationId: string
  activityId?: string
  members: Member[] // members of the selected activity
  allMembers: Member[] // all members of the organization
  onClose: () => void
  onCreateMember: (memberData: Omit<Member, 'id' | 'created_at'>) => Promise<void>
  onUpdateMember: (id: string, patch: Partial<Member>) => Promise<void>
  onDeleteMember: (id: string) => Promise<void>
  onAddMemberToActivity?: (memberId: string) => void
  onRemoveMemberFromActivity?: (memberId: string) => void
}

const AVATAR_COLORS = [
  '#16a34a', // emerald
  '#0284c7', // sky
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#0d9488', // teal
  '#e11d48', // rose
  '#475569', // slate
]

export const MemberManagementModal: React.FC<MemberManagementModalProps> = ({
  isOpen,
  organizationId,
  activityId,
  members,
  allMembers,
  onClose,
  onCreateMember,
  onUpdateMember,
  onDeleteMember,
  onAddMemberToActivity,
  onRemoveMemberFromActivity,
}) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [tab, setTab] = useState<'activity' | 'all'>('activity')
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const resetForm = () => {
    setName('')
    setRole('')
    setEmail('')
    setPhone('')
    setAvatarColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)])
    setIsActive(true)
    setEditingMember(null)
    setErrors([])
  }

  const handleStartEdit = (member: Member) => {
    setEditingMember(member)
    setName(member.name)
    setRole(member.role)
    setEmail(member.email || '')
    setPhone(member.phone || '')
    setAvatarColor(member.avatar_color || AVATAR_COLORS[0])
    setIsActive(member.is_active)
    setShowAddForm(true)
    setErrors([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!organizationId) {
      setErrors([
        {
          field: 'general',
          message: 'Buat atau pilih organisasi terlebih dahulu sebelum menambah anggota.',
        },
      ])
      return
    }

    const payload = {
      organization_id: organizationId,
      name: name.trim(),
      role: role.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      avatar_color: avatarColor,
      is_active: isActive,
    }

    const valErrors = validateMember(payload)
    if (valErrors.length > 0) {
      setErrors(valErrors)
      return
    }

    setErrors([])
    setIsSubmitting(true)

    try {
      if (editingMember) {
        await onUpdateMember(editingMember.id, payload)
      } else {
        await onCreateMember(payload)
      }
      resetForm()
      setShowAddForm(false)
    } catch (err: any) {
      setErrors([{ field: 'general', message: err.message || 'Gagal menyimpan anggota.' }])
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await onDeleteMember(id)
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus anggota.')
    }
  }

  const getFieldError = (field: string) => errors.find((e) => e.field === field)?.message

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="modal-sheet bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Kelola Anggota & Panitia</h3>
              <p className="text-xs text-slate-500">
                Daftar staf aktif yang dapat dipilih sebagai penanggung jawab (PIC) tugas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-11 w-11 md:h-auto md:w-auto md:p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition shrink-0"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="modal-sheet-body p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Action Row */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Anggota ({members.length})
            </span>
            <button
              onClick={() => {
                resetForm()
                setShowAddForm(!showAddForm)
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {showAddForm ? 'Tutup Formulir' : 'Tambah Anggota'}
            </button>
          </div>

          {/* Add / Edit Form */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {editingMember ? 'Edit Data Anggota' : 'Formulir Anggota Baru'}
              </h4>

              {errors.some((e) => e.field === 'general') && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
                  {getFieldError('general')}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Rian Pratama"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {getFieldError('name') && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{getFieldError('name')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Jabatan / Peran <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Contoh: Koordinator Desain / Staf Acara"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {getFieldError('role') && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{getFieldError('role')}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Email (Opsional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@organisasi.org"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Nomor WhatsApp/HP (Opsional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Avatar Color & Active Toggle */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Warna Avatar
                  </label>
                  <div className="flex gap-1.5">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition ${
                          avatarColor === c ? 'border-slate-900 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="memberActiveCheck"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <label htmlFor="memberActiveCheck" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Anggota Aktif
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setShowAddForm(false)
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : editingMember ? 'Simpan Perubahan' : 'Tambah Anggota'}
                </button>
              </div>
            </form>
          )}

          {/* Tab switcher */}
          <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
            <button
              onClick={() => setTab('activity')}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition ${tab === 'activity' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              Anggota Kegiatan Ini ({members.length})
            </button>
            <button
              onClick={() => setTab('all')}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition ${tab === 'all' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              Semua Anggota Organisasi ({allMembers.length})
            </button>
          </div>

          {/* Members List */}
          <div className="space-y-2">
            {(tab === 'activity' ? members : allMembers).length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl">
                Belum ada anggota. Tambahkan anggota untuk dapat menugaskan tugas.
              </div>
            ) : (
              (tab === 'activity' ? members : allMembers).map((member) => {
                const inActivity = members.some((m) => m.id === member.id)
                return (
                <div
                  key={member.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                    member.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: member.avatar_color || '#16a34a' }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {member.name}
                        </span>
                        {!member.is_active && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200 text-slate-600">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-medium block truncate">
                        {member.role}
                      </span>
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-400 mt-0.5">
                        {member.email && (
                          <span className="flex items-center gap-1 min-w-0 max-w-full">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </span>
                        )}
                        {member.phone && (
                          <span className="flex items-center gap-1 min-w-0 max-w-full">
                            <Phone className="w-3 h-3 shrink-0" />
                            <span className="truncate">{member.phone}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {activityId && onAddMemberToActivity && onRemoveMemberFromActivity && (
                      inActivity ? (
                        <button
                          onClick={() => onRemoveMemberFromActivity(member.id)}
                          className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                          title="Lepas dari kegiatan ini"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onAddMemberToActivity(member.id)}
                          className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="Tambahkan ke kegiatan ini"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                    <button
                      onClick={() => handleStartEdit(member)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                      title="Edit Anggota"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Hapus Anggota"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-sheet-footer px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
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
