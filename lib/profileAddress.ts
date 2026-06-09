export const PROFILE_ADDRESS_FIELDS = [
  'cep',
  'address_street',
  'address_number',
  'address_complement',
  'address_neighborhood',
  'address_city',
  'address_state',
] as const;

export type ProfileAddress = {
  cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
};

export type ProfileAddressPatch = Partial<ProfileAddress>;

export const PROFILE_ADDRESS_SELECT = PROFILE_ADDRESS_FIELDS.join(', ');

const toNullableString = (value: unknown) => {
  if (value == null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const pickProfileAddress = (
  profile: Record<string, unknown> | null | undefined
): ProfileAddress => ({
  cep: toNullableString(profile?.cep),
  address_street: toNullableString(profile?.address_street),
  address_number: toNullableString(profile?.address_number),
  address_complement: toNullableString(profile?.address_complement),
  address_neighborhood: toNullableString(profile?.address_neighborhood),
  address_city: toNullableString(profile?.address_city),
  address_state: toNullableString(profile?.address_state),
});

export const hasAnyProfileAddress = (address: ProfileAddress | ProfileAddressPatch) =>
  PROFILE_ADDRESS_FIELDS.some((field) => {
    const value = address[field];
    return value != null && String(value).trim().length > 0;
  });
