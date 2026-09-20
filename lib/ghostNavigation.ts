import { isGhostModeActive } from '@/lib/ghostMode';

/**
 * No Modo Ghost o auditor precisa permanecer na rota do alvo.
 * Fail-closed, trap de popstate e restore de histórico não podem mandar ao Início.
 */
export function ghostBlocksHomeBounce(): boolean {
  return isGhostModeActive();
}

export function isMemberHomeHref(href: string | null | undefined): boolean {
  if (!href) {
    return false;
  }

  const path = href.split('?')[0].replace(/\/+$/, '') || '/';
  return (
    path === '/'
    || path === '/index'
    || path === '/(tabs)'
    || path === '/(tabs)/index'
  );
}
