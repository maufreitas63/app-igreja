export const normalizeCepDigits = (cep: string | null | undefined) => {
  const digits = (cep ?? '').replace(/\D/g, '');
  if (digits.length !== 8) {
    return null;
  }
  return digits;
};

export const formatCep = (cepDigits: string) => `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}`;

export type ViaCepAddress = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  complemento?: string;
};

/** Consulta ViaCEP no navegador (sem dependência de react-native). */
export const lookupViaCep = async (cepDigits: string): Promise<ViaCepAddress | null> => {
  const digits = normalizeCepDigits(cepDigits);
  if (!digits) {
    return null;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ViaCepAddress;
    if (data.erro) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
};

export type CepAddressPayload = {
  cep: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_street: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
};

export async function buildCepAddressPayload(
  cep: string,
  addressNumber: string,
  addressComplement: string
): Promise<CepAddressPayload> {
  const cepDigits = normalizeCepDigits(cep);
  const patch: CepAddressPayload = {
    cep: cepDigits ? formatCep(cepDigits) : null,
    address_number: addressNumber.trim() || null,
    address_complement: addressComplement.trim() || null,
    address_street: null,
    address_neighborhood: null,
    address_city: null,
    address_state: null,
  };

  if (!cepDigits) {
    return patch;
  }

  const viaCep = await lookupViaCep(cepDigits);
  if (!viaCep) {
    return patch;
  }

  return {
    ...patch,
    address_street: viaCep.logradouro?.trim() || null,
    address_neighborhood: viaCep.bairro?.trim() || null,
    address_city: viaCep.localidade?.trim() || null,
    address_state: viaCep.uf?.trim() || null,
  };
}
