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
