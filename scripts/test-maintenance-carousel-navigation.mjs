/**
 * Valida mapeamento índice ↔ painel do carrossel de manutenção.
 * Uso: node scripts/test-maintenance-carousel-navigation.mjs
 */

const MAINTENANCE_PANEL_CARDS = [
  { id: '1', title: 'Programação de Eventos', content: 'events' },
  { id: '2', title: 'Cronograma de Eventos', content: 'events_gantt' },
  { id: '3', title: 'Sala(s) - Check In', content: 'sala_monitor' },
  { id: '5', title: 'Tipos de Escala', content: 'scale_types' },
  { id: '6', title: 'Servos em Disponibilidade', content: 'scale_volunteers' },
  { id: '7', title: 'Programação de Escalas', content: 'scales' },
  { id: '8', title: 'Cuidado Pastoral', content: 'pastoral_care' },
  { id: '9', title: 'Informações Financeiras', content: 'financials' },
  { id: '4', title: 'Lista de Presença', content: 'quorum_presence' },
  { id: '11', title: 'Cadastro de Usuário', content: 'profile_cadastro' },
  { id: '12', title: 'Recepção Familiar', content: 'family_reception' },
  { id: '10', title: 'Controle de Acesso', content: 'access_control' },
  { id: '13', title: 'Mudança de Papéis', content: 'mudanca_papeis' },
  { id: '14', title: 'Acessos de Usuários', content: 'profile_access_insights' },
];

const MAINTENANCE_PANEL_CONTENT_TO_ACCESS_KEY = {
  menu: '/maintenance-dashboard',
  events: 'maintenance.card.events',
  events_gantt: 'maintenance.card.events_gantt',
  sala_monitor: 'maintenance.card.sala_monitor',
  quorum_presence: 'maintenance.card.quorum_presence',
  scale_types: 'maintenance.card.scale_types',
  scale_volunteers: 'maintenance.card.scale_volunteers',
  scales: 'maintenance.card.scales',
  pastoral_care: 'maintenance.card.pastoral_care',
  mudanca_papeis: 'maintenance.card.mudanca_papeis',
  financials: 'maintenance.card.financials',
  profile_cadastro: 'maintenance.card.profile_cadastro',
  family_reception: 'maintenance.card.profile_cadastro',
  access_control: 'maintenance.card.access_control',
  profile_access_insights: 'maintenance.card.profile_access_insights',
};

function assert(condition, message) {
  if (!condition) {
    console.error('FALHA —', message);
    process.exit(1);
  }
}

function buildCarousel(panelCards) {
  return [{ id: 'menu', title: 'Manutenção', content: 'menu' }, ...panelCards];
}

function resolveMaintenancePanelIndex(cards, panelParam) {
  const trimmed = (panelParam ?? '').trim();
  if (!trimmed) return -1;
  return cards.findIndex((item) => item.id === trimmed || item.content === trimmed);
}

function resolveCarouselIndexByContent(cards, content) {
  const trimmed = (content ?? '').trim();
  if (!trimmed) return -1;
  return cards.findIndex((item) => item.content === trimmed);
}

function badgeForIndex(cards, index) {
  const card = cards[index];
  if (!card) return null;
  return {
    title: card.title,
    technicalKey: MAINTENANCE_PANEL_CONTENT_TO_ACCESS_KEY[card.content] ?? null,
  };
}

function filterPanelCards(access) {
  return MAINTENANCE_PANEL_CARDS.filter((card) => {
    if (card.content === 'access_control') {
      return access.canOpenAccessControlCard;
    }

    if (
      card.content === 'scale_types'
      || card.content === 'scale_volunteers'
      || card.content === 'scales'
    ) {
      return access.scalePanelAccess[card.content] === true;
    }

    if (card.content === 'pastoral_care') {
      return access.canAccessPastoralCare;
    }

    if (card.content === 'mudanca_papeis') {
      return access.canAccessPastoralRoleChange || access.canManageAccessControl;
    }

    if (card.content === 'profile_access_insights') {
      return access.canManageAccessControl || access.maintenancePanelAccess[card.content] === true;
    }

    if (card.content === 'profile_cadastro' || card.content === 'family_reception') {
      return access.canAccessProfileCadastro;
    }

    return access.maintenancePanelAccess[card.content] === true;
  });
}

const fullAccess = {
  canOpenAccessControlCard: true,
  canAccessPastoralCare: true,
  canAccessPastoralRoleChange: true,
  canManageAccessControl: true,
  canAccessProfileCadastro: true,
  maintenancePanelAccess: Object.fromEntries(
    MAINTENANCE_PANEL_CARDS.map((card) => [card.content, true])
  ),
  scalePanelAccess: {
    scale_types: true,
    scale_volunteers: true,
    scales: true,
  },
};

const carousel = buildCarousel(MAINTENANCE_PANEL_CARDS);

assert(carousel.length === MAINTENANCE_PANEL_CARDS.length + 1, 'menu + todos os painéis');

MAINTENANCE_PANEL_CARDS.forEach((panelCard, panelIndex) => {
  const expectedIndex = panelIndex + 1;
  const byContent = resolveMaintenancePanelIndex(carousel, panelCard.content);
  const byId = resolveMaintenancePanelIndex(carousel, panelCard.id);

  assert(byContent === expectedIndex, `${panelCard.content} por content → índice ${byContent}, esperado ${expectedIndex}`);
  assert(byId === expectedIndex, `${panelCard.id} por id → índice ${byId}, esperado ${expectedIndex}`);

  const badge = badgeForIndex(carousel, expectedIndex);
  assert(badge?.title === panelCard.title, `título do badge para ${panelCard.content}`);
  assert(
    badge?.technicalKey === MAINTENANCE_PANEL_CONTENT_TO_ACCESS_KEY[panelCard.content],
    `chave ACL do badge para ${panelCard.content}`
  );
});

