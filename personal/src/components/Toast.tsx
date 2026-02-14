import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
    message: string
    type?: ToastType
    onClose: () => void
}

export function Toast({ message, type = 'info', onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000)
        return () => clearTimeout(timer)
    }, [onClose])

    const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'

    return (
        <div style={{
            position: 'fixed',
            top: 20,
            right: 20,
            background: bg,
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 99999,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            maxWidth: '90vw'
        }}>
            {message}
        </div>
    )
}