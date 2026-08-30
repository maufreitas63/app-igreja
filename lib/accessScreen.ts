/** Telas (rotas) usadas no app — alinhado a `access_resources` no Supabase. */
export const ACCESS_SCREEN = {
  login: '/',
  register: '/register',
  dashboard: '/dashboard',
  smallGroup: '/pequeno-grupo',
  opportunityMural: '/mural-oportunidades',
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
  totemCheckin: '/totem-checkin',
  autorizacaoMidia: '/autorizacao-midia',
  discipleshipTrail: '/trilha-discipulado',
  /** Alias legado ainda presente em `access_resources`. */
  discipleshipTrailLegacy: '/trilha',
  redesSociais: '/redes-sociais',
  generosityMural: '/mural-generosidade',
  scalesAllowSwap: 'scales.allow_swap',
} as const;

/**
 * Rotas de tela ligadas à manutenção (legado ou painéis) —
 * usadas na bolinha laranja em Papéis → Telas.
 */
export const ACCESS_SCREEN_MAINTENANCE_EXTRA = {
  discipleshipRecognitionsLegacy: '/trilha-reconhecimentos',
} as const;
