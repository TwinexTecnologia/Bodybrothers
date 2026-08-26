import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Camera,
  ClipboardList,
  CreditCard,
  Dumbbell,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  UserRound,
  Utensils,
} from 'lucide-react'
import { helpDocuments, type HelpDocument, type HelpSection } from '../../content/helpCenterContent'
import dashboardImage from '../../assets/help-center-custom/dashboard.png'
import studentsImage from '../../assets/help-center-custom/students.png'
import financialImage from '../../assets/help-center-custom/financial.png'
import plansImage from '../../assets/help-center-custom/plans.png'
import anamnesisImage from '../../assets/help-center-custom/anamnesis.png'
import supportImage from '../../assets/help-center/support.png'
import workoutsImage from '../../assets/help-center-custom/workouts.png'
import bibliotecaImage from '../../assets/help-center-custom/biblioteca.png'
import dietsImage from '../../assets/help-center-custom/diets.png'
import evolutionImage from '../../assets/help-center/evolution.png'
import profileImage from '../../assets/help-center/profile.png'
import crmImage from '../../assets/help-center/crm.png'
import loginImage from '../../assets/help-center/login.png'

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function matchesSection(section: HelpSection, search: string) {
  const base = [
    section.title,
    section.summary,
    ...(section.paragraphs || []),
    ...(section.bullets || []),
    ...(section.steps || []),
    section.tip || '',
  ]
    .join(' ')

  return normalizeText(base).includes(search)
}

function getSectionPreset(section: HelpSection) {
  const title = normalizeText(`${section.title} ${section.summary}`)

  if (title.includes('dashboard')) {
    return {
      icon: LayoutDashboard,
      color: '#1d4ed8',
      light: '#dbeafe',
      dark: '#0f172a',
      label: 'Visao geral da operacao',
    }
  }

  if (title.includes('aluno')) {
    return {
      icon: UserRound,
      color: '#2563eb',
      light: '#e0f2fe',
      dark: '#172554',
      label: 'Cadastro e acompanhamento',
    }
  }

  if (title.includes('financeiro') || title.includes('plano') || title.includes('pagamento')) {
    return {
      icon: CreditCard,
      color: '#0f766e',
      light: '#ccfbf1',
      dark: '#134e4a',
      label: 'Ciclo, cobranca e recebimento',
    }
  }

  if (title.includes('treino')) {
    return {
      icon: Dumbbell,
      color: '#7c3aed',
      light: '#ede9fe',
      dark: '#4c1d95',
      label: 'Biblioteca e personalizacao',
    }
  }

  if (title.includes('dieta')) {
    return {
      icon: Utensils,
      color: '#ea580c',
      light: '#ffedd5',
      dark: '#9a3412',
      label: 'Estrutura alimentar',
    }
  }

  if (title.includes('anamnese')) {
    return {
      icon: ClipboardList,
      color: '#0891b2',
      light: '#cffafe',
      dark: '#164e63',
      label: 'Coleta e revisao',
    }
  }

  if (title.includes('evolucao')) {
    return {
      icon: Camera,
      color: '#db2777',
      light: '#fce7f3',
      dark: '#831843',
      label: 'Comparacao visual',
    }
  }

  if (title.includes('crm')) {
    return {
      icon: TrendingUp,
      color: '#16a34a',
      light: '#dcfce7',
      dark: '#14532d',
      label: 'Leads e oportunidades',
    }
  }

  if (title.includes('conta') || title.includes('perfil') || title.includes('branding')) {
    return {
      icon: Settings,
      color: '#475569',
      light: '#e2e8f0',
      dark: '#0f172a',
      label: 'Ajustes da conta',
    }
  }

  if (title.includes('suporte')) {
    return {
      icon: LifeBuoy,
      color: '#dc2626',
      light: '#fee2e2',
      dark: '#7f1d1d',
      label: 'Ajuda operacional',
    }
  }

  return {
    icon: GraduationCap,
    color: '#1d4ed8',
    light: '#dbeafe',
    dark: '#0f172a',
    label: 'Guia pratico da plataforma',
  }
}

