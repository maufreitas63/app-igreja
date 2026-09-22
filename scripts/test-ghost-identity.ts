/**
 * Identidade efetiva no Modo Ghost: não volta ao Início e usa o perfil do alvo.
 * Uso: npx tsx scripts/test-ghost-identity.ts
 */
import { readFileSync } from 'node:fs';
import { clearGhostModeState, setGhostModeState } from '@/lib/ghostMode';
import {
  ghostBlocksHomeBounce,
  ghostPassScreenAccess,
  isMemberHomeHref,
} from '@/lib/ghostNavigation';

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error('FALHA —', message);
    process.exit(1);
  }
}

assert(ghostBlocksHomeBounce() === false, 'sem Ghost, o Início pode receber o voltar');
assert(ghostPassScreenAccess() === false, 'sem alvo, o gate de tela segue o ACL');

setGhostModeState({
  targetProfileId: 'alvo-1',
  targetFullName: 'Pessoa simulada',
  realProfileId: 'operador-1',
  startedAt: new Date().toISOString(),
  previousTenantId: null,
  previousTenantBranding: null,
});

assert(ghostBlocksHomeBounce() === true, 'Ghost ativo bloqueia o bounce ao Início');
assert(ghostPassScreenAccess() === true, 'alvo definido mantém a rota aberta');
assert(isMemberHomeHref('/(tabs)') === true, 'Início do membro é /(tabs)');
assert(isMemberHomeHref('/perfil') === false, 'Perfil não é o Início');

clearGhostModeState();
assert(ghostBlocksHomeBounce() === false, 'encerrar Ghost libera a identidade real');
assert(ghostPassScreenAccess() === false, 'sem alvo, o passe de tela encerra');

const profilePanel = readFileSync(new URL('../components/ProfileClassPanel.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert(
  profilePanel.includes('if (ghostModeActive)')
    && profilePanel.includes('await fetchProfile({ force: true })'),
  'Dados cadastrais permanecem abertos no Ghost sem grant'
);

const maintenance = readFileSync(new URL('../app/maintenance-dashboard.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert(
  maintenance.includes("if (ghostModeActive) {\n            setAccessState('allowed');"),
  'manutenção sem grant no Ghost não fica em Redirecionando'
);
assert(
  maintenance.includes('activeMaintenanceCard || ghostModeActive'),
  'manutenção no Ghost não substitui a rota pelo Início'
);
assert(
  maintenance.includes('ghostModeActive && requestedPanel && card.content === requestedPanel'),
  'painel pedido no Ghost continua visível sem grant'
);

console.log('OK — identidade do Modo Ghost validada.');
