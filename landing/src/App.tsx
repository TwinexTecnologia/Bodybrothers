import fitbodyIcon from './assets/fitbody-icon.png'
import './App.css'

const benefits = [
  {
    title: 'Prescreva com rapidez',
    description:
      'Monte treinos, dietas e protocolos em um fluxo simples para ganhar tempo no atendimento.',
  },
  {
    title: 'Acompanhe a evolucao',
    description:
      'Centralize anamnese, evolucao fotografica, historico e informacoes importantes do aluno.',
  },
  {
    title: 'Organize sua operacao',
    description:
      'Tenha dashboard, notificacoes, financeiro e uma visao mais profissional da sua carteira.',
  },
]

const featureGroups = [
  {
    title: 'Atendimento',
    items: [
      'Cadastro e gerenciamento de alunos',
      'Prescricao de treinos e dietas',
      'Anamnese e protocolos organizados',
      'Visualizacao da jornada do aluno',
    ],
  },
  {
    title: 'Engajamento',
    items: [
      'App do aluno com experiencia mobile',
      'Acompanhamento de evolucao fotografica',
      'Notificacoes e acompanhamento continuo',
      'Rotina mais profissional para personal e aluno',
    ],
  },
  {
    title: 'Gestao',
    items: [
      'Dashboard para leitura da operacao',
      'Controle financeiro e historicos',
      'Mais clareza sobre alunos e entregas',
      'Base pronta para crescer com consistencia',
    ],
  },
]

const plans = [
  {
    name: 'Experimente',
    audience: 'Para conhecer a plataforma',
    students: '1 aluno',
    price: 'Gratis',
    description:
      'Acesso full para testar toda a experiencia do FITBODY PRO na pratica antes de escalar.',
    highlights: [
      'Todas as funcionalidades liberadas',
      'Ideal para demonstracao e validacao',
      'Entrada simples para conhecer o sistema',
    ],
    featured: false,
    cta: 'Quero testar',
  },
  {
    name: 'Start',
    audience: 'Para quem esta comecando',
    students: 'Ate 3 alunos',
    price: 'R$ 14/mes',
    description:
      'Acesso completo com limite enxuto de alunos para iniciar com baixo custo e boa entrega.',
    highlights: [
      'Treinos, dietas e anamnese',
      'App do aluno incluso',
      'Estrutura ideal para comecar atendendo bem',
    ],
    featured: false,
    cta: 'Comecar agora',
  },
  {
    name: 'Pro',
    audience: 'Para crescer sem travas',
    students: 'Alunos ilimitados',
    price: 'R$ 45/mes',
    description:
      'Plano pensado para quem quer escalar a operacao com acompanhamento, organizacao e mais controle.',
    highlights: [
      'Tudo liberado sem limite de alunos',
      'Melhor custo beneficio para operacao',
      'Mais espaco para crescer e faturar',
    ],
    featured: true,
    cta: 'Quero o ilimitado',
  },
]

const steps = [
  'Crie sua conta e teste tudo com 1 aluno.',
  'Monte treinos, dietas e protocolos em poucos minutos.',
  'Acompanhe o aluno no app e evolua de plano conforme sua carteira cresce.',
]

const faqItems = [
  {
    question: 'O plano de entrada tem acesso total?',
    answer:
      'Sim. A ideia e permitir que o personal conheca toda a plataforma antes de escalar o numero de alunos.',
  },
  {
    question: 'O que muda entre os planos?',
    answer:
      'A principal diferenca e a quantidade de alunos atendidos, mantendo a experiencia completa do produto.',
  },
  {
    question: 'O FITBODY PRO tem app para o aluno?',
    answer:
      'Sim. O ecossistema contempla painel web para o personal e experiencia mobile para o aluno.',
  },
]

