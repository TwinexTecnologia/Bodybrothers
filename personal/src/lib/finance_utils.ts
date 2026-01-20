import type { PlanRecord } from '../store/plans'
import type { StudentRecord } from '../store/students'
import type { DebitRecord } from '../store/financial'

export function generateExpectedCharges(
    student: StudentRecord, 
    plan: PlanRecord, 
    untilDate: Date = new Date()
): Date[] {
    if (!student.planStartDate || !plan) return []

    let dateStr = student.planStartDate
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0]
    
    const parts = dateStr.split('-').map(Number)
    if (parts.length < 3 || parts.some(isNaN)) return []
    
    // Data de Início Absoluta
    const start = new Date(parts[0], parts[1] - 1, parts[2])
    start.setHours(0,0,0,0)
    
    if (isNaN(start.getTime())) return []

    const charges: Date[] = []
    const dueDay = student.dueDay || 10
    
    // Limite de segurança (hoje + 1 dia)
    const endLimit = new Date(untilDate)
    endLimit.setHours(23, 59, 59, 999)

    // Iterador
    let current = new Date(start)
    // Ajusta o dia para o dia de vencimento (exceto se for semanal, onde conta dias corridos)
    if (plan.frequency !== 'weekly') {
        // Se a data de inicio (ex: 20) for depois do dia de vencimento (ex: 10),
        // a primeira cobrança é no próximo mês? OU no próprio mês?
        // Regra atual: A mensalidade do mês de entrada conta.
        // Vamos alinhar o dia com o dueDay
        
        // Ex: Start 20/01. Due 10.
        // Opção A: Cobrança 10/01 (Retroativa/Pro-rata não usada aqui, mas "Referencia Jan").
        // Opção B: Cobrança 10/02.
        
        // Pela lógica do FinancialList (monthly logic):
        // (viewYear - startYear)*12 + (viewMonth - startMonth) % interval === 0
        // Se Start=Jan, View=Jan -> Diff=0. 0%1==0. Charge=Jan 10.
        // Então sim, cobra no mês de entrada com o dia de vencimento especificado.
        
        current.setDate(dueDay)
        
        // Se ao ajustar o dia, a data ficou ANTERIOR ao start real (Ex: Start 20/01, Due 10 -> 10/01),
        // ainda assim é uma cobrança válida para "Janeiro"?
        // Sim, é a cobrança de Janeiro.
    }

    // Loop até passar a data limite
    let loopCount = 0
    while (current <= endLimit && loopCount < 1000) {
        loopCount++
        
        // Adiciona a data se ela for >= start (ou se aceitarmos cobrança no mesmo mês mesmo que dia anterior)
        // No FinancialList, a gente gera baseada no Mês.
        // Aqui vamos gerar baseada na data real de vencimento.
        
        // Se frequency != weekly, a data é baseada no Mês/Ano e Dia Vencimento.
        if (plan.frequency !== 'weekly') {
            // Verifica se este mês é um mês de cobrança
            const diffMonths = (current.getFullYear() - start.getFullYear()) * 12 + (current.getMonth() - start.getMonth())
            
            let interval = 1
            if (plan.frequency === 'bimonthly') interval = 2
            else if (plan.frequency === 'quarterly') interval = 3
            else if (plan.frequency === 'semiannual') interval = 6
            else if (plan.frequency === 'annual') interval = 12

            if (diffMonths >= 0 && diffMonths % interval === 0) {
                 // Clone date
                 const chargeDate = new Date(current.getFullYear(), current.getMonth(), dueDay)
                 // Só adiciona se <= limite
                 if (chargeDate <= endLimit) {
                     // Correção: Só adiciona se a data de cobrança for >= data de inicio real do plano
                     // Isso evita cobrar mensalidades "anteriores" ao inicio do contrato só pq o dia de vencimento é menor que o dia de inicio
                     // Ex: Inicio dia 20. Vencimento dia 10.
                     // A cobrança do dia 10 daquele mesmo mês deve ser ignorada (ou cobrada pro-rata, mas aqui assumimos ignorar a passada).
                     // A primeira cobrança deve ser Fev 10.
                     
                     if (chargeDate >= start) {
                        charges.push(chargeDate)
                     }
                 }
            }
            
            // Avança 1 mês para checar o próximo
            current.setMonth(current.getMonth() + 1)
        } else {
            // Semanal: Simplesmente soma 7 dias
            if (current <= endLimit) {
                charges.push(new Date(current))
            }
            current.setDate(current.getDate() + 7)
        }
    }

    return charges
}

export function isStudentOverdue(
    student: StudentRecord, 
    plan: PlanRecord, 
    payments: DebitRecord[]
): boolean {
    // Gera todas as cobranças devidas até hoje
    // Mas "Hoje" conta como atrasado? 
    // Se vence HOJE e não pagou, é "Pendente", não "Atrasado".
    // Atrasado é Ontem.
    
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const dueDates = generateExpectedCharges(student, plan, yesterday)

    // Filtra cobranças muito antigas (mais de 90 dias) se o aluno não tiver nenhum pagamento registrado antigo
    // Isso evita que alunos antigos (migrados) fiquem com tudo vermelho
    // Mas se o aluno começou mês passado, cobra tudo.
    
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const recentDueDates = dueDates.filter(d => d >= ninetyDaysAgo)

    // Se a lista filtrada estiver vazia, usa a original (caso recente)
    // Se tiver cheia, usa a filtrada para o Dashboard?
    // O usuário quer saber se tem alguem devendo AGORA.
    // Vamos usar a regra: Considera apenas os últimos 3 meses para fins de "Alerta de Dashboard"
    
    const targetDueDates = recentDueDates.length > 0 ? recentDueDates : dueDates.slice(-3) // Pega as ultimas 3 se não tiver recentes no filtro (caso raro)
    
    // Para cada data de vencimento, verifica se existe pagamento
    // A verificação deve ser tolerante ou exata?
    // O sistema grava due_date como YYYY-MM-DD.
    
    for (const due of targetDueDates) {
        const dueStr = due.toISOString().split('T')[0]
        
        // Procura pagamento
        const hasPayment = payments.some(p => {
            // Verifica match de data de vencimento
            if (p.dueDate === dueStr) return true
            
            // Fallback: Verifica ref_month se disponível (para mensais)
            if (plan.frequency !== 'weekly' && p.monthRef) {
                const pDate = new Date(p.monthRef)
                // Checa se é o mesmo mês/ano
                if (pDate.getMonth() === due.getMonth() && pDate.getFullYear() === due.getFullYear()) {
                    return true
                }
            }
            return false
        })
        
        if (!hasPayment) {
            return true // Achou uma conta não paga no passado recente
        }
    }
    
    return false
}
