import { useState, useEffect } from 'react'
import { getPlan, updatePlan, type PlanFrequency } from '../../store/plans'
import { supabase } from '../../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function PlanEdit() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const id = params.get('id')
  
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [frequency, setFrequency] = useState<PlanFrequency>('monthly')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
        navigate('/protocols/plans')
        return
    }
    
    async function load() {
        const p = await getPlan(id!)
        if (p) {
            setName(p.name)
            setPrice(String(p.price))
            setDueDay(String(p.dueDay))
            setFrequency(p.frequency || 'monthly')
        }
        setLoading(false)
    }
    load()
  }, [id, navigate])

  const save = async () => {
    if (!id) return
    const n = name.trim()
    const v = Number(price)
    
    if (!n || !isFinite(v) || v < 0) { setMsg('Informe nome e preço válido'); return }
    
    setLoading(true)
    const ok = await updatePlan(id, { name: n, price: v, frequency })
    setLoading(false)
    
    if (ok) {
        setMsg(`Plano atualizado com sucesso!`)
        setTimeout(() => navigate('/protocols/plans'), 1500)
    } else {
        setMsg('Erro ao atualizar plano')
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Editar Plano</h1>
        <button 
            className="btn" 
            style={{ background: '#fff', color: '#64748b', border: '1px solid #cbd5e1' }}
            onClick={() => navigate('/protocols/plans')}
        >
            Cancelar
        </button>
      </div>

      <div className="form-card" style={{ padding: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <label className="label">
                Nome do Plano
                <input 
                    className="input" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Ex: Mensal Básico"
                />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <label className="label">
                    Preço (R$)
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>R$</span>
                        <input 
                            type="number" 
                            step="0.01" 
                            className="input" 
                            style={{ paddingLeft: 40 }}
                            value={price} 
                            onChange={(e) => setPrice(e.target.value)} 
                            placeholder="0,00"
                        />
                    </div>
                </label>

                <label className="label">
                    Periodicidade (Cobrança)
                    <select 
                        className="select" 
                        value={frequency} 
                        onChange={(e) => setFrequency(e.target.value as PlanFrequency)}
                    >
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                        <option value="bimonthly">Bimestral</option>
                        <option value="quarterly">Trimestral</option>
                        <option value="semiannual">Semestral</option>
                        <option value="annual">Anual</option>
                    </select>
                </label>
            </div>

            {msg && (
                <div style={{ 
                    padding: '12px', 
                    borderRadius: 8, 
                    background: msg.includes('Erro') ? '#fee2e2' : '#dcfce7',
                    color: msg.includes('Erro') ? '#dc2626' : '#16a34a',
                    fontWeight: 500
                }}>
                    {msg}
                </div>
            )}

            <button 
                className="btn" 
                onClick={save} 
                disabled={loading}
                style={{ 
                    padding: '14px', 
                    fontSize: '1.1em', 
                    marginTop: 10,
                    background: 'var(--personal-primary)'
                }}
            >
                {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
        </div>
      </div>
    </div>
  )
}
