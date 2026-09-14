export const ALIANCA_PARTNER_LEAD_STAGES = [
  {
    code: 'prospeccao',
    number: 1,
    label: 'Prospecção',
    subtitle: 'Outbound ou Inbound',
    description:
      'Busca ativa por potenciais clientes (leads) com o perfil ideal. Mapear igrejas ou pessoas com o problema que o Conecta+ resolve, por indicações, listas ou canais digitais.',
  },
  {
    code: 'primeiro_contato',
    number: 2,
    label: 'Primeiro contato',
    subtitle: 'Abordagem / Cold Outbound',
    description:
      'Abrir a conversa com o lead. Despertar a curiosidade e validar interesse ou fit, por e-mail, ligação, WhatsApp ou redes sociais.',
  },
  {
    code: 'qualificacao',
    number: 3,
    label: 'Qualificação',
    subtitle: 'Diagnóstico',
    description:
      'Antes de apresentar o produto, entender se a igreja precisa dele e pode pagar. Sondar dores, orçamento, prazos e decisores (BANT).',
  },
  {
    code: 'apresentacao',
    number: 4,
    label: 'Apresentação',
    subtitle: 'Demonstração / Pitch',
    description:
      'Mostrar a solução com base no diagnóstico. Focar no valor — como o Conecta+ resolve o problema daquela igreja — em reunião ou proposta.',
  },
  {
    code: 'follow_up',
    number: 5,
    label: 'Follow-up',
    subtitle: 'Acompanhamento',
    description:
      'Acompanhar após a apresentação, com cadência de mensagens ou ligações, para manter o negócio aquecido e tirar dúvidas.',
  },
  {
    code: 'negociacao',
    number: 6,
    label: 'Negociação',
    subtitle: 'Contorno de objeções',
    description:
      'Há interesse, mas surgem barreiras de preço, prazo ou concorrência. Ouvir, validar preocupações e apresentar argumentos de valor.',
  },
  {
    code: 'fechamento',
    number: 7,
    label: 'Fechamento',
    subtitle: 'Contrato / pagamento',
    description:
      'Assinatura do contrato ou pagamento. O lead se torna cliente — conclusão positiva do esforço comercial.',
  },
] as const;

export type AliancaPartnerLeadStageCode = (typeof ALIANCA_PARTNER_LEAD_STAGES)[number]['code'];

export function aliancaPartnerLeadStageByCode(code: string | null | undefined) {
  const normalized = String(code ?? '').trim();
  return (
    ALIANCA_PARTNER_LEAD_STAGES.find((item) => item.code === normalized) ??
    ALIANCA_PARTNER_LEAD_STAGES[0]
  );
}
