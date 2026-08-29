/** Janela em que o menu lateral está navegando — as telas não devem redirecionar ao Início. */
const DRAWER_NAV_WINDOW_MS = 2000;

let drawerNavUntil = 0;

export function markDrawerNavigation() {
  drawerNavUntil = Date.now() + DRAWER_NAV_WINDOW_MS;
}

export function isDrawerNavigationPending() {
  return Date.now() < drawerNavUntil;
}
