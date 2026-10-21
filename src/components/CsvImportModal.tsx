import React, { useEffect, useMemo, useState } from 'react'
import {
  X,
  Upload,
  Download,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Table2,
  ListChecks,
} from 'lucide-react'
import {
  Activity,
  Member,
  Task,
  TaskCategory,
  TaskPhase,
  TaskPriority,
} from '../types'
import { storageService } from '../services/storage'
import { getJakartaTodayString } from '../utils/date'

export interface CsvImportResult {
  created: number
  failed: number
  errors: string[]
}

export interface CsvImportModalProps {
  isOpen: boolean
  onClose: () => void
  activities: Activity[]
  members: Member[]
  defaultActivityId: string
  defaultPicId: string
  organizationId: string
  onImported: (result: CsvImportResult) => void
}

export type CsvFieldKey =
  | 'title'
  | 'category'
  | 'phase'
  | 'priority'
  | 'pic'
  | 'deadline'
  | 'description'
  | 'start'

export const CSV_FIELD_LABELS: Record<CsvFieldKey, string> = {
  title: 'Judul / Nama',
  category: 'Kategori',
  phase: 'Fase',
  priority: 'Prioritas',
  pic: 'PIC',
  deadline: 'Deadline',
  description: 'Deskripsi',
  start: 'Mulai',
}

const CSV_FIELD_ORDER: CsvFieldKey[] = [
  'title',
  'category',
  'phase',
  'priority',
  'pic',
  'deadline',
  'description',
  'start',
]

/** Urutan kolom default bila file CSV tidak memiliki header yang dikenali. */
const DEFAULT_COLUMN_ORDER: CsvFieldKey[] = [
  'title',
  'category',
  'phase',
  'priority',
  'pic',
  'deadline',
  'description',
]

const CATEGORIES: TaskCategory[] = ['Desain', 'Publikasi', 'Dokumentasi', 'Administrasi', 'Lainnya']
const PHASES: TaskPhase[] = ['Pra-acara', 'Hari-H', 'Pasca-acara']
const PRIORITIES: TaskPriority[] = ['Rendah', 'Sedang', 'Tinggi', 'Mendesak']

const DEFAULT_CATEGORY: TaskCategory = 'Lainnya'
const DEFAULT_PHASE: TaskPhase = 'Pra-acara'
const DEFAULT_PRIORITY: TaskPriority = 'Sedang'

/** Sinonim nama kolom yang dikenali untuk auto-detect header. */
const HEADER_SYNONYMS: Record<CsvFieldKey, string[]> = {
  title: ['judul', 'nama', 'nama tugas', 'tugas', 'title', 'task', 'pekerjaan', 'nama pekerjaan'],
  category: ['kategori', 'category', 'jenis', 'jenis pekerjaan', 'kategori tugas'],
  phase: ['fase', 'phase', 'tahap', 'stage'],
  priority: ['prioritas', 'priority', 'urgensi'],
  pic: ['pic', 'penanggung jawab', 'penanggungjawab', 'penanggung jawab tugas', 'assignee', 'pic tugas'],
  deadline: ['deadline', 'tenggat', 'tenggat waktu', 'due date', 'due', 'batas akhir', 'tanggal deadline'],
  description: ['deskripsi', 'description', 'detail', 'rincian', 'keterangan', 'catatan'],
  start: ['mulai', 'start', 'tanggal mulai', 'start date', 'mulai kerja'],
}

function normalizeKey(value: string): string {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Menghitung kemunculan delimiter di luar tanda kutip pada satu baris.
 */
function countDelimiterOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') i++
        else inQuotes = false
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      count++
    }
  }
  return count
}

/**
 * Deteksi delimiter otomatis: koma, titik koma, atau tab.
 */
export function detectCsvDelimiter(text: string): string {
  const firstLine = (text || '').split(/\r\n|\r|\n/).find((l) => l.trim() !== '') || ''
  const candidates = [',', ';', '\t']
  let best = ','
  let bestCount = 0

  for (const candidate of candidates) {
    const count = countDelimiterOutsideQuotes(firstLine, candidate)
    if (count > bestCount) {
      bestCount = count
      best = candidate
    }
  }

  return best
}

