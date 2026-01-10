import { useEffect, useState } from 'react'
import { listStudentsByPersonal, toggleStudentActive, type StudentRecord } from '../../store/students'
import { supabase } from '../../lib/supabase'

export default function ToggleActive() {
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loading, setLoading] = useState(true)
  
  // Estado do Modal
  const [confirmModal, setConfirmModal] = useState<{ open: boolean, student: StudentRecord | null }>({ open: false, student: null })

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        const list = await listStudentsByPersonal(user.id)
        setStudents(list)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleToggleClick = (s: StudentRecord) => {
    const isActivating = s.status !== 'ativo'
    
    // Se for reativar, faz direto
    if (isActivating) {
        doToggle(s)
    } else {
        // Se for inativar, abre o modal
        setConfirmModal({ open: true, student: s })
    }
  }

  const doToggle = async (s: StudentRecord) => {
    const isActivating = s.status !== 'ativo'
    const next = isActivating ? 'ativo' : 'inativo'
    
    // Atualiza no banco
    await toggleStudentActive(s.id, next)
    
    // Atualiza localmente
    setStudents(prev => prev.map(st => st.id === s.id ? { ...st, status: next } : st))
    
    // Fecha modal se estiver aberto
    setConfirmModal({ open: false, student: null })
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div>
      <h1>Alunos • Inativar/Reativar Aluno</h1>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 8, fontWeight: 600, padding: '6px 10px' }}>
            <div>Nome</div>
            <div>Email</div>
            <div>Status</div>
            <div>Ação</div>
        </div>
        {students.map((s) => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 8, alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
            <div>{s.name}</div>
            <div>{s.email}</div>
            <div>{s.status}</div>
            <div>
              <button 
                className="btn" 
                onClick={() => handleToggleClick(s)}
                style={{ background: s.status === 'ativo' ? '#dc2626' : '#16a34a' }}
              >
                {s.status === 'ativo' ? 'Inativar' : 'Reativar'}
              </button>
            </div>
          </div>
        ))}
        {students.length === 0 && <div>Nenhum aluno cadastrado.</div>}
      </div>

      {/* Modal Customizado */}
      {confirmModal.open && confirmModal.student && (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{ background: '#fff', padding: 24, borderRadius: 12, maxWidth: 400, width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                <h3 style={{ marginTop: 0, color: '#dc2626' }}>Atenção: Inativar Aluno</h3>
                <p style={{ lineHeight: 1.5 }}>
                    Você está prestes a inativar o aluno <strong>{confirmModal.student.name}</strong>.
                </p>
                <p style={{ lineHeight: 1.5, marginBottom: 20 }}>
                    Com isso, ele <strong>NÃO conseguirá mais acessar a plataforma</strong> até que seja reativado.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button 
                        className="btn" 
                        onClick={() => setConfirmModal({ open: false, student: null })}
                        style={{ background: '#e5e7eb', color: '#374151' }}
                    >
                        Cancelar
                    </button>
                    <button 
                        className="btn" 
                        onClick={() => doToggle(confirmModal.student!)}
                        style={{ background: '#dc2626', color: '#fff' }}
                    >
                        Confirmar Inativação
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}
