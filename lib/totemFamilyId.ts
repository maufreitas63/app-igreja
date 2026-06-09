/** Normaliza código de família para comparação no totem (maiúsculas, sem espaços nas bordas). */
export const normalizeFamilyId = (value: string) => value.trim().toUpperCase();