function App() {
  return (
    <div className="page-shell">
      <header className="topbar">
        <a className="brand" href="#hero">
          <img src={fitbodyIcon} alt="FITBODY PRO" />
          <div>
            <strong>FITBODY PRO</strong>
            <span>SaaS para personal trainer</span>
          </div>
        </a>

        <nav className="nav-links" aria-label="Navegacao principal">
          <a href="#beneficios">Beneficios</a>
          <a href="#funcionalidades">Funcionalidades</a>
          <a href="#planos">Planos</a>
          <a href="#faq">FAQ</a>
        </nav>

        <a className="ghost-button" href="#planos">
          Ver planos
        </a>
      </header>

      <main>
        <section className="hero-section" id="hero">
          <div className="hero-copy">
            <span className="eyebrow">Mais organizacao, mais entrega, mais escala</span>
            <h1>
              Venda melhor o seu servico com uma plataforma completa para personal
              trainer.
            </h1>
            <p className="hero-text">
              O FITBODY PRO centraliza alunos, treinos, dietas, anamnese, evolucao
              fotografica, notificacoes, financeiro e app do aluno em uma so
              experiencia.
            </p>

            <div className="hero-actions">
              <a className="primary-button" href="#planos">
                Quero ver os planos
              </a>
              <a className="secondary-button" href="#funcionalidades">
                Conhecer funcionalidades
              </a>
            </div>

            <div className="hero-notes">
              <span>1 aluno para testar tudo</span>
              <span>Acesso full desde o primeiro contato</span>
              <span>Planos por quantidade de alunos</span>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-card hero-card-main">
              <p className="panel-label">Ecossistema FITBODY PRO</p>
              <h2>Seu atendimento do treino ao financeiro.</h2>
              <p>
                Entregue uma experiencia mais premium para o aluno e ganhe mais
                clareza na operacao do seu negocio.
              </p>
            </div>

            <div className="hero-grid">
              <article className="hero-card">
                <span className="stat-number">Treinos</span>
                <p>Prescricao rapida com visual profissional.</p>
              </article>
              <article className="hero-card">
                <span className="stat-number">Dietas</span>
                <p>Montagem e edicao organizadas para o dia a dia.</p>
              </article>
              <article className="hero-card">
                <span className="stat-number">Aluno app</span>
                <p>Experiencia mobile para acompanhamento continuo.</p>
              </article>
              <article className="hero-card">
                <span className="stat-number">Financeiro</span>
                <p>Mais controle sobre pagamentos e operacao.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="benefits-section" id="beneficios">
          <div className="section-heading">
            <span className="eyebrow">Por que escolher o FITBODY PRO</span>
            <h2>Uma plataforma feita para simplificar sua rotina e valorizar sua entrega.</h2>
            <p>
              O foco nao e so montar treino. E profissionalizar o atendimento, ganhar
              tempo e abrir espaco para crescer.
            </p>
          </div>

          <div className="benefits-grid">
            {benefits.map((benefit) => (
              <article className="benefit-card" key={benefit.title}>
                <h3>{benefit.title}</h3>
                <p>{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="features-section" id="funcionalidades">
          <div className="section-heading section-heading-left">
            <span className="eyebrow">Tudo em um so lugar</span>
            <h2>Estrutura completa para atender melhor e crescer com consistencia.</h2>
          </div>

          <div className="feature-groups">
            {featureGroups.map((group) => (
              <article className="feature-card" key={group.title}>
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="journey-section">
          <div className="journey-copy">
            <span className="eyebrow">Modelo comercial mais simples</span>
            <h2>Conheca tudo primeiro. Cresca depois.</h2>
            <p>
              Em vez de esconder funcionalidades, o FITBODY PRO libera a experiencia
              completa desde o inicio e faz o crescimento acontecer pela quantidade de
              alunos.
            </p>
          </div>

          <div className="journey-steps">
            {steps.map((step, index) => (
              <article className="step-card" key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pricing-section" id="planos">
          <div className="section-heading">
            <span className="eyebrow">Planos pensados para conversao</span>
            <h2>Comece com pouco, entregue muito e evolua junto com sua carteira.</h2>
            <p>
              Estrutura comercial inspirada em simplicidade: acesso total ao sistema e
              crescimento por quantidade de alunos.
            </p>
          </div>

          <div className="pricing-grid">
            {plans.map((plan) => (
              <article
                className={`pricing-card${plan.featured ? ' pricing-card-featured' : ''}`}
                key={plan.name}
              >
                {plan.featured && <span className="pricing-badge">Melhor custo beneficio</span>}
                <p className="plan-audience">{plan.audience}</p>
                <h3>{plan.students}</h3>
                <strong className="plan-price">{plan.price}</strong>
                <p className="plan-description">{plan.description}</p>
                <ul>
                  {plan.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
                <a className="plan-button" href="#contato">
                  {plan.cta}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="faq-section" id="faq">
          <div className="section-heading section-heading-left">
            <span className="eyebrow">FAQ</span>
            <h2>Perguntas que ajudam na conversao.</h2>
          </div>

          <div className="faq-list">
            {faqItems.map((item) => (
              <article className="faq-item" key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta-section" id="contato">
          <div>
            <span className="eyebrow">Pronto para vender esta oferta</span>
            <h2>Use esta landing para captar personals e apresentar seus planos com clareza.</h2>
            <p>
              A proxima etapa e conectar seus links reais de WhatsApp, checkout ou
              formulario para transformar visitas em conversas.
            </p>
          </div>

          <div className="cta-actions">
            <a className="primary-button" href="#hero">
              Revisar oferta
            </a>
            <a className="secondary-button" href="#planos">
              Ir para os planos
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
