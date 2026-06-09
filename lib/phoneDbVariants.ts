/** Gera variantes de telefone para consultas `.in('phone', …)` no Supabase. */
export const buildPhoneDbQueryVariants = (raw: string): string[] => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  const digits = trimmed.replace(/\D/g, '');
  const variants = new Set<string>([trimmed]);

  if (!digits) {
    return [...variants];
  }

  let local = digits;
  if (digits.startsWith('55') && digits.length >= 12) {
    local = digits.slice(2);
  }

  variants.add(digits);
  variants.add(local);

  if (local.length === 10 || local.length === 11) {
    variants.add(`55${local}`);
    variants.add(`+55${local}`);

    const ddd = local.slice(0, 2);
    const rest = local.slice(2);

    if (local.length === 11) {
      variants.add(`(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`);
      variants.add(`(${ddd})${rest.slice(0, 5)}-${rest.slice(5)}`);
    } else {
      variants.add(`(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`);
      variants.add(`(${ddd})${rest.slice(0, 4)}-${rest.slice(4)}`);
    }
  }

  return [...variants].slice(0, 24);
};
