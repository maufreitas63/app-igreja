/**
 * Valida helpers de navegação do carrossel.
 * Uso: node scripts/test-carousel-navigation.mjs
 */

function buildDashboardDeepLinkKey(cardParam, navigationNonce) {
  const card = (cardParam ?? '').trim();
  if (!card) return null;
  const nonce = (navigationNonce ?? '').trim();
  return nonce ? `${card}:${nonce}` : card;
}

function resolveCarouselIndexByContent(cards, content) {
  const trimmed = (content ?? '').trim();
  if (!trimmed) return -1;
  return cards.findIndex((item) => item.content === trimmed);
}

function assert(condition, message) {
  if (!condition) {
    console.error('FALHA —', message);
    process.exit(1);
  }
}

const key1 = buildDashboardDeepLinkKey('8', '123');
const key2 = buildDashboardDeepLinkKey('8', '456');
assert(key1 === '8:123', `nonce esperado, obtido ${key1}`);
assert(key1 !== key2, 'cada atalho deve gerar chave única');

const cards = [
  { content: 'event_alt' },
  { content: 'vigilance_scales' },
  { content: 'scale_roster' },
];

assert(resolveCarouselIndexByContent(cards, 'scale_roster') === 2, 'índice scale_roster');
assert(resolveCarouselIndexByContent(cards, 'missing') === -1, 'content ausente');

console.log('OK — helpers de navegação do carrossel validados.');
