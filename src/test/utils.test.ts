import { describe, it, expect } from 'vitest'
import {
  calculateDaysDiffJakarta,
  getDeadlineAlert,
  formatIndonesianDate,
  getJakartaTodayString,
} from '../utils/date'
import {
  validateTask,
  validateActivity,
  validateMember,
  isValidUrl,
} from '../utils/validation'
import { Task } from '../types'

describe('Date & Deadline Alerts (Asia/Jakarta)', () => {
  it('correctly calculates day differences against reference date', () => {
    const today = '2026-10-19'
    expect(calculateDaysDiffJakarta('2026-10-19', today)).toBe(0)
    expect(calculateDaysDiffJakarta('2026-10-20', today)).toBe(1)
    expect(calculateDaysDiffJakarta('2026-10-22', today)).toBe(3)
    expect(calculateDaysDiffJakarta('2026-10-26', today)).toBe(7)
    expect(calculateDaysDiffJakarta('2026-10-18', today)).toBe(-1)
    expect(calculateDaysDiffJakarta('2026-10-15', today)).toBe(-4)
  })

  it('generates correct alerts for H-1, H-3, H-7, today, and overdue', () => {
    const today = '2026-10-19'

    // Overdue
    const overdueAlert = getDeadlineAlert('2026-10-17', 'Dikerjakan', today)
    expect(overdueAlert?.type).toBe('OVERDUE')
    expect(overdueAlert?.isUrgent).toBe(true)

    // Today
    const todayAlert = getDeadlineAlert('2026-10-19', 'Belum dikerjakan', today)
    expect(todayAlert?.type).toBe('TODAY')
    expect(todayAlert?.isUrgent).toBe(true)

    // H-1
    const h1Alert = getDeadlineAlert('2026-10-20', 'Dikerjakan', today)
    expect(h1Alert?.type).toBe('H-1')
    expect(h1Alert?.isUrgent).toBe(true)

    // H-3
    const h3Alert = getDeadlineAlert('2026-10-22', 'Dikerjakan', today)
    expect(h3Alert?.type).toBe('H-3')

    // H-7
    const h7Alert = getDeadlineAlert('2026-10-26', 'Belum dikerjakan', today)
    expect(h7Alert?.type).toBe('H-7')
    expect(h7Alert?.isUrgent).toBe(false)
  })

  it('CRITICAL RULE: Completed tasks NEVER produce deadline alerts', () => {
    const today = '2026-10-19'
    // Even if overdue date
    const alert = getDeadlineAlert('2026-10-10', 'Selesai', today)
    expect(alert).toBeNull()

    // Even if today
    const alertToday = getDeadlineAlert('2026-10-19', 'Selesai', today)
    expect(alertToday).toBeNull()
  })

  it('formats Indonesian date accurately', () => {
    expect(formatIndonesianDate('2026-10-19')).toBe('19 Okt 2026')
    expect(formatIndonesianDate('2026-01-05')).toBe('5 Jan 2026')
    expect(formatIndonesianDate(null)).toBe('-')
  })

  it('retrieves valid Asia/Jakarta today string', () => {
    const todayStr = getJakartaTodayString()
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('Validation Logic', () => {
  it('validates URL formats', () => {
    expect(isValidUrl('https://figma.com/design')).toBe(true)
    expect(isValidUrl('http://github.com')).toBe(true)
    expect(isValidUrl('invalid-url')).toBe(false)
    expect(isValidUrl('')).toBe(false)
  })

  it('validates task requirements strictly', () => {
    const invalidTask: Partial<Task> = {
      title: 'A',
      pic_id: '',
      start_date: '2026-10-20',
      deadline: '2026-10-10', // deadline before start
      progress: 120, // out of range
      status: 'Belum dikerjakan',
    }

    const errors = validateTask(invalidTask)
    expect(errors.some((e) => e.field === 'title')).toBe(true)
    expect(errors.some((e) => e.field === 'pic_id')).toBe(true)
    expect(errors.some((e) => e.field === 'deadline')).toBe(true)
    expect(errors.some((e) => e.field === 'progress')).toBe(true)
  })

  it('enforces Selesai status requiring 100% progress and completed_at', () => {
    const taskDoneWithoutProgress: Partial<Task> = {
      title: 'Tugas Dokumentasi',
      pic_id: 'member-1',
      start_date: '2026-10-01',
      deadline: '2026-10-15',
      status: 'Selesai',
      progress: 80, // invalid: must be 100
      completed_at: null, // invalid: must be set
    }

    const errors = validateTask(taskDoneWithoutProgress)
    expect(errors.some((e) => e.field === 'progress')).toBe(true)
    expect(errors.some((e) => e.field === 'completed_at')).toBe(true)

    const validDoneTask: Partial<Task> = {
      title: 'Tugas Dokumentasi',
      pic_id: 'member-1',
      start_date: '2026-10-01',
      deadline: '2026-10-15',
      status: 'Selesai',
      progress: 100,
      completed_at: '2026-10-15T12:00:00Z',
    }
    expect(validateTask(validDoneTask)).toEqual([])
  })

  it('enforces Revisi status requiring revision notes', () => {
    const taskRevisiNoNotes: Partial<Task> = {
      title: 'Desain Banner',
      pic_id: 'member-1',
      start_date: '2026-10-01',
      deadline: '2026-10-15',
      status: 'Revisi',
      progress: 50,
      revision_notes: '', // missing
    }

    const errors = validateTask(taskRevisiNoNotes)
    expect(errors.some((e) => e.field === 'revision_notes')).toBe(true)

    const taskRevisiWithNotes: Partial<Task> = {
      ...taskRevisiNoNotes,
      revision_notes: 'Warna latar belakang perlu diganti ke biru navy.',
    }
    expect(validateTask(taskRevisiWithNotes)).toEqual([])
  })

  it('validates activity dates', () => {
    expect(
      validateActivity({
        name: 'Tech',
        start_date: '2026-10-20',
        end_date: '2026-10-10',
      }).some((e) => e.field === 'end_date')
    ).toBe(true)
  })

  it('validates member names and roles', () => {
    expect(validateMember({ name: '', role: '' }).length).toBe(2)
    expect(validateMember({ name: 'Budi', role: 'Ketua' }).length).toBe(0)
  })
})
