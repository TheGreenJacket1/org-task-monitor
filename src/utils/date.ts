import { DeadlineAlertInfo, TaskStatus } from '../types'

/**
 * Returns today's date in YYYY-MM-DD string format for Asia/Jakarta timezone (WIB, UTC+7).
 */
export function getJakartaTodayString(referenceDate?: Date): string {
  const d = referenceDate || new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(d)
}

/**
 * Calculates calendar day difference between a target date and today in Asia/Jakarta timezone.
 * Returns:
 *   negative: overdue (e.g. -2 means 2 days ago)
 *   0: today
 *   positive: future days (e.g. 1 means tomorrow)
 */
export function calculateDaysDiffJakarta(deadlineStr: string, referenceTodayStr?: string): number {
  const todayStr = referenceTodayStr || getJakartaTodayString()
  
  // Parse YYYY-MM-DD to UTC timestamps at midnight to compare whole calendar days
  const [tYear, tMonth, tDay] = todayStr.split('-').map(Number)
  const [dYear, dMonth, dDay] = deadlineStr.split('-').map(Number)
  
  const todayUtc = Date.UTC(tYear, tMonth - 1, tDay)
  const deadlineUtc = Date.UTC(dYear, dMonth - 1, dDay)
  
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((deadlineUtc - todayUtc) / msPerDay)
}

/**
 * Calculates deadline alert for a task.
 * RULE: Completed tasks (status === 'Selesai') NEVER generate deadline alerts.
 */
export function getDeadlineAlert(
  deadlineStr: string,
  status: TaskStatus,
  referenceTodayStr?: string
): DeadlineAlertInfo | null {
  if (status === 'Selesai') {
    return null
  }

  if (!deadlineStr) {
    return null
  }

  const diffDays = calculateDaysDiffJakarta(deadlineStr, referenceTodayStr)

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays)
    return {
      type: 'OVERDUE',
      label: `Terlambat ${overdueDays} hari`,
      diffDays,
      isUrgent: true,
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    }
  }

  if (diffDays === 0) {
    return {
      type: 'TODAY',
      label: 'Deadline Hari Ini',
      diffDays: 0,
      isUrgent: true,
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse',
    }
  }

  if (diffDays === 1) {
    return {
      type: 'H-1',
      label: 'H-1 (Besok)',
      diffDays: 1,
      isUrgent: true,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    }
  }

  if (diffDays <= 3) {
    return {
      type: 'H-3',
      label: `H-${diffDays} (${diffDays} hari lagi)`,
      diffDays,
      isUrgent: true,
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
  }

  if (diffDays <= 7) {
    return {
      type: 'H-7',
      label: `H-${diffDays} (1 minggu lagi)`,
      diffDays,
      isUrgent: false,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    }
  }

  return {
    type: 'UPCOMING',
    label: `${diffDays} hari lagi`,
    diffDays,
    isUrgent: false,
    badgeColor: 'bg-gray-100 text-gray-700 border-gray-200',
  }
}

/**
 * Format date string (YYYY-MM-DD) to Indonesian readable format (e.g. 24 Okt 2026).
 */
export function formatIndonesianDate(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
    if (!year || !month || !day) return dateStr
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ]
    return `${day} ${months[month - 1]} ${year}`
  } catch {
    return dateStr
  }
}

/**
 * Format timestamp into Indonesian date and time (e.g. 19 Okt 2026, 14:30 WIB).
 */
export function formatIndonesianDateTime(isoStr?: string | null): string {
  if (!isoStr) return '-'
  try {
    const date = new Date(isoStr)
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date) + ' WIB'
  } catch {
    return isoStr
  }
}
