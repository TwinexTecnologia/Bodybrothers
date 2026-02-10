import { useState, useEffect } from 'react';
import { useFinancialStatus } from './useFinancialStatus';
import { useAnamnesisStatus } from './useAnamnesisStatus';

export type Notification = {
    id: string
    type: 'financial' | 'anamnesis'
    message: string
    daysRemaining: number
    date: Date
}

export function useNotifications() {
    const { chargesList, loading: financialLoading } = useFinancialStatus();
    const { expiringModels, status: anamnesisStatus, expiredCount, loading: anamnesisLoading } = useAnamnesisStatus();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasCritical, setHasCritical] = useState(false);

    useEffect(() => {
        const list: Notification[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        let critical = false;

        // 1. Financeiro (5 dias antes)
        chargesList.forEach((charge, idx) => {
            if (charge.status === 'pending') {
                const diffTime = charge.date.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays >= 0 && diffDays <= 5) {
                    list.push({
                        id: `fin-${idx}`,
                        type: 'financial',
                        message: diffDays === 0 
                            ? 'Sua fatura vence hoje!' 
                            : `Sua fatura vence em ${diffDays} dia${diffDays > 1 ? 's' : ''}.`,
                        daysRemaining: diffDays,
                        date: charge.date
                    });
                }
            } else if (charge.status === 'overdue') {
                critical = true;
                list.push({
                    id: `fin-overdue-${idx}`,
                    type: 'financial',
                    message: 'Você possui uma fatura vencida!',
                    daysRemaining: -1,
                    date: charge.date
                });
            }
        });

        // 2. Anamnese (3 dias antes ou vencida)
        if (anamnesisStatus === 'expired') {
            critical = true;
            list.push({
                id: 'anam-expired',
                type: 'anamnesis',
                message: `Você tem ${expiredCount} anamnese(s) vencida(s). Responda agora!`,
                daysRemaining: -1,
                date: new Date()
            });
        }

        expiringModels.forEach((model) => {
            const endDate = new Date(model.ends_at);
            // Ajuste de fuso se necessário
            // Como a string vem YYYY-MM-DD, new Date() cria como UTC. 
            const parts = model.ends_at.split('-').map(Number);
            const localEnd = new Date(parts[0], parts[1]-1, parts[2]);
            
            const diffTime = localEnd.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 0 && diffDays <= 3) {
                list.push({
                    id: `anam-${model.id}`,
                    type: 'anamnesis',
                    message: diffDays === 0
                        ? 'Sua anamnese vence hoje!'
                        : `Atualize sua anamnese em ${diffDays} dia${diffDays > 1 ? 's' : ''}.`,
                    daysRemaining: diffDays,
                    date: localEnd
                });
            }
        });

        setNotifications(list.sort((a,b) => a.daysRemaining - b.daysRemaining));
        setHasCritical(critical);

    }, [chargesList, expiringModels, anamnesisStatus, expiredCount]);

    return { 
        notifications, 
        hasCritical, 
        loading: financialLoading || anamnesisLoading 
    };
}
