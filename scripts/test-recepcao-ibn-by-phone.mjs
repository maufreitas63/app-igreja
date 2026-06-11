/**
 * Espelha a lógica de IBN/celular da recepção familiar (ver recepcao-cadastro-familiar.sql).
 * Uso: node scripts/test-recepcao-ibn-by-phone.mjs
 */

const normalizePhone = (value) => (value ?? '').replace(/\D/g, '');

function findFamilyIdByPhonesInProfiles(phones, profiles) {
  const digits = [...new Set(phones.map(normalizePhone).filter((d) => d.length >= 10))];
  const familyIds = new Set();

  for (const profile of profiles) {
    const profileDigits = normalizePhone(profile.phone);
    if (!profileDigits || profileDigits.length < 10) continue;
    if (!digits.includes(profileDigits)) continue;

    const familyId = (profile.family_id || profile.codigo_membro || '').trim();
    if (familyId) familyIds.add(familyId);
  }

  return familyIds.size === 1 ? [...familyIds][0] : null;
}

function phoneClaimedByOtherProfile(phone, fullName, profiles) {
  const digits = normalizePhone(phone);
  if (!digits || digits.length < 10) return false;

  const name = (fullName ?? '').trim().toLowerCase();
  return profiles.some((p) => {
    const pDigits = normalizePhone(p.phone);
    if (pDigits !== digits) return false;
    const pName = (p.full_name ?? '').trim().toLowerCase();
    return !name || pName !== name;
  });
}

function phoneForStorage(phone, fullName, profiles) {
  return phoneClaimedByOtherProfile(phone, fullName, profiles) ? null : phone.trim() || null;
}

function assert(condition, message) {
  if (!condition) {
    console.error('FALHA —', message);
    process.exit(1);
  }
}

const profiles = [
  {
    full_name: 'Maria Silva',
    phone: '(12) 99999-8888',
    family_id: 'IBN0042',
    codigo_membro: 'IBN0042',
  },
];

const formPhones = ['(12) 99999-8888', '(12) 98888-7777'];

const ibn = findFamilyIdByPhonesInProfiles(formPhones, profiles);
assert(ibn === 'IBN0042', `IBN esperado IBN0042, obtido ${ibn}`);

assert(
  phoneClaimedByOtherProfile('(12) 99999-8888', 'João Silva', profiles),
  'Celular compartilhado deve bloquear vínculo com perfil de outra pessoa'
);

assert(
  !phoneClaimedByOtherProfile('(12) 99999-8888', 'Maria Silva', profiles),
  'Mesmo nome+celular deve permitir vínculo'
);

assert(
  phoneForStorage('(12) 99999-8888', 'João Silva', profiles) === null,
  'Novo integrante com celular já de outro não deve gravar o telefone duplicado'
);

assert(
  phoneForStorage('(12) 99999-8888', 'Maria Silva', profiles) === '(12) 99999-8888',
  'Titular do celular pode manter o telefone'
);

console.log('OK — IBN reutilizado por celular e bloqueio de duplicidade validados.');
