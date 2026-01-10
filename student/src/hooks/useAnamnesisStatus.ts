import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

export function useAnamnesisStatus() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [pendingCount, setPendingCount] = useState(0)
    const [expiredCount, setExpiredCount] = useState(0)
    const [status, setStatus] = useState<'regular' | 'pending' | 'expired'>('regular')
    const [expiringModels, setExpiringModels] = useState<any[]>([])

    useEffect(() => {
        if (user) checkAnamnesis()
    }, [user])

    async function checkAnamnesis() {
        try {
            setLoading(true)
            
            // 1. Busca Modelos atribuídos ao aluno
            const { data: models, error: errModels } = await supabase
                .from('protocols')
                .select('*')
                .eq('student_id', user?.id)
                .eq('type', 'anamnesis_model')
            
            if (errModels) throw errModels

            // 2. Busca Respostas do aluno
            const { data: responses, error: errResponses } = await supabase
                .from('protocols')
                .select('*')
                .eq('student_id', user?.id)
                .eq('type', 'anamnesis')

            if (errResponses) throw errResponses

            // 3. Analisa Pendências
            let pending = 0
            let expired = 0
            const expiring: any[] = []
            const today = new Date().toISOString().split('T')[0]

            models?.forEach(model => {
                // Verifica se tem resposta para este modelo
                const hasResponse = responses?.some(r => r.data?.modelId === model.id)
                
                if (!hasResponse) {
                    // Se não respondeu, verifica se já venceu o prazo
                    if (model.ends_at && model.ends_at < today) {
                        expired++
                    } else {
                        pending++
                        // Verifica se está vencendo (tem data futura)
                        if (model.ends_at) {
                            expiring.push(model)
                        }
                    }
                }
            })

            setPendingCount(pending)
            setExpiredCount(expired)
            setExpiringModels(expiring)

            if (expired > 0) setStatus('expired')
            else if (pending > 0) setStatus('pending')
            else setStatus('regular')

        } catch (error) {
            console.error('Erro ao verificar anamneses:', error)
        } finally {
            setLoading(false)
        }
    }

    return { loading, status, pendingCount, expiredCount, expiringModels }
}
