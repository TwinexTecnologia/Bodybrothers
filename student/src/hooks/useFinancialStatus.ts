import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

type Plan = {
  id: string
  title: string
  price: number
  due_day: number
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
                .select('plan_id, due_day, data')
                .eq('id', user?.id)
                .single()
            
            const info = {
                planId: profile?.plan_id || profile?.data?.planId,
                dueDay: profile?.due_day || profile?.data?.dueDay,
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
        
        // SE O PREÇO FOR ZERO, NÃO GERA COBRANÇAS (GRATUITO)
        if (planData.price <= 0) return []

        let dateStr = info.planStartDate
        if (dateStr.includes('T')) dateStr = dateStr.split('T')[0]
        
        const parts = dateStr.split('-').map(Number)
        if (parts.length < 3 || parts.some(isNaN)) return []
        
        const start = new Date(parts[0], parts[1] - 1, parts[2])
        start.setHours(0,0,0,0)
        
        const today = new Date()
        // Projeta 6 meses para frente
        const limit = new Date(today)
        limit.setMonth(limit.getMonth() + 6)
        
        const generated: any[] = []
        const dueDay = info.dueDay || planData.due_day || 10

        let current = new Date(start)
        
        if (planData.frequency !== 'weekly') {
            current.setDate(dueDay)
        }

        let loopCount = 0
        while (current <= limit && loopCount < 1000) {
            loopCount++
            let chargeDate: Date | null = null

            if (planData.frequency !== 'weekly') {
                const diffMonths = (current.getFullYear() - start.getFullYear()) * 12 + (current.getMonth() - start.getMonth())
                
                let interval = 1
                if (planData.frequency === 'bimonthly') interval = 2
                else if (planData.frequency === 'quarterly') interval = 3
                else if (planData.frequency === 'semiannual') interval = 6
                else if (planData.frequency === 'annual') interval = 12

                if (diffMonths >= 0 && diffMonths % interval === 0) {
                     chargeDate = new Date(current.getFullYear(), current.getMonth(), dueDay)
                }
                current.setMonth(current.getMonth() + 1)
            } else {
                chargeDate = new Date(current)
                current.setDate(current.getDate() + 7)
            }

            if (chargeDate) {
                const dueStr = chargeDate.toISOString().split('T')[0]
                const payment = payList.find(p => {
                    if (p.dueDate === dueStr) return true
                    if (planData.frequency !== 'weekly' && p.monthRef) {
                        const pDate = new Date(p.monthRef)
                        return pDate.getMonth() === chargeDate!.getMonth() && pDate.getFullYear() === chargeDate!.getFullYear()
                    }
                    return false
                })

                let status = 'pending'
                if (payment) status = 'paid'
                else if (chargeDate < new Date() && chargeDate.getDate() !== new Date().getDate()) status = 'overdue'

                generated.push({
                    date: chargeDate,
                    amount: planData.price,
                    status,
                    payment
                })
            }
        }
        return generated.sort((a,b) => a.date.getTime() - b.date.getTime())
    }

    return { loading, status, overdueCount, plan, financialInfo, payments, chargesList }
}
