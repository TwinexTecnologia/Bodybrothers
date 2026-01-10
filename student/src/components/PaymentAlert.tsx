import { useState, useEffect } from 'react'
import Modal from './Modal'
import { useFinancialStatus } from '../hooks/useFinancialStatus'
import { AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function PaymentAlert() {
    const { status, overdueCount, loading } = useFinancialStatus()
    const [isOpen, setIsOpen] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        // Só abre se não estiver carregando, se tiver atraso
        if (!loading && status === 'overdue') {
            setIsOpen(true)
        }
    }, [loading, status])

    const handleGoToFinancial = () => {
        setIsOpen(false)
        navigate('/financial')
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title="Atenção: Pendência Financeira"
            type="danger"
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
                        onClick={handleGoToFinancial}
                        style={{
                            background: '#ef4444', border: 'none', color: '#fff',
                            padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 500,
                            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                        }}
                    >
                        Regularizar Agora
                    </button>
                </>
            }
        >
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ 
                    background: '#fee2e2', width: 64, height: 64, borderRadius: '50%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' 
                }}>
                    <AlertTriangle size={32} color="#dc2626" />
                </div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#1e293b' }}>
                    Identificamos {overdueCount} pagamento(s) pendente(s)
                </h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
                    Para continuar aproveitando todos os recursos da plataforma sem interrupções, por favor regularize sua situação financeira.
                </p>
            </div>
        </Modal>
    )
}