/**
 * Parser CSV sederhana (tanpa dependency).
 * Mendukung tanda kutip, tanda kutip ganda yang di-escape (""), dan newline di dalam tanda kutip.
 */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const sep = delimiter || detectCsvDelimiter(text)
  const normalized = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]

    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === sep) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Buang baris yang seluruhnya kosong
  return rows.filter((r) => r.some((cell) => (cell || '').trim() !== ''))
}

/**
 * Normalisasi tanggal ke format YYYY-MM-DD.
 * Menerima YYYY-MM-DD (opsional dengan jam) dan DD/MM/YYYY (atau DD-MM-YYYY).
 * Mengembalikan null bila format tidak dikenali.
 */
export function normalizeCsvDate(value: string): string | null {
  const v = (value || '').trim()
  if (!v) return null

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const [, y, m, d] = iso
    return isValidYmd(Number(y), Number(m), Number(d)) ? `${y}-${m}-${d}` : null
  }

  const local = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
  if (local) {
    const day = Number(local[1])
    const month = Number(local[2])
    const year = local[3]
    if (!isValidYmd(Number(year), month, day)) return null
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return null
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return false
  const d = new Date(Date.UTC(year, month - 1, day))
  return (
    d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
  )
}

/**
 * Cocokkan nilai sel dengan salah satu opsi enum (case-insensitive, tolerant substring).
 */
function matchEnum<T extends string>(value: string, options: T[]): T | null {
  const v = normalizeKey(value)
  if (!v) return null

  const exact = options.find((o) => normalizeKey(o) === v)
  if (exact) return exact

  const partial = options.find((o) => {
    const opt = normalizeKey(o)
    return opt.length > 2 && v.includes(opt)
  })

  return partial || null
}

/**
 * Deteksi apakah baris pertama merupakan header yang dikenali.
 * Mengembalikan peta kolom bila header valid, null bila tidak.
 */
export function detectHeaderMapping(row: string[]): Record<CsvFieldKey, number> | null {
  if (!row || row.length === 0) return null

  let matches = 0
  const mapping: Record<CsvFieldKey, number> = {
    title: -1,
    category: -1,
    phase: -1,
    priority: -1,
    pic: -1,
    deadline: -1,
    description: -1,
    start: -1,
  }

  row.forEach((cell, index) => {
    const key = normalizeKey(cell)
    if (!key) return
    for (const field of CSV_FIELD_ORDER) {
      if (mapping[field] !== -1) continue
      if (HEADER_SYNONYMS[field].some((syn) => normalizeKey(syn) === key)) {
        mapping[field] = index
        matches++
        return
      }
    }
  })

  return matches >= 2 ? mapping : null
}

