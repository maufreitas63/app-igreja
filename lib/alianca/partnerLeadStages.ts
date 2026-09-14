export const ALIANCA_PARTNER_LEAD_STAGES = [
  {
    code: 'primeiro_contato',
    number: 1,
    label: 'Primeiro contato',
    subtitle: 'Abordagem / Cold Outbound',
    description: 'O momento de abrir as portas e iniciar o diálogo.',
    activities: [
      {
        number: 1,
        title: 'Abordagem focada na dor (e-mail ou WhatsApp)',
        activity:
          'Enviar mensagens curtas mostrando como eliminar o trabalho manual de emissão de carteirinhas físicas e controle de presença.',
      },
      {
        number: 2,
        title: 'Conexão com líderes no LinkedIn',
        activity:
          'Abordar diretores, presidentes de associações ou gestores de comunidades utilizando o contexto de transformação digital.',
      },
      {
        number: 3,
        title: 'Agendamento da reunião de diagnóstico',
        activity:
          'Convidar o decisor para uma conversa rápida de 15 minutos para entender como eles gerenciam os membros hoje.',
      },
    ],
  },
  {
    code: 'qualificacao',
    number: 2,
    label: 'Qualificação',
    subtitle: 'Diagnóstico',
    description:
      'Avaliar se a entidade tem volume de membros e orçamento para justificar a contratação do Conecta+.',
    activities: [
      {
        number: 1,
        title: 'Sondagem de processos atuais',
        activity:
          'Perguntar como é feita a emissão de carteirinhas, como controlam a entrada em eventos (check-in) e como comunicam novidades aos membros.',
      },
      {
        number: 2,
        title: 'Dimensionamento da base (BANT adaptado)',
        activity:
          'Descobrir o número exato de membros ativos, o orçamento disponível para ferramentas de gestão e quem assina o contrato.',
      },
      {
        number: 3,
        title: 'Validação do fit tecnológico',
        activity:
          'Confirmar se a instituição precisa de recursos como geofencing, mural de oportunidades ou emissão automatizada de carteirinhas digitais.',
      },
    ],
  },
  {
    code: 'apresentacao',
    number: 3,
    label: 'Apresentação',
    subtitle: 'Demonstração / Pitch',
    description: 'Mostrar o Conecta+ funcionando na prática e resolver as dores mapeadas.',
    activities: [
      {
        number: 1,
        title: 'Demonstração prática do aplicativo',
        activity:
          'Compartilhar a tela do app (ou enviar um acesso de demonstração) mostrando a carteirinha digital com QR code e a facilidade do check-in.',
      },
      {
        number: 2,
        title: 'Apresentação do mural e engajamento',
        activity:
          'Demonstrar como o mural de oportunidades e as notificações ajudam a manter os membros engajados com a instituição.',
      },
      {
        number: 3,
        title: 'Apresentação da proposta comercial',
        activity:
          'Apresentar os planos de assinatura trimestrais/anuais e as vantagens do modelo multi-tenant para a gestão da entidade.',
      },
    ],
  },
  {
    code: 'follow_up',
    number: 4,
    label: 'Follow-up',
    subtitle: 'Acompanhamento',
    description: 'O contato estratégico enquanto a diretoria da instituição avalia a proposta.',
    activities: [
      {
        number: 1,
        title: 'Envio de materiais de apoio',
        activity:
          'Compartilhar cases de sucesso de outras entidades que reduziram custos operacionais adotando o aplicativo.',
      },
      {
        number: 2,
        title: 'Retirada de dúvidas técnicas',
        activity:
          'Esclarecer questionamentos sobre segurança de dados, facilidade de uso para membros menos tecnológicos e migração de cadastros antigos.',
      },
      {
        number: 3,
        title: 'Alinhamento de prazos de decisão',
        activity:
          'Acompanhar o andamento interno da aprovação junto à diretoria ou conselho da instituição.',
      },
    ],
  },
  {
    code: 'negociacao',
    number: 5,
    label: 'Negociação',
    subtitle: 'Contorno de objeções',
    description: 'Superar as barreiras típicas de adoção de software por instituições.',
    activities: [
      {
        number: 1,
        title: 'Contorno de objeção de custo / budget',
        activity:
          'Demonstrar o ROI: o valor economizado com impressão de carteirinhas físicas e o ganho de tempo pagam a assinatura.',
      },
      {
        number: 2,
        title: 'Contorno de resistência à tecnologia',
        activity:
          'Explicar como o onboarding dos membros é simples e intuitivo, mesmo para quem tem menor familiaridade com o app.',
      },
      {
        number: 3,
        title: 'Fechamento de condições comerciais',
        activity:
          'Alinhar formas de pagamento via Stripe, prazos de implantação e customizações necessárias no painel administrativo.',
      },
    ],
  },
  {
    code: 'fechamento',
    number: 6,
    label: 'Fechamento',
    subtitle: 'Contrato e início da jornada',
    description: 'A concretização do contrato e o início da jornada do cliente.',
    activities: [
      {
        number: 1,
        title: 'Assinatura do termo / contrato',
        activity: 'Concluir o processo de contratação e efetivar o pagamento da assinatura inicial.',
      },
      {
        number: 2,
        title: 'Configuração do tenant',
        activity: 'Criar o ambiente exclusivo da nova entidade no painel administrativo do sistema.',
      },
      {
        number: 3,
        title: 'Passagem de bastão para o onboarding',
        activity:
          'Realizar a reunião inicial com o cliente para importar a base de membros e iniciar o uso prático do aplicativo.',
      },
    ],
  },
] as const;

export type AliancaPartnerLeadStageCode = (typeof ALIANCA_PARTNER_LEAD_STAGES)[number]['code'];

export function aliancaPartnerLeadStageByCode(code: string | null | undefined) {
  const normalized = String(code ?? '').trim();
  if (normalized === 'prospeccao') {
    return ALIANCA_PARTNER_LEAD_STAGES[0];
  }
  return (
    ALIANCA_PARTNER_LEAD_STAGES.find((item) => item.code === normalized) ??
    ALIANCA_PARTNER_LEAD_STAGES[0]
  );
}

export function aliancaPartnerLeadSubStage(value: number | null | undefined) {
  const n = Number(value);
  if (n === 2 || n === 3) return n;
  return 1;
}
