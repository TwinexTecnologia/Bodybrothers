import React, { useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number | string
  type?: 'default' | 'danger' | 'success'
}

export default function Modal({ isOpen, onClose, title, children, footer, width = 450, type = 'default' }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: '#fff',
          width: '90%',
          maxWidth: width,
          maxHeight: '90vh', // Limite de altura para mobile
          overflowY: 'auto', // Scroll interno
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden', // Cuidado com overflow hidden + auto
          display: 'flex', flexDirection: 'column', // Para scroll funcionar bem
          animation: 'scaleUp 0.2s ease-out',
          border: type === 'danger' ? '1px solid #fecaca' : '1px solid #e2e8f0'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
            padding: '20px 24px', 
            borderBottom: '1px solid #f1f5f9',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: type === 'danger' ? '#fef2f2' : '#fff'
        }}>
          <h3 style={{ 
              margin: 0, 
              fontSize: '1.25rem', 
              fontWeight: 600, 
              color: type === 'danger' ? '#dc2626' : '#0f172a' 
          }}>
            {title}
          </h3>
          <button 
            onClick={onClose}
            style={{ 
                background: 'transparent', border: 'none', cursor: 'pointer', 
                fontSize: '1.5rem', lineHeight: 1, color: '#94a3b8',
                padding: 4
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', color: '#475569', lineHeight: 1.6, overflowY: 'auto', maxHeight: 'calc(90vh - 130px)' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
            <div style={{ 
                padding: '16px 24px', 
                background: '#f8fafc', 
                borderTop: '1px solid #f1f5f9',
                display: 'flex', justifyContent: 'flex-end', gap: '12px'
            }}>
                {footer}
            </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  )
}
