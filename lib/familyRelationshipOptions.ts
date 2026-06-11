/** Vínculos familiares canônicos — formulário público, Gerenciar Família e sync automático. */
export const FAMILY_INFORMANT_RELATIONSHIP = 'Representante Legal' as const;

export const FAMILY_RELATIONSHIP_OPTIONS = [
  'Cônjuge',
  'Filho(a)',
  'Representante Legal',
  'Pai',
  'Mãe',
  'Outros',
] as const;

export type FamilyRelationship = (typeof FAMILY_RELATIONSHIP_OPTIONS)[number];

/** Opções exibidas para dependentes no formulário público (informante é sempre Representante Legal). */
export const FAMILY_DEPENDENT_RELATIONSHIP_OPTIONS = FAMILY_RELATIONSHIP_OPTIONS.filter(
  (option) => option !== FAMILY_INFORMANT_RELATIONSHIP
);

export type FamilyDependentRelationship = (typeof FAMILY_DEPENDENT_RELATIONSHIP_OPTIONS)[number];

export const isFamilyRelationship = (value: string): value is FamilyRelationship =>
  (FAMILY_RELATIONSHIP_OPTIONS as readonly string[]).includes(value);

/** Ordem de exibição: representante → cônjuge → filhos → pai → mãe → outros. */
export const FAMILY_RELATIONSHIP_DISPLAY_ORDER = [
  FAMILY_INFORMANT_RELATIONSHIP,
  'Cônjuge',
  'Filho(a)',
  'Pai',
  'Mãe',
  'Outros',
] as const;

const normalizeRelationshipKey = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const familyRelationshipDisplayRank = (relationship: string | null | undefined): number => {
  const normalized = normalizeRelationshipKey(relationship);

  if (normalized === 'representante legal') {
    return 0;
  }

  if (normalized === 'conjuge') {
    return 1;
  }

  if (normalized === 'filho(a)' || normalized === 'filho' || normalized === 'filha') {
    return 2;
  }

  if (normalized === 'pai') {
    return 3;
  }

  if (normalized === 'mae') {
    return 4;
  }

  if (normalized === 'outros') {
    return 5;
  }

  return 99;
};

export const compareFamilyMembersByRelationship = (
  left: { relationship?: string | null; full_name: string },
  right: { relationship?: string | null; full_name: string }
) => {
  const byRank =
    familyRelationshipDisplayRank(left.relationship) - familyRelationshipDisplayRank(right.relationship);

  if (byRank !== 0) {
    return byRank;
  }

  return left.full_name.localeCompare(right.full_name, 'pt-BR');
};
