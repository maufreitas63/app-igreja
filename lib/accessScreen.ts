/** Telas (rotas) usadas no app — alinhado a `access_resources` no Supabase. */
export const ACCESS_SCREEN = {
  login: '/',
  register: '/register',
  dashboard: '/dashboard',
  maintenance: '/maintenance-dashboard',
  manageProfile: '/manage-profile',
  manageMembers: '/manage-members',
  pastoral: '/pastoral',
  pastoralHistory: '/pastoral-history',
  financial: '/financial',
  expenseReport: '/expense-report',
  mapGeolocation: '/mapa-geolocalizacao',
  mapGeolocationPinDetail: '/mapa-geolocalizacao/detalhe-pin',
  lgpd: '/lgpd',
  eventOrchestrator: '/admin/orquestrador',
  configuracaoSalas: '/configuracao-salas',
} as const;
