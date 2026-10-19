import { Task, Activity, Member, Organization } from '../types'

export interface ValidationError {
  field: string
  message: string
}

export function isValidUrl(str: string): boolean {
  if (!str || !str.trim()) return false
  try {
    const url = new URL(str.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validates a task object before saving.
 */
export function validateTask(task: Partial<Task>): ValidationError[] {
  const errors: ValidationError[] = []

  // Title
  if (!task.title || task.title.trim().length < 3) {
    errors.push({ field: 'title', message: 'Judul tugas minimal harus 3 karakter.' })
  }

  // PIC
  if (!task.pic_id || !task.pic_id.trim()) {
    errors.push({ field: 'pic_id', message: 'Penanggung jawab (PIC) wajib dipilih dari anggota aktif.' })
  }

  // Dates
  if (!task.start_date) {
    errors.push({ field: 'start_date', message: 'Tanggal mulai wajib diisi.' })
  }
  if (!task.deadline) {
    errors.push({ field: 'deadline', message: 'Tanggal deadline wajib diisi.' })
  }
  if (task.start_date && task.deadline && task.deadline < task.start_date) {
    errors.push({ field: 'deadline', message: 'Tanggal deadline tidak boleh sebelum tanggal mulai.' })
  }

  // Progress
  if (task.progress === undefined || task.progress === null || isNaN(task.progress)) {
    errors.push({ field: 'progress', message: 'Progres harus berupa angka antara 0 hingga 100.' })
  } else if (task.progress < 0 || task.progress > 100) {
    errors.push({ field: 'progress', message: 'Progres harus bernilai 0% sampai 100%.' })
  }

  // Selesai status rules:
  // "Tugas berstatus Selesai harus memiliki progres 100% dan tanggal selesai."
  if (task.status === 'Selesai') {
    if (task.progress !== 100) {
      errors.push({ field: 'progress', message: 'Tugas dengan status Selesai harus memiliki progres 100%.' })
    }
    if (!task.completed_at) {
      errors.push({ field: 'completed_at', message: 'Tugas berstatus Selesai wajib memiliki tanggal selesai.' })
    }
  }

  // Revisi status rules:
  // "Perubahan status ke Revisi harus mendukung pencatatan catatan revisi."
  if (task.status === 'Revisi' || task.review_status === 'Perlu revisi') {
    if (!task.revision_notes || !task.revision_notes.trim()) {
      errors.push({
        field: 'revision_notes',
        message: 'Catatan revisi wajib diisi jika status tugas atau review adalah "Revisi" / "Perlu revisi".',
      })
    }
  }

  // URLs
  if (task.reference_links && task.reference_links.length > 0) {
    for (const link of task.reference_links) {
      if (link && link.trim() && !isValidUrl(link)) {
        errors.push({ field: 'reference_links', message: `Tautan referensi tidak valid: ${link}` })
      }
    }
  }

  if (task.result_links && task.result_links.length > 0) {
    for (const link of task.result_links) {
      if (link && link.trim() && !isValidUrl(link)) {
        errors.push({ field: 'result_links', message: `Tautan hasil tidak valid: ${link}` })
      }
    }
  }

  return errors
}

/**
 * Validates Activity
 */
export function validateActivity(activity: Partial<Activity>): ValidationError[] {
  const errors: ValidationError[] = []

  if (!activity.name || activity.name.trim().length < 3) {
    errors.push({ field: 'name', message: 'Nama kegiatan minimal 3 karakter.' })
  }

  if (!activity.start_date) {
    errors.push({ field: 'start_date', message: 'Tanggal mulai kegiatan wajib diisi.' })
  }

  if (!activity.end_date) {
    errors.push({ field: 'end_date', message: 'Tanggal selesai kegiatan wajib diisi.' })
  }

  if (activity.start_date && activity.end_date && activity.end_date < activity.start_date) {
    errors.push({ field: 'end_date', message: 'Tanggal selesai kegiatan tidak boleh sebelum tanggal mulai.' })
  }

  return errors
}

/**
 * Validates Member
 */
export function validateMember(member: Partial<Member>): ValidationError[] {
  const errors: ValidationError[] = []

  if (!member.name || member.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Nama anggota minimal 2 karakter.' })
  }

  if (!member.role || member.role.trim().length < 2) {
    errors.push({ field: 'role', message: 'Jabatan/peran anggota minimal 2 karakter.' })
  }

  return errors
}

/**
 * Validates Organization
 */
export function validateOrganization(org: Partial<Organization>): ValidationError[] {
  const errors: ValidationError[] = []

  if (!org.name || org.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Nama organisasi minimal 2 karakter.' })
  }

  if (!org.code || org.code.trim().length < 2) {
    errors.push({ field: 'code', message: 'Kode organisasi minimal 2 karakter.' })
  }

  return errors
}
