import React, { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  impactSummary?: string[]
  requireTypedText?: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  impactSummary,
  requireTypedText,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  const [typed, setTyped] = useState('')
  React.useEffect(() => {
    if (isOpen) setTyped('')
  }, [isOpen])
  if (!isOpen) return null

  const canConfirm = requireTypedText ? typed.trim() === requireTypedText.trim() : true

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="modal-sheet bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden transform transition-all">
        <div className="modal-sheet-body p-6 max-h-[75vh] overflow-y-auto">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-full shrink-0 ${
                isDestructive ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</p>
              {impactSummary && impactSummary.length > 0 && (
                <ul className="mt-3 text-xs text-slate-700 list-disc pl-4 space-y-0.5">
                  {impactSummary.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
              {requireTypedText && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Ketik <strong>{requireTypedText}</strong> untuk konfirmasi
                  </label>
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
            <button
              onClick={onCancel}
              className="flex items-center justify-center h-11 w-11 md:h-auto md:w-auto md:p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition shrink-0"
              title="Batal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="modal-sheet-footer bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
