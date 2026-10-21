import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

const STORAGE_KEY_CONFIG = 'org_task_supabase_config'

export function getStoredSupabaseConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.url && parsed.anonKey) {
        return parsed
      }
    }
  } catch (e) {
    console.error('Gagal membaca konfigurasi Supabase dari storage:', e)
  }

  // Fallback to import.meta.env
  const envUrl = import.meta.env.VITE_SUPABASE_URL
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (envUrl && envKey && envUrl.startsWith('http')) {
    return { url: envUrl, anonKey: envKey }
  }

  return null
}

export function saveSupabaseConfig(config: SupabaseConfig | null): void {
  if (!config) {
    localStorage.removeItem(STORAGE_KEY_CONFIG)
  } else {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config))
  }
}

let cachedClient: SupabaseClient | null = null
let currentConfigString = ''

export function isMissingRelation(err: any): boolean {
  if (!err) return false
  const code = String(err.code || '')
  const msg = String(err.message || '')
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('not found in schema cache') ||
    msg.includes('relation') && msg.includes('does not exist')
  )
}

export function isMissingColumn(err: any): boolean {
  if (!err) return false
  const code = String(err.code || '')
  const msg = String(err.message || '')
  return code === '42703' || (msg.includes('column') && msg.includes('does not exist'))
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig()
  if (!config) {
    cachedClient = null
    currentConfigString = ''
    return null
  }

  const configStr = `${config.url}::${config.anonKey}`
  if (cachedClient && currentConfigString === configStr) {
    return cachedClient
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
    currentConfigString = configStr
    return cachedClient
  } catch (err) {
    console.error('Gagal inisialisasi Supabase client:', err)
    return null
  }
}