function buildHeaderLabels(row: string[], columnCount: number): string[] {
  const labels: string[] = []
  for (let i = 0; i < columnCount; i++) {
    const raw = (row[i] || '').trim()
    labels.push(raw || `Kolom ${i + 1}`)
  }
  return labels
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  activities,
  members,
  defaultActivityId,
  defaultPicId,
  organizationId,
  onImported,
}) => {
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [hasHeader, setHasHeader] = useState(false)
  const [mapping, setMapping] = useState<Record<CsvFieldKey, number>>({
    title: -1,
    category: -1,
    phase: -1,
    priority: -1,
    pic: -1,
    deadline: -1,
    description: -1,
    start: -1,
  })
  const [activityId, setActivityId] = useState(defaultActivityId)
  const [picId, setPicId] = useState(defaultPicId)
  const [warnings, setWarnings] = useState<string[]>([])
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const orgId = organizationId || storageService.getCurrentOrgId()
  const activeMembers = useMemo(() => members.filter((m) => m.is_active), [members])
  const usableActivities = useMemo(
    () => activities.filter((a) => !a.deleted_at),
    [activities]
  )

  useEffect(() => {
    if (!isOpen) return
    setFileName(null)
    setRows([])
    setHeaders([])
    setHasHeader(false)
    setMapping({
      title: -1,
      category: -1,
      phase: -1,
      priority: -1,
      pic: -1,
      deadline: -1,
      description: -1,
      start: -1,
    })
    setActivityId(defaultActivityId || '')
    setPicId(defaultPicId || '')
    setWarnings([])
    setImportResult(null)
    setFileError(null)
    setIsDragging(false)
  }, [isOpen, defaultActivityId, defaultPicId])

  if (!isOpen) return null

  const dataRows = hasHeader ? rows.slice(1) : rows
  const previewRows = dataRows.slice(0, 5)

  const getCell = (row: string[], field: CsvFieldKey): string => {
    const index = mapping[field]
    if (index < 0 || index >= row.length) return ''
    return (row[index] || '').trim()
  }

  const findMemberByName = (name: string): Member | undefined => {
    const key = normalizeKey(name)
    if (!key) return undefined
    return (
      activeMembers.find((m) => normalizeKey(m.name) === key) ||
      members.find((m) => normalizeKey(m.name) === key)
    )
  }

  /**
   * Membangun payload tugas dari baris CSV sekaligus mengumpulkan
   * validation errors dan warnings.
   */
  const buildItems = (): {
    items: Array<Partial<Task> & { title: string }>
    errors: string[]
    warnings: string[]
  } => {
    const errors: string[] = []
    const warnList: string[] = []
    const items: Array<Partial<Task> & { title: string }> = []

    const fallbackStart =
      (usableActivities.find((a) => a.id === activityId)?.start_date || '') || getJakartaTodayString()

    dataRows.forEach((row, index) => {
      const rowNumber = index + (hasHeader ? 2 : 1)
      const title = getCell(row, 'title')
      if (!title) {
        errors.push(`Baris ${rowNumber}: judul kosong, baris dilewati.`)
        return
      }

      // Kategori
      const rawCategory = getCell(row, 'category')
      let category: TaskCategory = DEFAULT_CATEGORY
      if (rawCategory) {
        const matched = matchEnum(rawCategory, CATEGORIES)
        if (matched) {
          category = matched
        } else {
          warnList.push(
            `Baris ${rowNumber}: kategori "${rawCategory}" tidak dikenal, memakai "${DEFAULT_CATEGORY}".`
          )
        }
      }

      // Fase
      const rawPhase = getCell(row, 'phase')
      let phase: TaskPhase = DEFAULT_PHASE
      if (rawPhase) {
        const matched = matchEnum(rawPhase, PHASES)
        if (matched) {
          phase = matched
        } else {
          warnList.push(
            `Baris ${rowNumber}: fase "${rawPhase}" tidak dikenal, memakai "${DEFAULT_PHASE}".`
          )
        }
      }

      // Prioritas
      const rawPriority = getCell(row, 'priority')
      let priority: TaskPriority = DEFAULT_PRIORITY
      if (rawPriority) {
        const matched = matchEnum(rawPriority, PRIORITIES)
        if (matched) {
          priority = matched
        } else {
          warnList.push(
            `Baris ${rowNumber}: prioritas "${rawPriority}" tidak dikenal, memakai "${DEFAULT_PRIORITY}".`
          )
        }
      }

      // Tanggal mulai
      const rawStart = getCell(row, 'start')
      let startDate = fallbackStart
      if (rawStart) {
        const parsedStart = normalizeCsvDate(rawStart)
        if (parsedStart) {
          startDate = parsedStart
        } else {
          warnList.push(
            `Baris ${rowNumber}: tanggal mulai "${rawStart}" tidak valid, memakai "${fallbackStart}".`
          )
        }
      }

      // Deadline
      const rawDeadline = getCell(row, 'deadline')
      let deadline = startDate
      if (rawDeadline) {
        const parsedDeadline = normalizeCsvDate(rawDeadline)
        if (!parsedDeadline) {
          errors.push(
            `Baris ${rowNumber}: deadline "${rawDeadline}" tidak valid (gunakan YYYY-MM-DD), baris dilewati.`
          )
          return
        }
        deadline = parsedDeadline
        if (deadline < startDate) {
          warnList.push(
            `Baris ${rowNumber}: deadline lebih awal dari tanggal mulai, tanggal mulai yang dipakai.`
          )
          deadline = startDate
        }
      } else {
        warnList.push(
          `Baris ${rowNumber}: deadline kosong, diisi sama dengan tanggal mulai (${startDate}).`
        )
      }

      // PIC
      const rawPic = getCell(row, 'pic')
      let resolvedPicId = picId
      if (rawPic) {
        const member = findMemberByName(rawPic)
        if (member) {
          resolvedPicId = member.id
        } else {
          warnList.push(
            `Baris ${rowNumber}: PIC "${rawPic}" tidak ditemukan, memakai PIC default${
              picId ? '' : ' (belum ada PIC default)'
            }.`
          )
        }
      }

      items.push({
        organization_id: orgId,
        activity_id: activityId,
        title,
        description: getCell(row, 'description'),
        category,
        phase,
        priority,
        pic_id: resolvedPicId,
        start_date: startDate,
        deadline,
        status: 'Belum dikerjakan',
        progress: 0,
        review_status: 'Belum diajukan',
        revision_notes: '',
        reference_links: [],
        result_links: [],
        is_archived: false,
      })
    })

    return { items, errors, warnings: warnList }
  }

  // Rencana impor live (berguna untuk menampilkan jumlah tugas yang valid)
  const importPlan = buildItems()

  const handleFile = async (file: File) => {
    setFileError(null)
    setImportResult(null)
    setWarnings([])

    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setFileError('Format file tidak didukung. Gunakan file berekstensi .csv.')
      return
    }

    try {
      const text = await file.text()
      const parsed = parseCsv(text)

      if (parsed.length === 0) {
        setFileError('File CSV kosong atau tidak dapat dibaca.')
        setRows([])
        setHeaders([])
        return
      }

      const firstRow = parsed[0]
      const detected = detectHeaderMapping(firstRow)
      const columnCountFirst = firstRow.length

      if (detected) {
        setHasHeader(true)
        setHeaders(buildHeaderLabels(firstRow, columnCountFirst))
        setMapping(detected)
      } else {
        setHasHeader(false)
        const labels: string[] = []
        for (let i = 0; i < columnCountFirst; i++) {
          labels.push(`Kolom ${i + 1}`)
        }
        setHeaders(labels)
        const positional: Record<CsvFieldKey, number> = {
          title: -1,
          category: -1,
          phase: -1,
          priority: -1,
          pic: -1,
          deadline: -1,
          description: -1,
          start: -1,
        }
        DEFAULT_COLUMN_ORDER.forEach((field, idx) => {
          if (idx < columnCountFirst) positional[field] = idx
        })
        setMapping(positional)
      }

      setRows(parsed)
      setFileName(file.name)
    } catch (err: any) {
      setFileError(`Gagal membaca file: ${err?.message || 'error tidak diketahui'}`)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    setFileError(null)

    if (!orgId) {
      setFileError('Organisasi belum dipilih. Pilih organisasi terlebih dahulu.')
      return
    }
    if (!activityId) {
      setFileError('Pilih kegiatan tujuan terlebih dahulu.')
      return
    }
    if (rows.length === 0) {
      setFileError('Belum ada file CSV yang dimuat.')
      return
    }

    const { items, errors, warnings: warnList } = buildItems()
    setWarnings(warnList)

    if (items.length === 0) {
      setFileError('Tidak ada baris valid untuk diimpor. Periksa pemetaan kolom dan format data.')
      setImportResult({ created: 0, failed: errors.length, errors })
      return
    }

    setIsImporting(true)
    try {
      const actorName =
        activeMembers.find((m) => m.id === picId)?.name ||
        activeMembers[0]?.name ||
        'Pengguna'

      const result = await storageService.bulkCreateTasks(items, actorName)

      const summary: CsvImportResult = {
        created: result.created,
        failed: result.failed + errors.length,
        errors: [...errors, ...result.errors],
      }

      setImportResult(summary)
      onImported(summary)
    } catch (err: any) {
      setFileError(`Gagal mengimpor tugas: ${err?.message || 'error tidak diketahui'}`)
    } finally {
      setIsImporting(false)
    }
  }

  const downloadSample = () => {
    const picName = activeMembers[0]?.name || 'Nama PIC'
    const header = 'judul,kategori,fase,prioritas,pic,deadline,deskripsi'
    const sample1 = `Desain Brosur Sponsor,Publikasi,Pra-acara,Tinggi,${picName},2026-11-15,Layout brosur A5 sponsor 4 halaman`
    const sample2 = `Dokumentasi After Event,Dokumentasi,Pasca-acara,Sedang,${picName},05/12/2026,Susun rekap dokumentasi dan arsip foto`
    const content = `\uFEFF${header}\n${sample1}\n${sample2}\n`

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'contoh-impor-tugas.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const totalRows = dataRows.length
  const validRows = importPlan.items.length
  const invalidRows = importPlan.errors.length

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">Impor Tugas dari CSV</h3>
              <p className="text-xs text-slate-500">
                Unggah daftar tugas sekaligus, atur pemetaan kolom, lalu impor dalam sekali klik.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup modal impor CSV"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {fileError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Upload Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 text-center transition ${
              isDragging
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-slate-300 bg-slate-50'
            }`}
          >
            <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">
              Tarik file <span className="text-emerald-700">.csv</span> ke sini atau pilih file
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Delimiter otomatis (koma, titik koma, tab). Format tanggal: YYYY-MM-DD atau DD/MM/YYYY.
            </p>

            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Pilih File CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Pilih file CSV untuk diimpor"
                />
              </label>

              <button
                type="button"
                onClick={downloadSample}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Contoh CSV
              </button>
            </div>

            {fileName && (
              <p className="mt-3 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 inline-block">
                {fileName} — {totalRows} baris data
              </p>
            )}
          </div>

          {/* Target import */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="csv-import-activity"
                className="block text-[11px] font-bold uppercase text-slate-600 mb-1"
              >
                Kegiatan Tujuan <span className="text-red-500">*</span>
              </label>
              <select
                id="csv-import-activity"
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white ${
                  activityId ? 'border-slate-300' : 'border-red-400 bg-red-50/40'
                }`}
              >
                <option value="">-- Pilih kegiatan --</option>
                {usableActivities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="csv-import-pic"
                className="block text-[11px] font-bold uppercase text-slate-600 mb-1"
              >
                PIC Default
              </label>
              <select
                id="csv-import-pic"
                value={picId}
                onChange={(e) => setPicId(e.target.value)}
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
          </div>

          {/* Preview */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Table2 className="w-4 h-4 text-slate-500" />
                  Preview Data
                </h4>
                <span className="text-[11px] text-slate-500">
                  Menampilkan {previewRows.length} dari {totalRows} baris
                  {hasHeader ? ' (dengan header)' : ' (tanpa header)'}
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="px-2.5 py-2 text-left font-bold text-slate-600 border-b border-slate-200">
                          #
                        </th>
                        {headers.map((h, i) => (
                          <th
                            key={i}
                            className="px-2.5 py-2 text-left font-bold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, r) => (
                        <tr key={r} className="border-b border-slate-100 last:border-0">
                          <td className="px-2.5 py-1.5 text-slate-400 font-semibold">
                            {r + (hasHeader ? 2 : 1)}
                          </td>
                          {headers.map((_, c) => (
                            <td
                              key={c}
                              className="px-2.5 py-1.5 text-slate-700 whitespace-nowrap max-w-[180px] truncate"
                            >
                              {row[c] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Mapping */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-slate-500" />
                Pemetaan Kolom
              </h4>
              <p className="text-[11px] text-slate-500">
                Pilih kolom CSV untuk setiap field tugas. Field yang tidak diimpor boleh dibiarkan.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CSV_FIELD_ORDER.map((field) => (
                  <div key={field}>
                    <label
                      htmlFor={`csv-map-${field}`}
                      className="block text-[11px] font-bold uppercase text-slate-600 mb-1"
                    >
                      {CSV_FIELD_LABELS[field]}
                      {field === 'title' && <span className="text-red-500"> *</span>}
                    </label>
                    <select
                      id={`csv-map-${field}`}
                      value={mapping[field]}
                      onChange={(e) =>
                        setMapping({ ...mapping, [field]: Number(e.target.value) })
                      }
                      className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white ${
                        field === 'title' && mapping.title < 0
                          ? 'border-red-400 bg-red-50/40'
                          : 'border-slate-300'
                      }`}
                    >
                      <option value={-1}>-- Tidak diimpor --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Peringatan ({warnings.length})
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-900 max-h-32 overflow-y-auto">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Result */}
          {importResult && (
            <div
              className={`p-3 border rounded-xl ${
                importResult.failed > 0
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    importResult.failed > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                />
                <span className="text-xs font-bold text-slate-800">Hasil Impor</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {importResult.created} berhasil
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                  {importResult.failed} gagal
                </span>
              </div>

              {importResult.errors.length > 0 && (
                <ul className="list-disc pl-5 mt-2 space-y-0.5 text-[11px] text-red-700 max-h-40 overflow-y-auto">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] text-slate-500">
            {rows.length > 0
              ? `${totalRows} baris terbaca · ${validRows} valid${
                  invalidRows > 0 ? ` · ${invalidRows} baris dilewati` : ''
                }`
              : 'Belum ada file CSV dimuat.'}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
            >
              {importResult ? 'Tutup' : 'Batal'}
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || rows.length === 0 || !activityId || validRows === 0}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mengimpor...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Impor {validRows} Tugas
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
