import { supabase } from '../lib/supabase'

export type DebitRecord = {
  id: string
  payerId: string
  receiverId: string
  amount: number
  description?: string
  dueDate: string
  paidAt?: string
  status: 'pending' | 'paid' | 'overdue' | 'canceled'
  monthRef?: string // Data de referência (ex: 2024-01-01)
}

function mapDebitFromDb(d: any): DebitRecord {
  return {
    id: d.id,
    payerId: d.payer_id,
    receiverId: d.receiver_id,
    amount: Number(d.amount),
    description: d.description,
    dueDate: d.due_date,
    paidAt: d.paid_at,
    status: d.status,
    monthRef: d.saas_ref_month
  }
}

export async function listMonthPayments(personalId: string, monthDate: Date): Promise<DebitRecord[]> {
  // Pega o primeiro e último dia do mês
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().split('T')[0]
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('debits')
    .select('*')
    .eq('receiver_id', personalId)
    .gte('saas_ref_month', start)
    .lte('saas_ref_month', end)
    .eq('type', 'service') // Cobrança de serviço (personal)

  if (error) return []
  return (data || []).map(mapDebitFromDb)
}

export async function registerPayment(data: {
    personalId: string
    studentId: string
    amount: number
    dueDate: string
    refDate: Date
    description?: string
}): Promise<boolean> {
    const refMonth = new Date(data.refDate.getFullYear(), data.refDate.getMonth(), 1).toISOString().split('T')[0]
    
    const { error } = await supabase
        .from('debits')
        .insert({
            type: 'service',
            payer_id: data.studentId,
            receiver_id: data.personalId,
            amount: data.amount,
            description: data.description || 'Mensalidade Personal',
            due_date: data.dueDate, // Data de vencimento correta
            paid_at: new Date().toISOString(), // Pago agora
            status: 'paid',
            saas_ref_month: refMonth
        })
    
    return !error
}

export async function undoPayment(paymentId: string): Promise<boolean> {
    const { error } = await supabase
        .from('debits')
        .delete()
        .eq('id', paymentId)
    
    return !error
}

export async function listPaymentHistory(personalId: string, filters: { year: number, month?: number, studentId?: string }): Promise<DebitRecord[]> {
    let query = supabase
        .from('debits')
        .select('*')
        .eq('receiver_id', personalId)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })

    if (filters.month !== undefined && filters.month !== -1) {
        // month é 0-based (0 = Jan)
        const start = new Date(filters.year, filters.month, 1).toISOString().split('T')[0]
        const end = new Date(filters.year, filters.month + 1, 0).toISOString().split('T')[0]
        query = query.gte('saas_ref_month', start).lte('saas_ref_month', end)
    } else {
        const start = new Date(filters.year, 0, 1).toISOString().split('T')[0]
        const end = new Date(filters.year, 11, 31).toISOString().split('T')[0]
        query = query.gte('saas_ref_month', start).lte('saas_ref_month', end)
    }

    if (filters.studentId) {
        query = query.eq('payer_id', filters.studentId)
    }

    const { data, error } = await query
    if (error) return []
    return (data || []).map(mapDebitFromDb)
}

export async function listAllStudentPayments(studentId: string): Promise<DebitRecord[]> {
    const { data, error } = await supabase
        .from('debits')
        .select('*')
        .eq('payer_id', studentId)
        .eq('status', 'paid')
    
    if (error) return []
    return (data || []).map(mapDebitFromDb)
}
