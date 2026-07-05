export type MaintenanceReportConfigFieldType = 'number' | 'month' | 'select' | 'event';

export type MaintenanceReportConfigField = {
  key: string;
  label: string;
  type: MaintenanceReportConfigFieldType;
  defaultValue: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  /** Permite valor vazio (ex.: evento opcional no relatório de saúde). */
  optional?: boolean;
};

export type MaintenanceReportDefinition = {
  code: string;
  title: string;
  description: string;
  dataSources: string;
  configFields: MaintenanceReportConfigField[];
  /** Exige papel elevado (LGPD — relatório de saúde infantil). */
  restricted?: boolean;
};

export const MAINTENANCE_REPORT_DEFINITIONS: MaintenanceReportDefinition[] = [
  {
    code: 'members_active_inactive',
    title: 'Membros Ativos, Inativos, Congregados e Tempo de Congregação',
    description:
      'Classifica perfis por papel (visitante, congregado, membro), tempo de congregação desde created_at e status ativo/inativo. Membros e congregados usam membership_out efetiva (herança familiar). No resumo, Membros/Congregados contam só ativos; desligados aparecem separados.',
    dataSources: 'profiles, profile_access_roles, access_roles, profile_app_access_events, checkins',
    configFields: [
      {
        key: 'inactive_months',
        label: 'Meses sem atividade para considerar inativo',
        type: 'number',
        defaultValue: '3',
        min: 1,
        max: 24,
      },
    ],
  },
  {
    code: 'active_members_age_matrix',
    title: 'Membros e Congregados Ativos por Faixa Etária',
    description:
      'Matriz de perfis ativos (membership_out efetiva vazia) com faixas Infantil (0–11), Adolescente (12–17), Jovem (18–29), Adulto (30–59) e 60+, separando Membros e Congregados em colunas e incluindo linha de totais.',
    dataSources: 'profiles, profile_access_roles, access_roles',
    configFields: [],
  },
  {
    code: 'pastoral_needs',
    title: 'Necessidades Pastorais',
    description:
      'Agrupa solicitações por categoria no semestre e mede tempo médio entre status do fluxo pastoral.',
    dataSources: 'pastoral_requests, pastoral_reason_categories, pastoral_reason_subcategories',
    configFields: [
      {
        key: 'semester_months',
        label: 'Meses do semestre analisado',
        type: 'number',
        defaultValue: '6',
        min: 1,
        max: 12,
      },
    ],
  },
  {
    code: 'health_alerts',
    title: 'Saúde e Alertas Vitais (Ministério Infantil)',
    description:
      'Lista alertas alimentares/médicos de crianças inscritas em cultos. Dado sensível — acesso restrito (LGPD).',
    dataSources: 'profiles, events, event_registrations',
    configFields: [
      {
        key: 'event_id',
        label: 'Evento',
        type: 'event',
        defaultValue: '',
        optional: true,
      },
    ],
    restricted: true,
  },
  {
    code: 'quorum_official',
    title: 'Quórum Oficial para Assembleias',
    description:
      'Documento analítico de membros presentes em eventos estatutários encerrados (requer_quorum + is_locked).',
    dataSources: 'events, checkins, profiles',
    configFields: [],
  },
  {
    code: 'parking_estimate',
    title: 'Estimativa de Estacionamento por Evento',
    description:
      'Estima volume de veículos cruzando inscrições do evento com veículos cadastrados por família.',
    dataSources: 'event_registrations, profiles, profile_vehicles',
    configFields: [
      {
        key: 'event_id',
        label: 'Evento',
        type: 'event',
        defaultValue: '',
        optional: false,
      },
    ],
  },
  {
    code: 'support_suggestions',
    title: 'Sugestões e Melhorias',
    description:
      'Uma ficha por solicitação (tipo, solicitante, descrição, tratamento e anexos), com histórico cronológico interno de abertura, interações e comunicações.',
    dataSources:
      'maintenance_support_requests, maintenance_support_interactions, maintenance_support_communications, maintenance_support_attachments',
    configFields: [],
  },
  {
    code: 'event_registrations',
    title: 'Inscritos por Evento',
    description:
      'Lista eventos com inscrições e total de participantes. Toque no evento para ver a relação detalhada ordenada por família, papel e nome.',
    dataSources: 'events, event_registrations, profiles',
    configFields: [],
  },
];

export const buildDefaultReportParams = (
  definition: MaintenanceReportDefinition
): Record<string, string> =>
  Object.fromEntries(definition.configFields.map((field) => [field.key, field.defaultValue]));
