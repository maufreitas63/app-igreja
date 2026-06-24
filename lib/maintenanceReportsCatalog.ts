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

const currentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const MAINTENANCE_REPORT_DEFINITIONS: MaintenanceReportDefinition[] = [
  {
    code: 'members_active_inactive',
    title: 'Membros Ativos, Inativos, Congregados e Tempo de Congregação',
    description:
      'Classifica perfis por papel (visitante, congregado, membro), tempo de congregação desde created_at e status ativo/inativo. Membros e congregados usam membership_out (efetiva, com herança familiar); visitantes usam atividade recente.',
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
    code: 'financial_flow',
    title: 'Fluxo Financeiro e Categorização',
    description:
      'Agrupa receitas e despesas por categoria/ministério, filtrando entre movimento orçamentário planejado e realizado, incluindo RDs conciliados.',
    dataSources: 'financials, expense_reports, expense_items',
    configFields: [
      {
        key: 'referencia_mes',
        label: 'Mês de referência (AAAA-MM)',
        type: 'month',
        defaultValue: currentMonth(),
        placeholder: '2026-06',
      },
      {
        key: 'budget_version',
        label: 'Versão orçamentária',
        type: 'select',
        defaultValue: 'REALIZADO',
        options: [
          { value: 'REALIZADO', label: 'Realizado' },
          { value: 'PLANEJADO', label: 'Planejado' },
        ],
      },
    ],
  },
  {
    code: 'territory_indicators',
    title: 'Indicadores Estratégicos de Território',
    description:
      'Densidade de perfis por bairro com coordenadas do cache de CEP para apoio a mapas de calor e planejamento territorial.',
    dataSources: 'profiles, cep_geolocations',
    configFields: [],
  },
  {
    code: 'attendance_retention',
    title: 'Assiduidade e Retenção (Eventos)',
    description:
      'Calcula absenteísmo (inscritos sem check-in) por evento e sinaliza perfis com queda de frequência nos últimos meses.',
    dataSources: 'events, event_registrations, checkins',
    configFields: [
      {
        key: 'retention_months',
        label: 'Meses para análise de retenção',
        type: 'number',
        defaultValue: '6',
        min: 1,
        max: 24,
      },
    ],
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
    code: 'volunteer_engagement',
    title: 'Engajamento e Carga de Voluntários',
    description:
      'Conta escalas por servo no mês e destaca sobrecarga; compara disponibilidade com tipos de escala.',
    dataSources: 'tipos_escala, voluntarios_escala, escalas_log',
    configFields: [
      {
        key: 'referencia_mes',
        label: 'Mês de referência (AAAA-MM)',
        type: 'month',
        defaultValue: currentMonth(),
        placeholder: '2026-06',
      },
      {
        key: 'overload_threshold',
        label: 'Limite de escalas/mês para sobrecarga',
        type: 'number',
        defaultValue: '5',
        min: 1,
        max: 20,
      },
    ],
  },
  {
    code: 'digital_adoption',
    title: 'Adoção Digital Agregada',
    description:
      'Lista rotas e cards do dashboard mais acessados e correlaciona picos de uso com inscrições em eventos.',
    dataSources: 'profile_app_access_events, profile_app_access_screen_visits, event_registrations',
    configFields: [
      {
        key: 'days',
        label: 'Dias analisados',
        type: 'number',
        defaultValue: '30',
        min: 7,
        max: 180,
      },
    ],
  },
  {
    code: 'demographic_age_brackets',
    title: 'Faixa Etária',
    description:
      'Distribui perfis por faixa etária (0-12, 13-17, 18-29, 30-44, 45-59, 60+) para planejar salas infantis, jovens e ministérios por idade.',
    dataSources: 'profiles',
    configFields: [],
  },
  {
    code: 'demographic_family_size',
    title: 'Tamanho da Família',
    description:
      'Lista famílias com quantidade de integrantes e classificação (individual, pequena ou grande) para estruturar pequenos grupos e acompanhamento familiar.',
    dataSources: 'profiles, members',
    configFields: [],
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
    code: 'checkin_adoption',
    title: 'Adoção de Check-in (Totem vs. GPS)',
    description:
      'Compara check-ins confirmados via totem com check-ins automáticos por geofence no celular.',
    dataSources: 'checkins',
    configFields: [
      {
        key: 'referencia_mes',
        label: 'Mês de referência (AAAA-MM)',
        type: 'month',
        defaultValue: currentMonth(),
        placeholder: '2026-06',
      },
    ],
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
    code: 'treasury_sla',
    title: 'SLA da Tesouraria (Reembolsos)',
    description:
      'Tempo médio entre criação do RD e conciliação financeira, por relatório e em agregado.',
    dataSources: 'expense_reports, expense_items, financials',
    configFields: [
      {
        key: 'referencia_mes',
        label: 'Mês de referência (AAAA-MM)',
        type: 'month',
        defaultValue: currentMonth(),
        placeholder: '2026-06',
      },
    ],
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
];

export const buildDefaultReportParams = (
  definition: MaintenanceReportDefinition
): Record<string, string> =>
  Object.fromEntries(definition.configFields.map((field) => [field.key, field.defaultValue]));
