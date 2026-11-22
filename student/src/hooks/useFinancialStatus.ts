import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { getPlanBillingDays, normalizeDate } from '../lib/planBilling'

type Plan = {
  id: string
  title: string
  price: number
  billing_cycle_days?: number | null
  frequency?: string
}

type DebitRecord = {
    id: string
    amount: number
    dueDate: string
    paidAt?: string
    status: string
    monthRef?: string
}

export function useFinancialStatus() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState<'regular' | 'overdue' | 'unknown'>('regular')
    const [overdueCount, setOverdueCount] = useState(0)
    const [plan, setPlan] = useState<Plan | null>(null)
    const [financialInfo, setFinancialInfo] = useState<any>({})
    const [payments, setPayments] = useState<DebitRecord[]>([])

    const [chargesList, setChargesList] = useState<any[]>([])

    useEffect(() => {
        if (user) loadData()
    }, [user])

    async function loadData() {
        try {
            setLoading(true)
            
            // ... (código de busca igual) ...
            // 1. Busca info do perfil
            const { data: profile } = await supabase
                .from('profiles')
                .select('plan_id, data')
                .eq('id', user?.id)
                .single()
            
            const info = {
                planId: profile?.plan_id || profile?.data?.planId,
                planStartDate: profile?.data?.planStartDate
            }
            setFinancialInfo(info)

            if (info.planId) {
                // 2. Busca Plano
                const { data: planData } = await supabase
                    .from('plans')
                    .select('*')
                    .eq('id', info.planId)
                    .single()
                
                if (planData) setPlan(planData)

                // 3. Busca Pagamentos Realizados
                const { data: payData } = await supabase
                    .from('debits')
                    .select('*')
                    .eq('payer_id', user?.id)
                    .eq('status', 'paid')
                
                const mappedPayments = (payData || []).map((d: any) => ({
                    id: d.id,
                    amount: Number(d.amount),
                    dueDate: d.due_date,
                    paidAt: d.paid_at,
                    status: d.status,
                    monthRef: d.saas_ref_month
                }))
                setPayments(mappedPayments)

                // 4. Gera Lista e Calcula Status
                const list = generateCharges(info, planData, mappedPayments)
                setChargesList(list)
                
                const pending = list.filter(c => c.status === 'overdue').length
                setOverdueCount(pending)
                setStatus(pending > 0 ? 'overdue' : 'regular')
            } else {
                setStatus('unknown')
            }
        } catch (error) {
            console.error('Erro ao carregar status financeiro:', error)
        } finally {
            setLoading(false)
        }
    }

    function generateCharges(info: any, planData: Plan, payList: DebitRecord[]) {
        if (!info.planStartDate || !planData) return []
        
        const isFree = planData.price <= 0 || (planData.title && planData.title.toLowerCase().includes('permuta')) || (planData.title && planData.title.toLowerCase().includes('gratuito'))
        if (isFree) return []

        const start = normalizeDate(info.planStartDate)
        const today = normalizeDate(new Date())
        const limit = normalizeDate(today)
        limit.setMonth(limit.getMonth() + 6)
        
        const generated: any[] = []
        const billingDays = getPlanBillingDays({
            billingCycleDays: planData.billing_cycle_days,
            frequency: planData.frequency,
        })

        let current = new Date(start)
        let loopCount = 0
        while (current <= limit && loopCount < 300) {
            loopCount++

            const chargeDate = new Date(current)
            const dueStr = chargeDate.toISOString().split('T')[0]
            const payment = payList.find(p => p.dueDate === dueStr)

            let status = 'pending'
            if (payment) status = 'paid'
            else if (chargeDate < today) status = 'overdue'

            generated.push({
                date: chargeDate,
                amount: planData.price,
                status,
                payment
            })

            current.setDate(current.getDate() + billingDays)
        }

        return generated.sort((a,b) => a.date.getTime() - b.date.getTime())
    }

    return { loading, status, overdueCount, plan, financialInfo, payments, chargesList }
}
