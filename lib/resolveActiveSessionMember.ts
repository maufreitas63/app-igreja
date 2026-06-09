import type { FamilyMember } from '@/hooks/useFamilyMembers';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';

const cleanPhoneDigits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

const normalizeName = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

/**
 * Membro da família correspondente ao usuário logado (telefone da sessão ou nome do perfil).
 */
export const resolveActiveSessionMember = (
  members: FamilyMember[],
  options: {
    sessionPhone?: string | null;
    sessionProfileName?: string | null;
  }
): FamilyMember | null => {
  if (!members.length) {
    return null;
  }

  const phoneVariants = buildPhoneDbQueryVariants(options.sessionPhone ?? '');

  if (phoneVariants.length) {
    const byPhone = members.find((member) => {
      const memberPhone = member.phone?.trim() ?? '';
      const memberDigits = cleanPhoneDigits(member.phone);

      return phoneVariants.some((variant) => {
        const variantDigits = cleanPhoneDigits(variant);
        return variant === memberPhone || variantDigits === memberDigits;
      });
    });

    if (byPhone) {
      return byPhone;
    }
  }

  const profileName = normalizeName(options.sessionProfileName);

  if (profileName) {
    const byName = members.find((member) => normalizeName(member.full_name) === profileName);

    if (byName) {
      return byName;
    }
  }

  return null;
};
