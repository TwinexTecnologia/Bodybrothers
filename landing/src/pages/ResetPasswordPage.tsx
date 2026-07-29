import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { hasSupabaseEnv, supabase } from '../lib/supabase'

type ResetStatus = 'idle' | 'checking' | 'ready' | 'submitting' | 'success' | 'error'

const personalLoginUrl = import.meta.env.VITE_PERSONAL_LOGIN_URL || 'https://gerencialalunos.vercel.app/login'

function getRecoveryCode() {
  const url = new URL(window.location.href)
  return url.searchParams.get('code')
}

function getHashSession() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')

  if (!accessToken || !refreshToken) return null

  return { accessToken, refreshToken }
}

export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [status, setStatus] = useState<ResetStatus>('checking')
  const [message, setMessage] = useState('Validando link de redefinicao...')

  const passwordsMatch = useMemo(
    () => password.length >= 6 && confirmPassword.length >= 6 && password === confirmPassword,
    [confirmPassword, password],
  )

  useEffect(() => {
    async function prepareRecoverySession() {
      if (!hasSupabaseEnv || !supabase) {
        setStatus('error')
        setMessage('As variaveis do Supabase ainda nao foram configuradas para esta landing.')
        return
      }

      try {
        const recoveryCode = getRecoveryCode()
        const hashSession = getHashSession()

        if (recoveryCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(recoveryCode)
          if (error) throw error
        } else if (hashSession) {
          const { error } = await supabase.auth.setSession({
            access_token: hashSession.accessToken,
            refresh_token: hashSession.refreshToken,
          })
          if (error) throw error
        } else {
          const { data } = await supabase.auth.getSession()
          if (!data.session) {
            throw new Error('Link de recuperacao invalido ou expirado.')
          }
        }

        setStatus('ready')
        setMessage('Digite sua nova senha abaixo para concluir o acesso.')
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Nao foi possivel validar o link de recuperacao.')
      }
    }

    void prepareRecoverySession()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase) {
      setStatus('error')
      setMessage('Supabase nao configurado para esta landing.')
      return
    }

    if (password.length < 6) {
      setStatus('error')
      setMessage('A senha precisa ter no minimo 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setStatus('error')
      setMessage('As senhas nao conferem.')
      return
    }

    setStatus('submitting')
    setMessage('Atualizando senha...')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus('error')
      setMessage(error.message || 'Nao foi possivel redefinir a senha.')
      return
    }

    setStatus('success')
    setMessage('Senha redefinida com sucesso. Agora voce ja pode voltar para o login.')
  }

  return (
    <div className="reset-shell">
      <div className="reset-orb reset-orb-left" />
      <div className="reset-orb reset-orb-right" />

      <main className="reset-card">
        <BrandMark />

        <div className="reset-lock">
          <LockKeyhole size={34} />
        </div>

        <header className="reset-header">
          <h1>Redefinir senha</h1>
          <p>{message}</p>
        </header>

        <form className="reset-form" onSubmit={handleSubmit}>
          <label className="field-group">
            <span>Nova senha</span>
            <div className="field-shell">
              <LockKeyhole size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua nova senha"
                disabled={!['ready', 'error'].includes(status)}
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label="Mostrar senha">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <small>Minimo de 6 caracteres</small>
          </label>

          <label className="field-group">
            <span>Repita a nova senha</span>
            <div className="field-shell">
              <LockKeyhole size={18} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Digite novamente sua senha"
                disabled={!['ready', 'error'].includes(status)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                aria-label="Mostrar confirmacao da senha"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button
            className="reset-button"
            type="submit"
            disabled={status === 'checking' || status === 'submitting' || status === 'success'}
          >
            {status === 'submitting' ? 'Redefinindo...' : 'Redefinir senha'}
          </button>
        </form>

        <div className="reset-footer">
          <a href={personalLoginUrl} target="_blank" rel="noreferrer">
            <ArrowLeft size={16} />
            {status === 'success' ? 'Ir para o login do personal' : 'Voltar para o login'}
          </a>
          {status === 'ready' && password && confirmPassword && !passwordsMatch && (
            <p className="reset-warning">As senhas precisam ser iguais para continuar.</p>
          )}
        </div>
      </main>
    </div>
  )
}
