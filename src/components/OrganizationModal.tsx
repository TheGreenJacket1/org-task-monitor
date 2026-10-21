import React, { useEffect, useState } from 'react'
import {
  X,
  Building2,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react'
import { Organization } from '../types'
import { validateOrganization, ValidationError } from '../utils/validation'

interface OrganizationModalProps {
  isOpen: boolean
  organizations: Organization[]
  currentOrgId: string
  onClose: () => void
  onSelectOrg: (id: string) => void
  onCreateOrg: (orgData: Omit<Organization, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onUpdateOrg: (id: string, patch: Partial<Organization>) => Promise<void>
  onDeleteOrg: (id: string) => Promise<void>
}

export const OrganizationModal: React.FC<OrganizationModalProps> = ({
  isOpen,
  organizations,
  currentOrgId,
  onClose,
  onSelectOrg,
  onCreateOrg,
  onUpdateOrg,
  onDeleteOrg,
}) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // With zero organizations the main task is creating the first one, so show
  // the form immediately instead of hiding it behind another click.
  useEffect(() => {
    if (isOpen && organizations.length === 0) {
      setShowAddForm(true)
    }
  }, [isOpen, organizations.length])

  if (!isOpen) return null

  const resetForm = () => {
    setName('')
    setCode('')
    setDescription('')
    setEditingOrg(null)
    setErrors([])
  }

  const handleStartEdit = (org: Organization) => {
    setEditingOrg(org)
    setName(org.name)
    setCode(org.code)
    setDescription(org.description || '')
    setShowAddForm(true)
    setErrors([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
    }

    const valErrors = validateOrganization(payload)
    if (valErrors.length > 0) {
      setErrors(valErrors)
      return
    }

    // Check duplicate code
    const isCodeTaken = organizations.some(
      (o) => o.code.toUpperCase() === payload.code && o.id !== editingOrg?.id
    )
    if (isCodeTaken) {
      setErrors([{ field: 'code', message: 'Kode organisasi sudah digunakan.' }])
      return
    }

    setErrors([])
    setIsSubmitting(true)

    try {
      if (editingOrg) {
        await onUpdateOrg(editingOrg.id, payload)
      } else {
        await onCreateOrg(payload)
      }
      resetForm()
      setShowAddForm(false)
    } catch (err: any) {
      setErrors([{ field: 'general', message: err.message || 'Gagal menyimpan organisasi.' }])
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (org: Organization) => {
    if (
      confirm(
        `Apakah Anda yakin ingin menghapus organisasi "${org.name}"? Semua kegiatan dan tugas terkait akan ikut terhapus.`
      )
    ) {
      await onDeleteOrg(org.id)
    }
  }

  const getFieldError = (field: string) => errors.find((e) => e.field === field)?.message

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="modal-sheet bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Kelola Organisasi</h3>
              <p className="text-xs text-slate-500">
                Pindah ruang kerja, ubah nama, atau tambahkan organisasi baru.
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
          {/* Security & Access Disclosure Callout */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Informasi Akses:</strong> Aplikasi berjalan tanpa login pengguna dengan model
              operasional gratis (Rp0). Kode organisasi berfungsi sebagai pemisah antarmuka bagi
              panitia dan bukan sebagai batas keamanan kriptografis.
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Daftar Organisasi ({organizations.length})
            </span>
            <button
              onClick={() => {
                resetForm()
                setShowAddForm(!showAddForm)
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAddForm ? 'Tutup Formulir' : 'Buat Organisasi Baru'}
            </button>
          </div>

          {/* Add / Edit Form */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {editingOrg ? 'Edit Data Organisasi' : 'Formulir Organisasi Baru'}
              </h4>

              {errors.some((e) => e.field === 'general') && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
                  {getFieldError('general')}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Nama Organisasi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: BEM Universitas Indonesia"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {getFieldError('name') && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{getFieldError('name')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Kode Singkat <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="BEM-UI"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase"
                  />
                  {getFieldError('code') && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{getFieldError('code')}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Deskripsi Singkat
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deskripsi singkat struktur atau ruang lingkup organisasi..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                />
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
                  {isSubmitting ? 'Menyimpan...' : editingOrg ? 'Simpan Perubahan' : 'Buat Organisasi'}
                </button>
              </div>
            </form>
          )}

          {/* Org List */}
          <div className="space-y-2">
            {organizations.map((org) => {
              const isSelected = org.id === currentOrgId

              return (
                <div
                  key={org.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                    isSelected ? 'bg-emerald-50/50 border-emerald-400 shadow-sm' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {org.code.slice(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {org.name}
                        </span>
                        {isSelected && (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Aktif Dipilih
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-medium block">
                        Kode: <strong>{org.code}</strong> {org.description && `• ${org.description}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isSelected && (
                      <button
                        onClick={() => {
                          onSelectOrg(org.id)
                          onClose()
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-emerald-600 hover:text-white rounded-lg transition"
                      >
                        Pilih
                      </button>
                    )}
                    <button
                      onClick={() => handleStartEdit(org)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                      title="Edit Organisasi"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {organizations.length > 1 && (
                      <button
                        onClick={() => handleDelete(org)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Hapus Organisasi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
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
