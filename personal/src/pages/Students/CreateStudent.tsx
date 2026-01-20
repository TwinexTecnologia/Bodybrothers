import { useEffect, useState } from 'react'
import { addStudent } from '../../store/students'
import { listPlans, type PlanRecord } from '../../store/plans'
import { supabase } from '../../lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Cria um cliente secundário ISOLADO para não deslogar o personal ao criar aluno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cliente descartável que não salva sessão no localStorage
const supabaseCreator = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Isso impede que o login do novo aluno sobrescreva o do personal!
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
})

export default function CreateStudent() {
  const [personalId, setPersonalId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [planId, setPlanId] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
            setPersonalId(user.id)
            const p = await listPlans(user.id)
            setPlans(p)
        }
    })
  }, [])

  const onCepBlur = async () => {
    const onlyDigits = cep.replace(/\D/g, '')
    if (onlyDigits.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${onlyDigits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setStreet(data.logradouro || '')
        setNeighborhood(data.bairro || '')
        setCity(data.localidade || '')
        setState(data.uf || '')
      }
    } catch { void 0 }
  }

  const save = async () => {
    if (!name.trim() || !email.trim()) return setMsg('Preencha nome e email')
    if (!personalId) return setMsg('Erro: Personal não identificado.')

    setLoading(true)
    setMsg('')

    try {
       console.log('Tentando criar usuário:', { email, personalId })
       
       // Usa o cliente ISOLADO para criar o usuário
       const { data, error } = await supabaseCreator.auth.signUp({
            email,
            password: tempPassword || 'mudar123',
            options: {
                data: {
                    full_name: name,
                    role: 'aluno',
                    personal_id: personalId,
                    created_by: personalId
                }
            }
        })

        console.log('Resposta do signUp:', { data, error })

        if (error) throw error

        if (data.user) {
            console.log('Usuário Auth criado com ID:', data.user.id)
            
            // O cliente principal (Personal) ainda está logado e tem permissão para editar profiles
            // Atualiza os dados extras do aluno recém-criado
            const updates = {
                data: {
                    email: email, // Salva o email no JSON também para facilitar listagem
                    address: { cep, street, neighborhood, city, state, number, complement },
                    planId: planId || undefined,
                    tempPassword: tempPassword
                }
            }
            
            // Tenta atualizar o profile. 
            // O trigger handle_new_user DEVE ter criado o profile automaticamente.
            
            // Tenta criar/atualizar o profile MANUALMENTE para garantir
            // Como o RLS está desativado, isso vai funcionar.
            // Usamos upsert para cobrir tanto o caso de criação quanto atualização.
            const { error: upsertError } = await supabase.from('profiles').upsert({
                id: data.user.id,
                full_name: name,
                role: 'aluno',
                personal_id: personalId,
                data: updates.data
            })
            
            if (upsertError) {
                 console.error('Erro ao criar/atualizar profile:', upsertError)
                 setMsg(`Aluno criado no Auth! (Erro no perfil: ${upsertError.message})`)
            } else {
                 setMsg('Aluno criado com sucesso!')
                 // Limpa form apenas se deu tudo certo
                 setName('')
                 setEmail('')
                 setWhatsapp('')
                 setTempPassword('')
                 setCep('')
                 setStreet('')
                 setNeighborhood('')
                 setCity('')
                 setState('')
                 setNumber('')
                 setComplement('')
                 setPlanId('')
            }
        } else {
            // Se data.user for null, pode ser que o signUp exija confirmação de email e não retornou sessão?
            // Normalmente retorna user mesmo assim, mas com identity unverified.
            console.warn('SignUp retornou sucesso mas sem data.user?')
            setMsg('Aviso: Solicitação enviada, mas usuário não retornado imediatamente. Verifique seu email.')
        }

    } catch (err: any) {
        console.error('Erro geral:', err)
        if (err.message && err.message.includes('already registered')) {
            setMsg('Erro: Este email já está cadastrado.')
        } else {
            setMsg(`Erro ao criar aluno: ${err.message || JSON.stringify(err)}`)
        }
    } finally {
        setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <h1>Alunos • Criar Aluno</h1>
      <div className="form-card">
        <div className="form-title">Dados pessoais</div>
        <div className="form-grid">
          <label className="label">
            Nome
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="label">
            Email
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>

        <div className="form-section">
          <div className="form-title">Acesso</div>
          <label className="label">
            Senha provisória
            <input className="input" type="password" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} placeholder="Opcional (padrão: mudar123)" />
          </label>
        </div>

        <div className="form-section">
          <div className="form-title">Endereço</div>
          <div className="form-grid-3">
            <label className="label">
              CEP
              <input className="input" value={cep} onChange={(e) => setCep(e.target.value)} onBlur={onCepBlur} placeholder="Somente números" />
            </label>
            <label className="label">
              Rua
              <input className="input" value={street} onChange={(e) => setStreet(e.target.value)} />
            </label>
            <label className="label">
              Bairro
              <input className="input" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </label>
            <label className="label">
              Cidade
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <label className="label">
              Estado
              <input className="input" value={state} onChange={(e) => setState(e.target.value)} />
            </label>
            <label className="label">
              Número
              <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} />
            </label>
            <label className="label">
              Complemento
              <input className="input" value={complement} onChange={(e) => setComplement(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="form-section">
          <div className="form-title">Plano</div>
          <label className="label">
            Plano contratado
            <select className="select" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Selecione um plano</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} • R$ {p.price.toFixed(2)} • Venc. dia {p.dueDay}</option>)}
            </select>
          </label>
        </div>

        {msg && <div className={`form-${msg.includes('Erro') ? 'error' : 'success'}`}>{msg}</div>}
        <div className="form-actions">
          <button className="btn" onClick={save} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}
