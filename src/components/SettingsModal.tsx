import React, { useState } from 'react'
import {
  X,
  Settings,
  Database,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
} from 'lucide-react'
import { SyncStatus } from '../types'
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  getSupabaseClient,
} from '../services/supabase'

interface SettingsModalProps {
  isOpen: boolean
  syncStatus: SyncStatus
  onClose: () => void
  onExportData: () => void
  onImportData: (file: File) => Promise<void>
  onLoadDemoData: () => void
  onClearDemoData: () => void
  onReloadData: () => Promise<void>
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  syncStatus,
  onClose,
  onExportData,
  onImportData,
  onLoadDemoData,
  onClearDemoData,
  onReloadData,
}) => {
  const currentConfig = getStoredSupabaseConfig()
  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig?.url || '')
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(currentConfig?.anonKey || '')
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  if (!isOpen) return null

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      saveSupabaseConfig(null)
      alert('Konfigurasi Supabase dihapus. Aplikasi beralih ke penyimpanan lokal.')
      await onReloadData()
      return
    }

    saveSupabaseConfig({
      url: supabaseUrl.trim(),
      anonKey: supabaseAnonKey.trim(),
    })

    setTestStatus('Konfigurasi disimpan. Menyinkronkan data...')
    await onReloadData()
    setTestStatus('Sinkronisasi selesai!')
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestStatus('Menguji koneksi ke Supabase...')

    try {
      const client = getSupabaseClient()
      if (!client) {
        throw new Error('Supabase client belum terkonfigurasi.')
      }

      const { data, error } = await client.from('organizations').select('id').limit(1)
      if (error) {
        throw error
      }

      setTestStatus('Koneksi BERHASIL! Supabase terhubung dan siap disinkronkan.')
    } catch (err: any) {
      setTestStatus(`Koneksi GAGAL: ${err.message || 'Periksa URL dan Anon Key Anda.'}`)
    } finally {
      setIsTesting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0])
    }
  }

  const executeImport = async () => {
    if (!importFile) return
    setIsImporting(true)
    try {
      await onImportData(importFile)
      setImportFile(null)
      alert('Data berhasil dipulihkan dari file cadangan!')
    } catch (err: any) {
      alert(`Gagal memulihkan data: ${err.message}`)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Pengaturan & Pencadangan Data</h3>
              <p className="text-xs text-slate-500">
                Operasional Biaya Rp0 (GitHub Pages + Supabase Free Tier)
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

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Supabase Free Configuration */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Konfigurasi Database Terpusat (Supabase)
                </h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  syncStatus.isConnected
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                {syncStatus.isConnected ? 'Terhubung' : 'Penyimpanan Lokal'}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Masukkan Project URL dan Anon Key dari dashboard proyek Supabase Free Anda.
              Biarkan kosong jika ingin menggunakan mode offline/lokal sepenuhnya di perangkat ini.
            </p>

            <form onSubmit={handleSaveConfig} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Project URL
                </label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzprojectid.supabase.co"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Anon / Public API Key (Bukan Service Role!)
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-mono"
                />
              </div>

              {testStatus && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-medium ${
                    testStatus.includes('BERHASIL')
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : testStatus.includes('GAGAL')
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  {testStatus}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !supabaseUrl}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                  Uji Koneksi
                </button>

                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition"
                >
                  Simpan & Sinkronkan
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Security & Rp0 Limits Notice */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Transparansi Keamanan & Batasan Operasional Rp0</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              <li>
                <strong>Model Tanpa Login:</strong> Aplikasi tidak menggunakan password. Akses database
                menggunakan public anon key. Jangan menyimpan data pribadi rahasia (PIN, kata sandi).
              </li>
              <li>
                <strong>Batas Supabase Free:</strong> Proyek gratis akan dijeda (paused) otomatis oleh
                Supabase jika tidak ada aktivitas selama 1 minggu berturut-turut.
              </li>
              <li>
                <strong>Pencadangan Wajib:</strong> Gunakan fitur ekspor JSON di bawah secara berkala
                agar data organisasi selalu aman dan dapat dipulihkan kapan saja secara gratis.
              </li>
            </ul>
          </div>

          {/* Section 3: Backup & Restore */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Pencadangan & Pemulihan Data Mandiri (JSON)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Export */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col justify-between">
                <div>
                  <h5 className="font-bold text-slate-900 text-xs">Ekspor Cadangan (Backup)</h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Unduh file JSON berisi seluruh organisasi, anggota, kegiatan, tugas, dan log aktivitas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onExportData}
                  className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh File Backup (.json)
                </button>
              </div>

              {/* Import */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col justify-between">
                <div>
                  <h5 className="font-bold text-slate-900 text-xs">Pulihkan Data (Restore)</h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Unggah file cadangan JSON untuk memulihkan seluruh riwayat kegiatan dan tugas.
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                  {importFile && (
                    <button
                      type="button"
                      onClick={executeImport}
                      disabled={isImporting}
                      className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {isImporting ? 'Memproses...' : 'Terapkan Pemulihan'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Demo Data Management */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Pengelolaan Data Demo
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Data demo ditandai dengan awalan <code>[DEMO]</code> dan dapat dihapus atau dimuat ulang kapan saja.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onLoadDemoData}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
              >
                Muat Ulang Demo
              </button>
              <button
                type="button"
                onClick={onClearDemoData}
                className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Data Demo
              </button>
            </div>
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
