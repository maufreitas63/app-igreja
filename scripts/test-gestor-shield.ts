/**
 * Gestor não vê papel Super Administrador nem coluna de PIN.
 * Uso: npx tsx scripts/test-gestor-shield.ts
 */
import {
  isColumnResourceAllowedForAccessActor,
  isRoleVisibleToAccessActor,
} from '@/lib/gestorControleAcessoSecurity';

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error('FALHA —', message);
    process.exit(1);
  }
}

assert(isRoleVisibleToAccessActor('super_admin', false) === false, 'Gestor não vê o papel super_admin');
assert(isRoleVisibleToAccessActor('member', false) === true, 'Gestor vê os demais papéis');
assert(isRoleVisibleToAccessActor('super_admin', true) === true, 'Super Admin vê o próprio papel');
assert(
  isColumnResourceAllowedForAccessActor('profiles.access_pin', false) === false,
  'Gestor não gerencia PIN'
);
assert(
  isColumnResourceAllowedForAccessActor('profiles.password', false) === false,
  'Gestor não gerencia senha'
);
assert(
  isColumnResourceAllowedForAccessActor('profiles.full_name', false) === true,
  'Gestor gerencia colunas comuns'
);
assert(
  isColumnResourceAllowedForAccessActor('profiles.access_pin', true) === true,
  'Super Admin gerencia PIN'
);

console.log('OK — escudo do Gestor validado no cliente.');