assert(resolveMaintenancePanelIndex(carousel, 'menu') === 0, 'menu no índice 0');
assert(badgeForIndex(carousel, 0)?.title === 'Manutenção', 'badge do menu');

const pageWidth = 412;
for (let index = 0; index < carousel.length; index += 1) {
  const offset = index * pageWidth;
  const scrollDerivedIndex = Math.round(offset / pageWidth);
  const badge = badgeForIndex(carousel, scrollDerivedIndex);
  assert(
    badge?.title === carousel[index].title,
    `offset ${offset}px deve exibir "${carousel[index].title}", obteve "${badge?.title}"`
  );
}

const partialAccess = {
  ...fullAccess,
  maintenancePanelAccess: {
    ...fullAccess.maintenancePanelAccess,
    events_gantt: false,
    sala_monitor: false,
    financials: false,
  },
  scalePanelAccess: {
    scale_types: false,
    scale_volunteers: true,
    scales: false,
  },
  canAccessPastoralCare: false,
};

const filteredPanels = filterPanelCards(partialAccess);
const filteredCarousel = buildCarousel(filteredPanels);

filteredPanels.forEach((panelCard) => {
  const index = resolveMaintenancePanelIndex(filteredCarousel, panelCard.content);
  assert(index >= 0, `${panelCard.content} deve existir no carrossel filtrado`);

  const badge = badgeForIndex(filteredCarousel, index);
  assert(badge?.title === panelCard.title, `badge filtrado para ${panelCard.content}`);
  assert(
    filteredCarousel[index].content === panelCard.content,
    `conteúdo no índice ${index} deve ser ${panelCard.content}`
  );
});

assert(
  resolveCarouselIndexByContent(filteredCarousel, 'menu') === 0,
  'menu permanece no índice 0 após filtro'
);

assert(
  resolveMaintenancePanelIndex(filteredCarousel, 'mudanca_papeis')
    === filteredPanels.findIndex((card) => card.content === 'mudanca_papeis') + 1,
  'Mudança de Papéis no índice correto após filtro'
);

const superAdminCarousel = buildCarousel(
  filterPanelCards({
    ...fullAccess,
    canManageAccessControl: true,
  })
);

const insightsIndex = resolveMaintenancePanelIndex(superAdminCarousel, 'profile_access_insights');
assert(
  insightsIndex === superAdminCarousel.length - 1,
  'Acessos de Usuários deve ser o último card para super_admin'
);
assert(
  badgeForIndex(superAdminCarousel, insightsIndex)?.title === 'Acessos de Usuários',
  'badge do card Acessos de Usuários'
);

const nonSuperCarousel = buildCarousel(
  filterPanelCards({
    ...fullAccess,
    canManageAccessControl: false,
    maintenancePanelAccess: {
      ...fullAccess.maintenancePanelAccess,
      profile_access_insights: false,
    },
  })
);
assert(
  resolveMaintenancePanelIndex(nonSuperCarousel, 'profile_access_insights') === -1,
  'Acessos de Usuários oculto sem super_admin nem grant ACL'
);

const aclOnlyCarousel = buildCarousel(
  filterPanelCards({
    ...fullAccess,
    canManageAccessControl: false,
    maintenancePanelAccess: {
      ...fullAccess.maintenancePanelAccess,
      profile_access_insights: true,
    },
  })
);
const aclInsightsIndex = resolveMaintenancePanelIndex(aclOnlyCarousel, 'profile_access_insights');
assert(aclInsightsIndex === aclOnlyCarousel.length - 1, 'grant ACL mantém card como último painel');
assert(
  badgeForIndex(aclOnlyCarousel, aclInsightsIndex)?.technicalKey
    === 'maintenance.card.profile_access_insights',
  'etiqueta ACL do card Acessos de Usuários'
);

function simulateShortcutNavigation(carousel, panelContent) {
  const targetIndex = resolveMaintenancePanelIndex(carousel, panelContent);

  if (targetIndex < 0) {
    return null;
  }

  const pageWidth = 412;
  const offset = targetIndex * pageWidth;
  const scrollDerivedIndex = Math.round(offset / pageWidth);
  const badge = badgeForIndex(carousel, scrollDerivedIndex);

  return {
    targetIndex,
    scrollDerivedIndex,
    badgeTitle: badge?.title ?? '',
    panelTitle: carousel[targetIndex]?.title ?? '',
    panelContent: carousel[targetIndex]?.content ?? '',
  };
}

for (const panelCard of MAINTENANCE_PANEL_CARDS) {
  const navigation = simulateShortcutNavigation(carousel, panelCard.content);

  assert(navigation, `atalho deve abrir ${panelCard.content}`);
  assert(
    navigation.targetIndex === navigation.scrollDerivedIndex,
    `scroll e índice alinhados para ${panelCard.content}`
  );
  assert(
    navigation.badgeTitle === navigation.panelTitle,
    `etiqueta alinhada ao painel ${panelCard.content}`
  );
  assert(
    navigation.panelContent === panelCard.content,
    `conteúdo renderizado correto para ${panelCard.content}`
  );
}

const lastPanelNavigation = simulateShortcutNavigation(carousel, 'profile_access_insights');
assert(
  lastPanelNavigation?.targetIndex === carousel.length - 1,
  'atalho do último card leva ao índice final do carrossel'
);
assert(
  lastPanelNavigation?.badgeTitle === 'Acessos de Usuários',
  'etiqueta do último card após navegação'
);

console.log(`OK — ${MAINTENANCE_PANEL_CARDS.length} painéis e carrossel filtrado validados.`);
