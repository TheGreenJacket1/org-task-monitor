import React, { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  commands: Command[]
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari aksi atau kegiatan..."
            className="flex-1 text-sm outline-none"
          />
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">Tidak ada hasil.</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  c.run()
                  onClose()
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition"
              >
                <span className="text-sm font-medium text-slate-800">{c.label}</span>
                {c.hint && <span className="text-[10px] text-slate-400">{c.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}