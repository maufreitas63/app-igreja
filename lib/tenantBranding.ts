import type { ImageSource } from 'expo-image';
import type { SessionIgreja } from '@/lib/tenantSession';

const IBN_LOGO = require('@/images/IBNORTE - LOGO MARCA 9.png');

export type TenantLogoResolution =
  | { kind: 'image'; source: ImageSource; label: string }
  | { kind: 'text'; label: string; name: string };

function isHttpUrl(value: string | null | undefined): value is string {
  const trimmed = value?.trim() ?? '';
  return /^https?:\/\//i.test(trimmed);
}

/** Resolve o logo do chrome a partir da instância ativa. */
export function resolveTenantChromeLogo(
  church: Pick<SessionIgreja, 'code' | 'name' | 'logo_url'> | null | undefined
): TenantLogoResolution {
  const name = church?.name?.trim() || 'Igreja';
  const code = (church?.code ?? '').trim().toUpperCase();
  const label = `Logo ${name}`;

  if (isHttpUrl(church?.logo_url)) {
    return {
      kind: 'image',
      source: { uri: church.logo_url.trim() },
      label,
    };
  }

  if (code === 'IBN') {
    return {
      kind: 'image',
      source: IBN_LOGO,
      label,
    };
  }

  return {
    kind: 'text',
    label,
    name,
  };
}
