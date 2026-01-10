import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePersonalNotifications, PersonalNotification } from '../hooks/usePersonalNotifications'

export default function NotificationBell() {
    const { notifications, loading } = usePersonalNotifications()
    const [showDropdown, setShowDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleClick = (n: PersonalNotification) => {
        setShowDropdown(false)
        if (n.link) navigate(n.link)
    }

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button 
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ 
                    background: 'transparent', border: 'none', cursor: 'pointer', 
                    position: 'relative', color: '#64748b', padding: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem'
                }}
            >
                🔔
                {notifications.length > 0 && (
                    <span style={{ 
                        position: 'absolute', top: 0, right: 0, 
                        background: '#ef4444', color: '#fff', 
                        fontSize: '0.7rem', fontWeight: 'bold', 
                        width: 18, height: 18, borderRadius: '50%', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid #fff'
                    }}>
                        {notifications.length}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div style={{ 
                    position: 'absolute', top: '100%', right: 0, width: 360, 
                    background: '#fff', borderRadius: 12, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', 
                    border: '1px solid #f1f5f9', zIndex: 1000, overflow: 'hidden',
                    marginTop: 8
                }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Notificações</strong>
                        <button onClick={() => setShowDropdown(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                    </div>
                    
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
                        ) : notifications.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                Nenhuma notificação recente.
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div 
                                    key={n.id} 
                                    onClick={() => handleClick(n)}
                                    style={{ 
                                        padding: '12px 16px', borderBottom: '1px solid #f8fafc', 
                                        cursor: 'pointer', transition: 'background 0.2s',
                                        display: 'flex', gap: 12, alignItems: 'flex-start'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                >
                                    <div style={{ 
                                        marginTop: 2, 
                                        background: '#f1f5f9', 
                                        padding: 8, borderRadius: '50%', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        minWidth: 34, height: 34, fontSize: '1.2rem'
                                    }}>
                                        {n.type.includes('overdue') ? '🔴' : n.type.includes('paid') ? '🟢' : '🔵'}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{n.title}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>{n.description}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>
                                            {n.date.toLocaleDateString('pt-BR')} {n.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
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
