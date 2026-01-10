import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function TestConnection() {
  const [status, setStatus] = useState('Testando conexão...')
  const [details, setDetails] = useState('')
  const [envInfo, setEnvInfo] = useState('')

  useEffect(() => {
    async function check() {
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      setEnvInfo(`URL: ${url ? 'Configurada' : 'Ausente'}\nKey: ${key ? 'Configurada' : 'Ausente'}`)

      if (!url || !key) {
        setStatus('Erro de Configuração')
        setDetails('Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas.')
        return
      }

      try {
        // Tenta buscar status do serviço (ping simples que não exige tabela)
        // Se responder, a conexão está OK. Se der erro de tabela não encontrada ou RLS, também confirma conexão.
        const { error, status, statusText } = await supabase.from('profiles').select('count', { count: 'exact', head: true })
        
        // Código 401 ou 403 geralmente é RLS (permissão), o que significa que conectou!
        // Código 404 ou 400 pode ser tabela inexistente (conectou, mas falta SQL)
        // Código 200 é sucesso total
        
        if (!error || (status >= 400 && status < 500)) {
           setStatus('Conectado com Sucesso!')
           setDetails(`Status: ${status} ${statusText}\n${error ? 'Nota: Retorno de erro esperado (RLS/Tabela), mas a conexão HTTP ocorreu.' : 'Tabela acessível.'}\nDetalhe: ${error?.message || 'OK'}`)
        } else {
           setStatus(`Erro na Conexão`)
           setDetails(`Status: ${status} ${statusText}\nErro: ${JSON.stringify(error, null, 2)}`)
        }
      } catch (err: any) {
        setStatus('Erro de Rede / Cliente')
        setDetails(err.message || String(err))
      }
    }
    check()
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <h1>Teste de Conexão Supabase</h1>
      
      <div style={{ marginBottom: 20, padding: 15, background: '#f1f5f9', borderRadius: 8 }}>
        <strong>Configuração Local:</strong>
        <pre style={{ marginTop: 10 }}>{envInfo}</pre>
      </div>

      <div style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 8, background: status.includes('Sucesso') ? '#dcfce7' : '#fee2e2' }}>
        <h2 style={{ margin: 0, color: status.includes('Sucesso') ? '#166534' : '#991b1b' }}>{status}</h2>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Detalhes Técnicos:</h3>
        <pre style={{ background: '#1e293b', color: '#fff', padding: 20, borderRadius: 8, overflow: 'auto' }}>
          {details}
        </pre>
      </div>

      <div style={{ marginTop: 40 }}>
        <a href="/" style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 'bold' }}>&larr; Voltar para Dashboard</a>
      </div>
    </div>
  )
}
