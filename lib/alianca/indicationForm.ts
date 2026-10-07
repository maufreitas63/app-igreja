import { resolveFamilyRegistrationOrigin } from '@/lib/familyRegistration';

export const ALIANCA_INDICATION_PATH = '/alianca-indicacao';

export function buildAliancaIndicationUrl(
  tenantId: string,
  referrerProfileId: string,
  options?: { guestName?: string | null; phone?: string | null }
): string {
  const origin = resolveFamilyRegistrationOrigin();
  const params = new URLSearchParams({
    igreja: tenantId.trim(),
    responsavel: referrerProfileId.trim(),
  });
  const guestName = (options?.guestName ?? '').trim();
  if (guestName) params.set('nome', guestName);
  const phoneDigits = (options?.phone ?? '').replace(/\D/g, '');
  if (phoneDigits) params.set('celular', phoneDigits);
  return `${origin}${ALIANCA_INDICATION_PATH}?${params.toString()}`;
}

export function buildAliancaIndicationInviteMessage(
  pageUrl: string,
  churchName?: string | null,
  guestName?: string | null
): string {
  const who = churchName?.trim() || 'nossa igreja';
  const firstName = (guestName ?? '').trim().split(/\s+/).filter(Boolean)[0];
  const hello = firstName ? `Olá, ${firstName}!` : 'Olá!';

  return [
    `${hello} A ${who} indica o Conecta+, uma plataforma para a gestão e a comunhão da igreja.`,
    'Pedimos que você preencha e envie o formulário com os dados da sua igreja. Assim a equipe Conecta+ consegue dar continuidade ao contato.',
    '',
    `Acesse o formulário: ${pageUrl}`,
  ].join('\n');
}