function getSectionTopics(section: HelpSection) {
  return Array.from(new Set([...(section.bullets || []), ...(section.steps || [])])).slice(0, 6)
}

function getSectionScreenshot(section: HelpSection) {
  const title = normalizeText(`${section.title} ${section.summary}`)

  if (
    section.id === 'quick-visao-geral'
    || section.id === 'quick-primeiros-passos'
    || section.id === 'manual-apresentacao'
    || section.id === 'manual-o-que-a-plataforma-faz'
    || section.id === 'manual-estrutura-geral'
    || section.id === 'manual-rotina'
  ) {
    return null
  }

  if (section.id === 'manual-financeiro') {
    return {
      src: financialImage,
      alt: 'Print enviado do financeiro do personal',
      label: 'Print enviado do financeiro',
    }
  }

  if (title.includes('login') || title.includes('recuperacao') || title.includes('primeiro acesso')) {
    return {
      src: loginImage,
      alt: 'Tela real de login do sistema do personal',
      label: 'Tela real de login do sistema',
    }
  }

  if (
    title.includes('dashboard')
    || title.includes('visao geral')
    || title.includes('primeiros passos')
  ) {
    return {
      src: dashboardImage,
      alt: 'Print enviado do dashboard do personal',
      label: 'Dashboard enviado para o resumo',
    }
  }

  if (title.includes('aluno')) {
    return {
      src: studentsImage,
      alt: 'Imagem enviada da area de alunos',
      label: 'Resumo visual enviado da area de alunos',
    }
  }

  if (title.includes('pagamento') || title.includes('financeiro')) {
    return {
      src: financialImage,
      alt: 'Print enviado do financeiro do personal',
      label: 'Print enviado do financeiro',
    }
  }

  if (title.includes('plano')) {
    return {
      src: plansImage,
      alt: 'Print enviado da area de planos do personal',
      label: 'Print enviado de planos',
    }
  }

  if (title.includes('anamnese')) {
    return {
      src: anamnesisImage,
      alt: 'Imagem enviada da area de anamneses',
      label: 'Imagem enviada de anamneses',
    }
  }

  if (title.includes('evolucao')) {
    return {
      src: evolutionImage,
      alt: 'Tela real da central de evolução',
      label: 'Tela real de evolução',
    }
  }

  if (title.includes('crm')) {
    return {
      src: crmImage,
      alt: 'Tela real do CRM do personal',
      label: 'Tela real do CRM',
    }
  }

  if (title.includes('conta') || title.includes('perfil') || title.includes('branding')) {
    return {
      src: profileImage,
      alt: 'Tela real do perfil do personal',
      label: 'Tela real do perfil',
    }
  }

  if (title.includes('suporte')) {
    return {
      src: supportImage,
      alt: 'Tela real do chat de suporte interno',
      label: 'Tela real do suporte',
    }
  }

  if (title.includes('biblioteca')) {
    return {
      src: bibliotecaImage,
      alt: 'Imagem enviada da biblioteca do sistema',
      label: 'Imagem enviada da biblioteca',
    }
  }

  if (title.includes('treino')) {
    return {
      src: workoutsImage,
      alt: 'Imagem enviada da area de treinos',
      label: 'Imagem enviada de treinos',
    }
  }

  if (title.includes('dieta')) {
    return {
      src: dietsImage,
      alt: 'Imagem enviada da area de dietas',
      label: 'Imagem enviada de dietas',
    }
  }

  return null
}

