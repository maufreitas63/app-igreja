export const FICTIONAL = {
  representative: 'TstMax F001 Representante',
  spouse: 'TstMax F001 Conjuge',
  kid: 'TstMax F001 Filho Kids 2',
  teen: 'TstMax F001 Filho Teen 3',
  familyCode: 'TstMaxF001',
  memberCode: 'TstMaxF001',
  phonePrimary: '(12) 99000-1001',
  phoneSecondary: '(12) 99000-1002',
  phoneTertiary: '(12) 99000-1003',
  cnpj: '12.345.678/0001-99',
  pixKey: 'tstmax.pix@demo.igreja',
  churchName: 'Igreja Demo TstMax',
  plate: 'TST0001',
  emailDomain: '@tstmax.demo',
};

export function pad3(n) {
  return String(n).padStart(3, '0');
}

export function fictionalIndividualName(index) {
  return `TstMax I${pad3(index)} Individual`;
}

export function fictionalFamilyRepresentative(index) {
  return `TstMax F${pad3(index)} Representante`;
}
