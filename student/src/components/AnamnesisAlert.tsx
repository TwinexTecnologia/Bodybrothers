import { useState, useEffect } from 'react'
import Modal from './Modal'
import { useAnamnesisStatus } from '../hooks/useAnamnesisStatus'
import { FileText, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function AnamnesisAlert() {
    const { status, pendingCount, expiredCount, loading } = useAnamnesisStatus()
    const [isOpen, setIsOpen] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        // Só abre se estiver EXPIRED (Vencida)
        if (!loading && status === 'expired') {
            setIsOpen(true)
        }
    }, [loading, status])

    const handleGoToAnamnesis = () => {
        setIsOpen(false)
        navigate('/anamnesis')
    }

    // Se não estiver vencida, não renderiza nada
    if (status !== 'expired') return null

    const title = 'Anamnese Vencida'
    const color = '#dc2626'
    const bgIcon = '#fee2e2'
    const type = 'danger'

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title={title}
            type={type}
            footer={
                <>
                    <button 
                        onClick={() => setIsOpen(false)}
                        style={{
                            background: '#fff', border: '1px solid #e2e8f0', color: '#64748b',
                            padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 500
                        }}
                    >
                        Fechar
                    </button>
                    <button 
                        onClick={handleGoToAnamnesis}
                        style={{
                            background: color, border: 'none', color: '#fff',
                            padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 500,
                            boxShadow: `0 2px 4px ${color}40`
                        }}
                    >
                        Responder Agora
                    </button>
                </>
            }
        >
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ 
                    background: bgIcon, width: 64, height: 64, borderRadius: '50%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' 
                }}>
                    {status === 'expired' ? <Clock size={32} color={color} /> : <FileText size={32} color={color} />}
                </div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#1e293b' }}>
                    Você possui {expiredCount} anamnese(s) com prazo vencido.
                </h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
                    Por favor, entre em contato com seu personal ou responda o quanto antes para atualizar seu treino.
                </p>
            </div>
        </Modal>
    )
}
