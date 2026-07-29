import { ArrowRight, BadgeCheck, ChartNoAxesCombined, Dumbbell, ShieldCheck, Smartphone } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'

const highlights = [
  'Prescreva treino, dieta e anamnese em um fluxo unico',
  'Entregue experiencia premium para o aluno no app',
  'Tenha mais clareza de financeiro, pendencias e operacao',
]

const modules = [
  {
    icon: Dumbbell,
    title: 'Painel do personal',
    description: 'Gestao de alunos, protocolos, evolucao e acompanhamento profissional.',
  },
  {
    icon: Smartphone,
    title: 'Experiencia do aluno',
    description: 'Acesso ao treino, dieta, anamnese e evolucao em uma jornada clara e intuitiva.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Operacao e crescimento',
    description: 'Visao de dashboard, notificacoes e financeiro para escalar com controle.',
  },
  {
    icon: ShieldCheck,
    title: 'Fluxo de acesso e seguranca',
    description: 'Pagina publica de reset de senha com branding proprio da FitBodyPro.',
  },
]

const plans = [
  { name: 'Start', note: 'Para quem esta comecando', price: 'R$ 14/mes', limit: 'Ate 3 alunos' },
  { name: 'Pro', note: 'Para escalar sem travas', price: 'R$ 45/mes', limit: 'Alunos ilimitados' },
]

export function HomePage() {
  return (
    <div className="marketing-shell">
      <header className="marketing-header">
        <BrandMark compact />
        <nav className="marketing-nav" aria-label="Navegacao da landing">
          <a href="#modulos">Modulos</a>
          <a href="#planos">Planos</a>
          <a href="#acesso">Acesso</a>
        </nav>
        <a className="nav-cta" href="https://gerencialalunos.vercel.app/login" target="_blank" rel="noreferrer">
          Acessar painel
        </a>
      </header>

      <main className="marketing-main">
        <section className="hero-block">
          <div className="hero-copy">
            <div className="hero-badge">
              <BadgeCheck size={16} />
              <span>Marca propria, acesso proprio e reset de senha proprio</span>
            </div>
            <BrandMark />
            <h1>Seu ecossistema digital para atender melhor, vender melhor e crescer com metodo.</h1>
            <p className="hero-description">
              A FitBodyPro organiza treino, dieta, anamnese, evolucao fotografica, financeiro e experiencia do aluno
              em uma operacao moderna, com identidade premium e dominio proprio.
            </p>

            <div className="hero-actions">
              <a className="primary-cta" href="#planos">
                Quero ver os planos
                <ArrowRight size={18} />
              </a>
              <a className="secondary-cta" href="/reset-password">
                Ver pagina de reset
              </a>
            </div>

            <ul className="hero-points">
              {highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="hero-showcase">
            <div className="showcase-card showcase-primary">
              <p className="showcase-label">Painel premium para personal</p>
              <h2>Performance, organizacao e autoridade em um unico produto.</h2>
              <p>
                A nova presenca da FitBodyPro permite separar claramente o site da marca do painel operacional,
                elevando percepcao de valor e confianca.
              </p>
            </div>

            <div className="showcase-grid">
              <article className="showcase-card">
                <strong>App do aluno</strong>
                <span>Acompanhe treinos, dieta e evolucao.</span>
              </article>
              <article className="showcase-card">
                <strong>Financeiro</strong>
                <span>Mais controle e mais leitura da operacao.</span>
              </article>
              <article className="showcase-card">
                <strong>Reset proprio</strong>
                <span>Experiencia mais confiavel e com a sua cara.</span>
              </article>
              <article className="showcase-card">
                <strong>Dominio proprio</strong>
                <span>Marca forte para landing e subdominio para app.</span>
              </article>
            </div>
          </div>
        </section>

        <section className="section-block" id="modulos">
          <div className="section-heading">
            <span>Estrutura recomendada</span>
            <h2>Um unico repositorio, duas experiencias bem separadas.</h2>
            <p>
              A melhor arquitetura agora e manter o mesmo GitHub repo, usar a pasta `landing/` para o site publico e
              manter o `personal/` como app separado na Vercel.
            </p>
          </div>

          <div className="module-grid">
            {modules.map(({ icon: Icon, title, description }) => (
              <article className="module-card" key={title}>
                <div className="module-icon">
                  <Icon size={22} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block plans-block" id="planos">
          <div className="section-heading">
            <span>Posicionamento</span>
            <h2>Uma landing que vende o produto e apoia os fluxos publicos da marca.</h2>
          </div>

          <div className="plans-grid">
            {plans.map((plan) => (
              <article className={`plan-card ${plan.name === 'Pro' ? 'plan-card-featured' : ''}`} key={plan.name}>
                <p className="plan-note">{plan.note}</p>
                <h3>{plan.name}</h3>
                <strong>{plan.price}</strong>
                <span>{plan.limit}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block access-block" id="acesso">
          <div className="access-card">
            <div>
              <span>Deploy recomendado</span>
              <h2>Nao precisa criar outro repositorio no GitHub.</h2>
              <p>
                Use este mesmo repo e publique a `landing/` em um projeto proprio na Vercel. Exemplo de estrutura:
                `www.fitbodyproapp.com` para a landing e `app.fitbodyproapp.com` para o painel do personal.
              </p>
            </div>

            <div className="access-actions">
              <a className="primary-cta" href="/reset-password">
                Abrir reset de senha
                <ArrowRight size={18} />
              </a>
              <a
                className="secondary-cta"
                href="https://gerencialalunos.vercel.app/login"
                target="_blank"
                rel="noreferrer"
              >
                Login atual do personal
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
