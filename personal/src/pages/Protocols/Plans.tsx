import { useEffect, useState } from 'react'
import { listPlans, deletePlan, type PlanRecord } from '../../store/plans'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Plans() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        const list = await listPlans(user.id)
        setPlans(list)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const remove = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este plano? Isso não afeta alunos que já o possuem.')) return
    await deletePlan(id)
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div>Carregando...</div>

  const frequencyMap: Record<string, string> = {
      weekly: 'Semanal',
      monthly: 'Mensal',
      bimonthly: 'Bimestral',
      quarterly: 'Trimestral',
      semiannual: 'Semestral',
      annual: 'Anual'
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
            <h1 style={{ margin: 0 }}>Protocolos • Planos</h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>Gerencie os planos de assinatura disponíveis para seus alunos.</p>
        </div>
        <button 
            className="btn" 
            onClick={() => navigate('/protocols/plan-create')}
            style={{ padding: '12px 24px', fontSize: '1em', background: 'var(--personal-primary)' }}
        >
            + Novo Plano
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
        {plans.map(p => {
          const freqLabel = frequencyMap[p.frequency || 'monthly']
          const suffix = p.frequency === 'weekly' ? '/sem' : p.frequency === 'annual' ? '/ano' : '/mês'
          
          return (
          <div key={p.id} style={{ 
              background: '#fff', 
              borderRadius: 12, 
              padding: 24, 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              border: '1px solid #f1f5f9',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%'
          }}>
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1.25em', color: '#1e293b' }}>{p.name}</h3>
                    <span style={{ fontSize: '0.75em', background: '#f1f5f9', padding: '4px 8px', borderRadius: 12, color: '#64748b', fontWeight: 600 }}>
                        {freqLabel}
                    </span>
                </div>
                <div style={{ fontSize: '2em', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.5em', fontWeight: 500, verticalAlign: 'top', marginRight: 4 }}>R$</span>
                    {p.price.toFixed(2).replace('.', ',')}
                    <span style={{ fontSize: '0.4em', color: '#64748b', fontWeight: 400 }}> {suffix}</span>
                </div>
            </div>
            
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button 
                className="btn" 
                style={{ background: '#f1f5f9', color: '#334155', padding: '8px 16px', fontSize: '0.9em' }} 
                onClick={() => navigate(`/protocols/plan-edit?id=${p.id}`)}
              >
                Editar
              </button>
              <button 
                className="btn" 
                style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 16px', fontSize: '0.9em' }} 
                onClick={() => remove(p.id)}
              >
                Excluir
              </button>
            </div>
          </div>
        )})}
        
        {plans.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, background: '#f8fafc', borderRadius: 12, border: '2px dashed #e2e8f0', color: '#94a3b8' }}>
                <div style={{ fontSize: '2em', marginBottom: 10 }}>🏷️</div>
                Nenhum plano cadastrado. Clique no botão acima para criar o primeiro.
            </div>
        )}
      </div>
    </div>
  )
}
