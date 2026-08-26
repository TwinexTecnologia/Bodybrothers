export type HelpSection = {
  id: string
  title: string
  summary: string
  paragraphs?: string[]
  bullets?: string[]
  steps?: string[]
  tip?: string
}

export type HelpDocument = {
  id: 'quick' | 'manual'
  label: string
  tagline: string
  description: string
  sections: HelpSection[]
}

export const helpDocuments: HelpDocument[] = [
  {
    id: 'quick',
    label: 'Guia rapido',
    tagline: 'Para comecar a usar hoje',
    description:
      'Visao objetiva da plataforma para onboarding, rotina inicial e consultas rapidas no dia a dia.',
    sections: [
      {
        id: 'quick-visao-geral',
        title: 'Visao geral',
        summary: 'Resumo do que a plataforma centraliza para o personal.',
        paragraphs: [
          'A plataforma foi pensada para reunir a operacao do personal em um unico lugar, organizando atendimento, entrega e acompanhamento.',
        ],
        bullets: [
          'Gerenciar alunos',
          'Criar treinos, dietas e anamneses',
          'Acompanhar evolucao por fotos',
          'Controlar planos e recebimentos',
          'Abrir suporte interno quando precisar',
        ],
      },
      {
        id: 'quick-primeiros-passos',
        title: 'Primeiros passos',
        summary: 'Ordem recomendada para comecar certo.',
        steps: [
          'Acesse o painel e revise seu perfil',
          'Confira se os planos ja estao cadastrados',
          'Cadastre o primeiro aluno',
          'Vincule plano e data de inicio',
          'Monte treino, dieta ou anamnese para esse aluno',
        ],
        tip: 'Nome, email, plano e data de inicio sao os campos que mais impactam a operacao.',
      },
      {
        id: 'quick-dashboard',
        title: 'Dashboard',
        summary: 'Tela de leitura rapida da operacao.',
        bullets: [
          'Quantidade de alunos',
          'Visao financeira',
          'Treinos e dietas',
          'Pendencias de anamnese',
          'Atalhos para acoes frequentes',
        ],
        tip: 'Use o dashboard no inicio do dia para decidir o que atacar primeiro.',
      },
      {
        id: 'quick-alunos',
        title: 'Alunos',
        summary: 'Centro da operacao do personal.',
        bullets: [
          'Cadastrar e editar alunos',
          'Definir ou alterar plano',
          'Informar a data de inicio',
          'Acompanhar situacao financeira',
          'Acessar treino, dieta, anamnese e evolucao',
        ],
        tip: 'Se o aluno ja pagou fora do sistema, use a opcao "Ja recebeu este ciclo" somente quando for verdade.',
      },
      {
        id: 'quick-planos-financeiro',
        title: 'Planos e financeiro',
        summary: 'O sistema trabalha com ciclos em dias, nao com frequencias fixas.',
        bullets: [
          'Os planos usam ciclos como 10, 15, 20 ou 30 dias',
          'O vencimento considera data de inicio, ultimo pagamento e ciclo',
          'O personal pode registrar e desfazer pagamentos',
          'Alunos em atraso devem ser revisados com base no plano e na data de inicio',
        ],
      },
      {
        id: 'quick-protocolos',
        title: 'Treinos, dietas e anamneses',
        summary: 'A base de entrega do acompanhamento.',
        bullets: [
          'Treinos podem ser criados do zero ou a partir da biblioteca',
          'Dietas podem ser reutilizadas e personalizadas',
          'Anamneses podem ser criadas, aplicadas e revisadas',
          'Pendencias devem ser acompanhadas com frequencia',
        ],
      },
      {
        id: 'quick-biblioteca',
        title: 'Biblioteca',
        summary: 'Area para reaproveitar estrutura e ganhar velocidade na montagem.',
        bullets: [
          'Use a biblioteca para acelerar a criacao de treinos',
          'Aproveite modelos base antes de personalizar para cada aluno',
          'Manter a biblioteca organizada reduz retrabalho no dia a dia',
          'Revise os itens salvos para evitar duplicidade e bagunca',
        ],
        tip: 'A melhor rotina costuma ser montar uma base boa na biblioteca e depois duplicar e ajustar por aluno.',
      },
      {
        id: 'quick-evolucao-suporte',
        title: 'Evolucao e suporte',
        summary: 'Acompanhamento visual e ajuda operacional.',
        bullets: [
          'A evolucao por fotos ajuda a comparar progresso por periodo',
          'O suporte interno aceita mensagem, anexo e imagem colada com Ctrl + V',
          'Quanto mais contexto e imagem, mais rapido costuma ser o atendimento',
        ],
      },
      {
        id: 'quick-rotina',
        title: 'Fluxo recomendado',
        summary: 'Rotina simples para manter a plataforma organizada.',
        steps: [
          'Abrir o dashboard',
          'Revisar pendencias',
          'Conferir alunos e financeiro',
          'Atualizar protocolos necessarios',
          'Registrar pagamentos',
          'Acompanhar evolucao',
        ],
      },
    ],
  },
  {
    id: 'manual',
    label: 'Manual completo',
    tagline: 'Consulta detalhada da plataforma',
    description:
      'Material completo para orientar onboarding, operacao recorrente, boas praticas e erros comuns.',
    sections: [
      {
        id: 'manual-apresentacao',
        title: 'Apresentacao',
        summary: 'Para que serve este manual e como usar o material.',
        paragraphs: [
          'Este manual foi criado para ajudar o personal a entender e usar a plataforma de forma segura, organizada e produtiva.',
          'A ideia e servir como apoio operacional completo, e nao como documento tecnico pesado.',
        ],
      },
      {
        id: 'manual-o-que-a-plataforma-faz',
        title: 'O que a plataforma permite fazer',
        summary: 'Resumo das entregas e controles que o sistema cobre.',
        bullets: [
          'Gerenciar alunos',
          'Criar e editar planos',
          'Controlar recebimentos',
          'Criar treinos e dietas',
          'Aplicar anamneses',
          'Acompanhar evolucao por fotos',
          'Organizar leads no CRM',
          'Abrir chamados no suporte interno',
        ],
      },
      {
        id: 'manual-estrutura-geral',
        title: 'Estrutura geral do sistema',
        summary: 'As areas mais importantes da navegacao do personal.',
        bullets: [
          'Dashboard',
          'Alunos',
          'Financeiro',
          'Treinos',
          'Dietas',
          'Planos',
          'Anamneses',
          'Evolucao',
          'CRM',
          'Conta',
          'Suporte',
        ],
        steps: [
          'Cadastrar aluno',
          'Vincular plano',
          'Definir data de inicio',
          'Aplicar treino, dieta e anamnese',
          'Acompanhar financeiro e evolucao',
        ],
      },
      {
        id: 'manual-primeiro-acesso',
        title: 'Primeiro acesso',
        summary: 'Checklist para iniciar a conta com organizacao.',
        steps: [
          'Entrar com email e senha',
          'Revisar os dados do perfil',
          'Conferir os planos cadastrados',
          'Navegar rapidamente pelo dashboard',
          'Cadastrar o primeiro aluno',
        ],
        bullets: [
          'Revise branding e preferencias',
          'Confira a estrutura inicial de treinos e dietas',
          'Evite iniciar a operacao com planos desorganizados',
        ],
      },
      {
        id: 'manual-login-recuperacao',
        title: 'Login e recuperacao de senha',
        summary: 'Como recuperar o acesso quando necessario.',
        steps: [
          'Abrir a tela de login',
          'Usar a opcao "Esqueci minha senha"',
          'Informar o email',
          'Abrir o link recebido',
          'Definir a nova senha',
        ],
        tip: 'Se o email nao chegar ou o link falhar, use o suporte interno.',
      },
      {
        id: 'manual-dashboard',
        title: 'Dashboard',
        summary: 'Visao executiva da conta e ponto de partida do dia.',
        paragraphs: [
          'O dashboard foi desenhado para leitura rapida da operacao. Ele ajuda o personal a enxergar o que precisa de acao sem navegar por varias areas primeiro.',
        ],
        bullets: [
          'Volume de alunos',
          'Informacoes financeiras',
          'Quantidade de treinos e dietas',
          'Pendencias de anamnese',
          'Atalhos para criacao e acompanhamento',
        ],
      },
      {
        id: 'manual-alunos',
        title: 'Alunos',
        summary: 'Area principal para cadastro, gestao e acompanhamento.',
        paragraphs: [
          'A area de alunos concentra dados cadastrais, plano, situacao financeira, treino, dieta, anamneses e evolucao.',
        ],
        bullets: [
          'Cadastrar e editar alunos',
          'Mudar plano',
          'Corrigir a data de inicio',
          'Ajustar protocolos',
          'Ativar ou inativar alunos',
        ],
        tip: 'Nome, email, plano e data de inicio precisam estar corretos para o resto da operacao funcionar bem.',
      },
      {
        id: 'manual-planos',
        title: 'Planos',
        summary: 'Base comercial e financeira do acompanhamento.',
        paragraphs: [
          'Os planos funcionam por ciclo em dias. Esse modelo permite operacoes como 10, 15, 20 ou 30 dias sem depender de frequencias fixas.',
        ],
        bullets: [
          'Criar plano',
          'Editar nome, valor e ciclo',
          'Excluir quando necessario',
          'Vincular plano ao aluno',
        ],
        tip: 'Use nomes claros e evite duplicidade desnecessaria.',
      },
      {
        id: 'manual-financeiro',
        title: 'Financeiro',
        summary: 'Controle de recebimentos, status e ciclo atual do aluno.',
        paragraphs: [
          'O vencimento considera a data de inicio do plano, o ultimo pagamento registrado e a quantidade de dias do ciclo.',
        ],
        bullets: [
          'Acompanhar cobrancas',
          'Registrar pagamento',
          'Desfazer pagamento quando necessario',
          'Acompanhar historico',
          'Identificar alunos em atraso',
        ],
        tip: 'Se o financeiro parecer errado, revise primeiro plano, data de inicio e pagamentos antes de concluir que o sistema falhou.',
      },
      {
        id: 'manual-pagamento-manual',
        title: 'Botao Ja recebeu este ciclo',
        summary: 'Quando usar o registro manual de pagamento.',
        bullets: [
          'Use quando o aluno ja pagou aquele ciclo',
          'Use quando o pagamento ainda nao entrou no fluxo normal',
          'Evite usar sem confirmacao real do recebimento',
        ],
        tip: 'A funcao existe para evitar atraso incorreto e cobranca duplicada.',
      },
      {
        id: 'manual-treinos',
        title: 'Treinos',
        summary: 'Montagem, reaproveitamento e personalizacao.',
        bullets: [
          'Criar treino do zero',
          'Usar biblioteca de exercicios',
          'Organizar exercicios e series',
          'Duplicar e personalizar modelos',
          'Vincular treino ao aluno',
        ],
        steps: [
          'Montar treinos base',
          'Manter os modelos organizados',
          'Duplicar quando precisar personalizar',
          'Vincular ao aluno certo',
        ],
      },
      {
        id: 'manual-dietas',
        title: 'Dietas',
        summary: 'Estruturacao alimentar com reaproveitamento de modelos.',
        bullets: [
          'Criar dietas',
          'Dividir por refeicoes',
          'Configurar alimentos e substituicoes',
          'Reaproveitar modelos',
          'Editar versoes personalizadas',
          'Exportar quando necessario',
        ],
        tip: 'O melhor fluxo costuma ser manter uma biblioteca base e personalizar somente o necessario.',
      },
      {
        id: 'manual-anamneses',
        title: 'Anamneses',
        summary: 'Coleta de informacoes e revisao periodica do aluno.',
        bullets: [
          'Criar modelos',
          'Aplicar no aluno',
          'Acompanhar respostas',
          'Revisar pendencias',
          'Reaplicar quando necessario',
        ],
        tip: 'Use anamneses no inicio do acompanhamento e em momentos importantes de revisao.',
      },
      {
        id: 'manual-evolucao',
        title: 'Evolucao por fotos',
        summary: 'Comparacao visual e reforco do acompanhamento.',
        bullets: [
          'Acessar a central de evolucao',
          'Abrir historico por aluno',
          'Comparar registros por periodo',
          'Acompanhar progresso visual',
        ],
        tip: 'Oriente o aluno a manter padrao de foto para melhorar a leitura da evolucao.',
      },
      {
        id: 'manual-crm',
        title: 'CRM',
        summary: 'Organizacao do lado comercial da operacao.',
        bullets: [
          'Registrar leads',
          'Organizar por etapa',
          'Acompanhar movimentacao do funil',
          'Visualizar origem',
          'Converter oportunidade em aluno',
        ],
        tip: 'O CRM faz mais sentido para quem recebe muitos contatos e quer acompanhar a jornada comercial.',
      },
      {
        id: 'manual-conta-branding',
        title: 'Conta, perfil e branding',
        summary: 'Ajustes estruturais da conta do personal.',
        bullets: [
          'Dados do perfil',
          'Configuracoes gerais',
          'Branding',
          'Preferencias',
          'Configuracoes comerciais',
        ],
        tip: 'Revise essa area antes de iniciar operacao intensa com alunos.',
      },
      {
        id: 'manual-rotina',
        title: 'Rotina recomendada',
        summary: 'Fluxos diarios e semanais para manter a plataforma organizada.',
        steps: [
          'Abrir o dashboard',
          'Revisar pendencias',
          'Verificar financeiro',
          'Abrir alunos com acao pendente',
          'Ajustar protocolos',
          'Registrar pagamentos',
          'Acompanhar evolucao',
        ],
        bullets: [
          'Revise atrasos semanalmente',
          'Cheque pendencias de anamnese',
          'Organize CRM e biblioteca de protocolos',
        ],
      },
      {
        id: 'manual-suporte',
        title: 'Suporte interno',
        summary: 'Canal de apoio operacional dentro da plataforma.',
        bullets: [
          'Abrir chamado',
          'Escrever mensagens',
          'Enviar anexos',
          'Colar imagem com Ctrl + V',
          'Acompanhar respostas do suporte',
        ],
        tip: 'Quanto melhor a explicacao e o contexto enviado, mais rapido o atendimento costuma fluir.',
      },
      {
        id: 'manual-erros-comuns',
        title: 'Erros comuns e como evitar',
        summary: 'A maioria dos problemas vem de preenchimento ou operacao.',
        bullets: [
          'Financeiro divergente por plano ou data de inicio incorretos',
          'Aluno com situacao inesperada por falta de pagamento registrado',
          'Biblioteca desorganizada de treinos e dietas',
          'Pendencias acumuladas sem rotina de revisao',
        ],
        tip: 'Revisar os dados principais quase sempre resolve a causa raiz mais rapido do que tentar corrigir tudo depois.',
      },
      {
        id: 'manual-boas-praticas',
        title: 'Boas praticas gerais',
        summary: 'Ajustes simples que deixam a operacao mais leve.',
        bullets: [
          'Mantenha cadastros atualizados',
          'Use nomes claros para planos e protocolos',
          'Revise a data de inicio sempre que houver duvida',
          'Nao acumule pendencias de anamnese',
          'Padronize biblioteca de treinos e dietas',
          'Use o suporte ao menor sinal de bloqueio operacional',
        ],
      },
    ],
  },
]