function SectionBlock({ section }: { section: HelpSection }) {
  const preset = getSectionPreset(section)
  const topics = getSectionTopics(section)
  const screenshot = getSectionScreenshot(section)
  const Icon = preset.icon

  return (
    <section
      id={section.id}
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 20,
        padding: 24,
        boxShadow: '0 16px 30px rgba(15, 23, 42, 0.06)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: preset.color,
                fontSize: '0.76rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              <Sparkles size={14} />
              {preset.label}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#0f172a' }}>{section.title}</h2>
            <p style={{ margin: 0, color: '#475569', lineHeight: 1.7 }}>{section.summary}</p>
          </div>

          {section.paragraphs && section.paragraphs.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              {section.paragraphs.slice(0, 2).map((paragraph) => (
                <p key={paragraph} style={{ margin: 0, color: '#334155', lineHeight: 1.75 }}>
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {topics.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Nesta ajuda</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {topics.map((item) => (
                  <div
                    key={item}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '8px minmax(0, 1fr)',
                      gap: 10,
                      alignItems: 'start',
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: preset.color,
                        marginTop: 9,
                      }}
                    />
                    <div style={{ color: '#334155', lineHeight: 1.7 }}>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section.tip && (
            <div
              style={{
                padding: 16,
                borderRadius: 16,
                background: preset.light,
                border: `1px solid ${preset.color}33`,
                color: preset.dark,
                lineHeight: 1.7,
              }}
            >
              <strong>Dica:</strong> {section.tip}
            </div>
          )}
        </div>

        {screenshot && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                background: '#fff',
                boxShadow: '0 12px 24px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div
                style={{
                  padding: '12px 14px',
                  background: '#fff',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: preset.light,
                    display: 'grid',
                    placeItems: 'center',
                    color: preset.color,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{section.title}</div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Tela relacionada desta area</div>
                </div>
              </div>

              <img
                src={screenshot.src}
                alt={screenshot.alt}
                style={{
                  width: '100%',
                  display: 'block',
                  background: '#f8fafc',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default function HelpCenter() {
  const [activeDocId, setActiveDocId] = useState<HelpDocument['id']>('quick')
  const [search, setSearch] = useState('')
  const [activeSectionId, setActiveSectionId] = useState<string>('')

  const normalizedSearch = useMemo(() => normalizeText(search.trim()), [search])

  const activeDoc = useMemo(
    () => helpDocuments.find((document) => document.id === activeDocId) || helpDocuments[0],
    [activeDocId],
  )

  const filteredSections = useMemo(() => {
    if (!normalizedSearch) return activeDoc.sections
    return activeDoc.sections.filter((section) => matchesSection(section, normalizedSearch))
  }, [activeDoc.sections, normalizedSearch])

  useEffect(() => {
    setActiveSectionId(filteredSections[0]?.id || '')
  }, [filteredSections, activeDocId])

  function handleJumpToSection(sectionId: string) {
    setActiveSectionId(sectionId)
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ maxWidth: 1380, margin: '0 auto', display: 'grid', gap: 20 }}>
      <section
        style={{
          borderRadius: 28,
          padding: '24px clamp(20px, 4vw, 34px)',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
          border: '1px solid #dbeafe',
          color: '#0f172a',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '-40px -30px auto auto',
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.10)',
            filter: 'blur(10px)',
          }}
        />

        <div style={{ position: 'relative', display: 'grid', gap: 18 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              borderRadius: 999,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              width: 'fit-content',
              fontWeight: 700,
              color: '#1d4ed8',
            }}
          >
            <BookOpen size={16} />
            Central de Ajuda
          </div>

          <div style={{ display: 'grid', gap: 10, maxWidth: 760 }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 3.4vw, 2.7rem)', lineHeight: 1.08, color: '#0f172a' }}>
              Central de ajuda do personal
            </h1>
            <p style={{ margin: 0, color: '#475569', lineHeight: 1.75, fontSize: '0.98rem' }}>
              Consulte rapidamente as areas da plataforma, encontre telas do sistema e navegue entre o
              guia rapido e o manual completo sem excesso de texto ou etapas.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ padding: '8px 12px', borderRadius: 999, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontWeight: 600 }}>
              2 materiais disponiveis
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 999, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontWeight: 600 }}>
              {activeDoc.sections.length} secoes nesta visao
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 999, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontWeight: 600 }}>
              Suporte interno disponivel
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 18 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 16,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 22,
            padding: 18,
            boxShadow: '0 12px 24px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {helpDocuments.map((document) => {
              const active = document.id === activeDocId
              return (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => {
                    setActiveDocId(document.id)
                    setSearch('')
                  }}
                  style={{
                    textAlign: 'left',
                    borderRadius: 18,
                    border: active ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                    background: active ? '#f8fbff' : '#fff',
                    padding: '16px 18px',
                    cursor: 'pointer',
                    boxShadow: active ? '0 8px 18px rgba(37, 99, 235, 0.08)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {document.id === 'quick' ? <BookOpen size={18} color="#1d4ed8" /> : <FileText size={18} color="#1d4ed8" />}
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{document.label}</div>
                  </div>
                  <div style={{ color: '#1d4ed8', fontSize: '0.82rem', marginTop: 8, fontWeight: 700 }}>
                    {document.tagline}
                  </div>
                  <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.65, fontSize: '0.92rem' }}>
                    {document.description}
                  </p>
                </button>
              )
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: 16,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              padding: '12px 14px',
            }}
          >
            <Search size={18} color="#64748b" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar assunto, fluxo ou funcionalidade..."
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          <aside
            style={{
              position: 'sticky',
              top: 16,
              display: 'grid',
              gap: 14,
            }}
          >
            <div
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 22,
                padding: 18,
                boxShadow: '0 16px 30px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Navegacao</div>
              <div style={{ color: '#64748b', lineHeight: 1.65, fontSize: '0.92rem', marginBottom: 16 }}>
                Escolha a secao que deseja consultar.
              </div>
              <div style={{ display: 'grid', gap: 8, maxHeight: '62vh', overflowY: 'auto', paddingRight: 4 }}>
                {filteredSections.map((section) => {
                  const active = section.id === activeSectionId
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleJumpToSection(section.id)}
                      style={{
                        textAlign: 'left',
                        border: active ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                        background: active ? '#eff6ff' : '#fff',
                        color: '#0f172a',
                        borderRadius: 16,
                        padding: '12px 14px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{section.title}</div>
                      <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 4, lineHeight: 1.55 }}>
                        {section.summary}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div
              style={{
                background: '#fff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                borderRadius: 22,
                padding: 20,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#1d4ed8' }}>
                <LifeBuoy size={18} />
                Suporte interno
              </div>
              <div style={{ color: '#64748b', lineHeight: 1.7, fontSize: '0.92rem' }}>
                Se nao encontrar o que precisa aqui, use o chat de suporte flutuante com mensagem e anexo.
              </div>
            </div>
          </aside>

          <main style={{ display: 'grid', gap: 18 }}>
            <div
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 22,
                padding: 20,
              }}
            >
              <div style={{ color: '#1d4ed8', fontWeight: 800, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {activeDoc.tagline}
              </div>
              <h2 style={{ margin: '10px 0 8px', fontSize: '1.6rem', color: '#0f172a' }}>{activeDoc.label}</h2>
              <p style={{ margin: 0, color: '#475569', lineHeight: 1.75 }}>{activeDoc.description}</p>
              {normalizedSearch && (
                <div
                  style={{
                    marginTop: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                  }}
                >
                  <Search size={14} />
                  {filteredSections.length} secao(oes) encontradas para "{search}"
                </div>
              )}
            </div>

            {filteredSections.length === 0 ? (
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 22,
                  padding: 32,
                  textAlign: 'center',
                  color: '#64748b',
                  lineHeight: 1.7,
                }}
              >
                Nenhum conteudo encontrado para essa busca. Tente procurar por termos como aluno, financeiro,
                treino, dieta, anamnese ou suporte.
              </div>
            ) : (
              filteredSections.map((section) => <SectionBlock key={section.id} section={section} />)
            )}
          </main>
        </div>
      </section>
    </div>
  )
}
