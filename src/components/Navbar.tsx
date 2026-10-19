import React from 'react'
import {
  Building2,
  Calendar,
  Bell,
  Settings,
  Plus,
  Radio,
  CheckCircle2,
  AlertCircle,
  Database,
  RefreshCw,
} from 'lucide-react'
import { Organization, Activity, SyncStatus } from '../types'

interface NavbarProps {
  organizations: Organization[]
  currentOrg: Organization | null
  activeActivity: Activity | null
  syncStatus: SyncStatus
  notificationCount: number
  onSelectOrg: (id: string) => void
  onOpenOrgModal: () => void
  onOpenActivityModal: () => void
  onOpenNotifications: () => void
  onOpenSettings: () => void
  onOpenCreateTask: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  organizations,
  currentOrg,
  activeActivity,
  syncStatus,
  notificationCount,
  onSelectOrg,
  onOpenOrgModal,
  onOpenActivityModal,
  onOpenNotifications,
  onOpenSettings,
  onOpenCreateTask,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand & Organization Selector */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold text-slate-900 leading-tight">OrgTaskFlow</h1>
                <p className="text-xs text-slate-500 font-medium">Monitoring Tugas Organisasi</p>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden md:block" />

            {/* Organization Dropdown */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <select
                  value={currentOrg?.id || ''}
                  onChange={(e) => {
                    if (e.target.value === 'NEW') {
                      onOpenOrgModal()
                    } else {
                      onSelectOrg(e.target.value)
                    }
                  }}
                  className="pl-9 pr-8 py-1.5 text-sm font-semibold bg-slate-100 hover:bg-slate-200 border-none rounded-lg text-slate-800 cursor-pointer focus:ring-2 focus:ring-emerald-500 transition max-w-[180px] sm:max-w-[240px] truncate"
                  title="Pilih Organisasi"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.code})
                    </option>
                  ))}
                  <option value="NEW">+ Kelola / Buat Organisasi...</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Activity & Status Pills */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Active Activity Indicator */}
            <button
              onClick={onOpenActivityModal}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                activeActivity
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="Klik untuk mengelola kegiatan"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="truncate max-w-[200px]">
                {activeActivity ? activeActivity.name : 'Belum Ada Kegiatan Aktif'}
              </span>
              <span className="px-1.5 py-0.2 bg-white/60 rounded text-[10px] font-semibold">
                Kelola
              </span>
            </button>

            {/* Sync Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                syncStatus.mode === 'supabase' && syncStatus.isConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : syncStatus.isSyncing
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title={
                syncStatus.mode === 'supabase'
                  ? syncStatus.isConnected
                    ? 'Terhubung ke Supabase PostgreSQL & Realtime'
                    : 'Gagal terhubung ke Supabase, menggunakan data lokal'
                  : 'Menjalankan mode lokal/demo (Biaya Rp0)'
              }
            >
              {syncStatus.isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
              ) : syncStatus.mode === 'supabase' && syncStatus.isConnected ? (
                <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              ) : (
                <Database className="w-3 h-3 text-slate-500" />
              )}
              <span className="hidden lg:inline">
                {syncStatus.isSyncing
                  ? 'Sinkronisasi...'
                  : syncStatus.mode === 'supabase' && syncStatus.isConnected
                  ? 'Supabase Terhubung'
                  : 'Mode Lokal / Demo'}
              </span>
            </div>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Lihat Peringatan Deadline & Notifikasi"
            >
              <Bell className="w-5 h-5" />
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full border-2 border-white shadow-sm animate-pulse">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>

            {/* Settings & Backup */}
            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Pengaturan & Backup Data (Rp0)"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Primary Action: Tambah Tugas */}
            <button
              onClick={onOpenCreateTask}
              disabled={!activeActivity}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition ${
                activeActivity
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title={
                activeActivity
                  ? 'Buat Tugas Baru pada kegiatan aktif saat ini'
                  : 'Aktifkan kegiatan terlebih dahulu untuk menambah tugas'
              }
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tambah Tugas</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
