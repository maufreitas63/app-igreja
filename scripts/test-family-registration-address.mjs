/**
 * Valida resolução de endereço por CEP para o cadastro familiar (ViaCEP).
 * Uso: node scripts/test-family-registration-address.mjs
 */

const normalizeCepDigits = (cep) => {
  const digits = (cep ?? '').replace(/\D/g, '');
  return digits.length === 8 ? digits : null;
};

const formatCep = (digits) => `${digits.slice(0, 5)}-${digits.slice(5)}`;

async function lookupViaCep(cepDigits) {
  const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
  if (!response.ok) {
    throw new Error(`ViaCEP HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.erro) {
    throw new Error('CEP não encontrado na ViaCEP');
  }

  return data;
}

async function buildCepAddressPayload(cep, addressNumber, addressComplement) {
  const cepDigits = normalizeCepDigits(cep);
  const patch = {
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
  return {
    ...patch,
    address_street: viaCep.logradouro?.trim() || null,
    address_neighborhood: viaCep.bairro?.trim() || null,
    address_city: viaCep.localidade?.trim() || null,
    address_state: viaCep.uf?.trim() || null,
  };
}

async function main() {
  const payload = await buildCepAddressPayload('11677-044', '123', 'Apto 1');

  const required = ['cep', 'address_street', 'address_neighborhood', 'address_city', 'address_state'];
  const missing = required.filter((key) => !payload[key]);

  if (missing.length > 0) {
    console.error('FALHA — campos ausentes:', missing.join(', '));
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  if (payload.cep !== '11677-044') {
    console.error('FALHA — CEP formatado incorreto:', payload.cep);
    process.exit(1);
  }

  if (payload.address_city !== 'Caraguatatuba' || payload.address_state !== 'SP') {
    console.error('FALHA — cidade/UF inesperados:', payload.address_city, payload.address_state);
    process.exit(1);
  }

  console.log('OK — endereço resolvido pelo CEP 11677-044:');
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error('FALHA —', error instanceof Error ? error.message : error);
  process.exit(1);
});
