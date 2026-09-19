/**
 * Janela em que o menu lateral está navegando.
 * O Modal do drawer e o Expo Router no web disparam `popstate`/`beforeRemove`
 * ao fechar o painel — isso não é o voltar do usuário e não deve ir ao Início.
 */
const DRAWER_NAV_WINDOW_MS = 2000;

let drawerNavUntil = 0;

export function markDrawerNavigation() {
  drawerNavUntil = Date.now() + DRAWER_NAV_WINDOW_MS;
}

export function isDrawerNavigationPending() {
  return Date.now() < drawerNavUntil;
}
