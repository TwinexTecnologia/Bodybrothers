import { useState, useRef, useEffect } from 'react'
import { Bell, AlertTriangle, FileText, CreditCard } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'

export default function NotificationBell() {
    const { notifications } = useNotifications()
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Fecha ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: 'transparent', // Sem fundo
                    border: 'none', // Sem borda
                    padding: 0,
                    width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', position: 'relative',
                    color: '#64748b', // Cor do ícone (cinza azulado padrão)
                    // Sem sombra
                }}
            >
                <Bell size={24} strokeWidth={2} /> {/* Ícone um pouco maior */}
                {notifications.length > 0 && (
                    <span style={{
                        position: 'absolute', top: 0, right: 0,
                        background: '#ef4444', color: '#fff',
                        fontSize: '0.7rem', fontWeight: 700,
                        width: 18, height: 18, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid #fff', // Borda branca para separar do ícone
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        {notifications.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute', top: 48, right: 0,
                    width: 320,
                    background: '#fff', borderRadius: 12,
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    border: '1px solid #e2e8f0',
                    zIndex: 3000,
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>Notificações</h4>
                    </div>
                    
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                                Nenhuma notificação nova.
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <div key={notif.id} style={{ 
                                    padding: '12px 16px', 
                                    borderBottom: '1px solid #f1f5f9',
                                    display: 'flex', gap: 12, alignItems: 'flex-start'
                                }}>
                                    <div style={{ 
                                        background: notif.type === 'financial' ? '#fee2e2' : '#fef3c7', 
                                        padding: 8, borderRadius: '50%', display: 'flex' 
                                    }}>
                                        {notif.type === 'financial' 
                                            ? <CreditCard size={16} color="#dc2626" />
                                            : <FileText size={16} color="#d97706" />
                                        }
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>
                                            {notif.message}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                                            {notif.date.toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
