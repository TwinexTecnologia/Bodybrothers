import { useState, useEffect } from 'react'
import { useFinancialStatus } from './useFinancialStatus'
import { useAnamnesisStatus } from './useAnamnesisStatus'

export type Notification = {
    id: string
    type: 'financial' | 'anamnesis'
    message: string
    daysRemaining: number
    date: Date
}

export function useNotifications() {
    const { chargesList } = useFinancialStatus()
    const { expiringModels } = useAnamnesisStatus()
    const [notifications, setNotifications] = useState<Notification[]>([])

    useEffect(() => {
        const list: Notification[] = []
        const today = new Date()
        today.setHours(0,0,0,0)

        // 1. Financeiro (5 dias antes)
        chargesList.forEach((charge, idx) => {
            if (charge.status === 'pending') {
                const diffTime = charge.date.getTime() - today.getTime()
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                if (diffDays >= 0 && diffDays <= 5) {
                    list.push({
                        id: `fin-${idx}`,
                        type: 'financial',
                        message: diffDays === 0 
                            ? 'Sua fatura vence hoje!' 
                            : `Sua fatura vence em ${diffDays} dia${diffDays > 1 ? 's' : ''}.`,
                        daysRemaining: diffDays,
                        date: charge.date
                    })
                }
            }
        })

        // 2. Anamnese (3 dias antes)
        expiringModels.forEach((model) => {
            const endDate = new Date(model.ends_at)
            // Ajuste de fuso se necessário, assumindo ends_at como YYYY-MM-DD UTC
            endDate.setHours(0,0,0,0)
            // Como a string vem YYYY-MM-DD, new Date() cria como UTC. 
            // Para comparar com Today (Local), precisamos ajustar.
            // Vamos usar o split para garantir data correta
            const parts = model.ends_at.split('-').map(Number)
            const localEnd = new Date(parts[0], parts[1]-1, parts[2])
            
            const diffTime = localEnd.getTime() - today.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            if (diffDays >= 0 && diffDays <= 3) {
                list.push({
                    id: `anam-${model.id}`,
                    type: 'anamnesis',
                    message: diffDays === 0
                        ? 'Sua anamnese vence hoje!'
                        : `Atualize sua anamnese em ${diffDays} dia${diffDays > 1 ? 's' : ''}.`,
                    daysRemaining: diffDays,
                    date: localEnd
                })
            }
        })

        setNotifications(list.sort((a,b) => a.daysRemaining - b.daysRemaining))

    }, [chargesList, expiringModels])

    return { notifications }
}
