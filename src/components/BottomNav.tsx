import React from 'react'
import { LayoutDashboard, CheckSquare, Calendar, Users, History, Trash2 } from 'lucide-react'

interface BottomNavProps {
  activeTab: 'dashboard' | 'tasks' | 'logs'
  onNavigate: (tab: 'dashboard' | 'tasks' | 'logs') => void
  onOpenActivities: () => void
  onOpenMembers: () => void
  onOpenTrash: () => void
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onNavigate, onOpenActivities, onOpenMembers, onOpenTrash }) => {
  const items = [
    { key: 'dashboard' as const, label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, action: () => onNavigate('dashboard') },
    { key: 'tasks' as const, label: 'Tugas', icon: <CheckSquare className="w-5 h-5" />, action: () => onNavigate('tasks') },
    { key: 'activities' as const, label: 'Kegiatan', icon: <Calendar className="w-5 h-5" />, action: onOpenActivities },
    { key: 'members' as const, label: 'Anggota', icon: <Users className="w-5 h-5" />, action: onOpenMembers },
    { key: 'logs' as const, label: 'Riwayat', icon: <History className="w-5 h-5" />, action: () => onNavigate('logs') },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
      <div className="flex items-center justify-around px-1 py-1.5">
        {items.map((it) => (
          <button
            key={it.key}
            onClick={it.action}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition min-w-[44px] min-h-[44px] ${
              (it.key === 'dashboard' || it.key === 'tasks' || it.key === 'logs') && activeTab === it.key ? 'text-emerald-600' : 'text-slate-500'
            }`}
            aria-label={it.label}
          >
            {it.icon}
            <span className="text-[10px] font-semibold">{it.label}</span>
          </button>
        ))}
        <button
          onClick={onOpenTrash}
          className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition min-w-[44px] min-h-[44px] text-slate-500"
          aria-label="Tempat Sampah"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Sampah</span>
        </button>
      </div>
    </nav>
  )
}