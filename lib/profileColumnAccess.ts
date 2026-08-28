/** Colunas de `profiles` e o formato de ACL — módulo-folha para evitar ciclos de require. */

export const PROFILE_MANAGE_COLUMN_FIELDS = [
  'full_name',
  'phone',
  'birth_date',
  'email',
  'cpf',
  'cep',
  'address_street',
  'address_number',
  'address_complement',
  'address_neighborhood',
  'address_city',
  'address_state',
  'medical_food_alerts',
  'lgpd_accepted',
  'access_pin',
] as const;

export type ProfileColumnAccess = {
  view: Record<string, boolean>;
  update: Record<string, boolean>;
};

export const profileColumnResourceKey = (fieldKey: string) => `profiles.${fieldKey}`;

export const isProfileColumnAccessLoaded = (access: ProfileColumnAccess) =>
  Object.keys(access.view).length > 0;
