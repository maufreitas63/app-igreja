/**
 * Gera scripts/ibs-instance-seed.sql — carga exclusiva da instância IBS.
 * Não altera IBN/IBEP. Reexecutável: limpa só marcadores IBS9xxx / @ibs.conectamais.app.
 *
 * Uso: node scripts/generate-ibs-seed.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'ibs-instance-seed.sql');

const IBS = '81295e39-9167-40b4-a524-702439905e75';
const IBN = 'a0000000-0000-4000-8000-000000000001';
const MAURICIO = '04b919ba-38b4-4fe5-a371-2e98e9acbc0d';
const TODAY = new Date('2026-09-10T12:00:00-03:00');

function ibsUuid(n) {
  return `c81295e3-9167-40b4-8524-${String(n).padStart(12, '0')}`;
}

function sqlStr(v) {
  if (v == null) return 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function addDays(base, n) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function addYears(base, n) {
  const d = new Date(base.getTime());
  d.setFullYear(d.getFullYear() + n);
  return d;
}

function formatPhone(seq) {
  const d = String(11988100000 + seq);
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatRecepcaoPhone(seq) {
  const d = String(11977100000 + seq);
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function slugEmail(fullName, seq) {
  const base = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${base}.${seq}@ibs.conectamais.app`;
}

let rngState = 20260910;
function rand() {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 0x100000000;
}
function randInt(min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

const MEN = [
  'Ricardo', 'Eduardo', 'Carlos', 'Paulo', 'André', 'Marcos', 'Felipe', 'Rafael',
  'Lucas', 'Gabriel', 'Thiago', 'Bruno', 'Diego', 'Leandro', 'Rodrigo', 'Fernando',
  'Gustavo', 'Henrique', 'Samuel', 'Daniel', 'Alexandre', 'Vitor', 'Mateus', 'Caio',
  'Renato', 'Sérgio', 'Antônio', 'José', 'João', 'Pedro', 'Luiz', 'Marcelo',
  'Rogério', 'Cláudio', 'Fábio', 'Igor', 'Murilo', 'Otávio', 'Nelson', 'Wagner',
  'César', 'Adriano', 'Vinícius', 'Cristiano', 'Júlio', 'Heitor', 'Enzo', 'Davi',
];
const WOMEN = [
  'Ana', 'Maria', 'Juliana', 'Fernanda', 'Patrícia', 'Camila', 'Beatriz', 'Larissa',
  'Amanda', 'Bruna', 'Carolina', 'Daniela', 'Eliane', 'Fabiana', 'Gabriela', 'Helena',
  'Isabela', 'Jéssica', 'Karina', 'Letícia', 'Mariana', 'Natália', 'Olivia', 'Priscila',
  'Renata', 'Sabrina', 'Tatiane', 'Vanessa', 'Aline', 'Bianca', 'Cristina', 'Débora',
  'Elisa', 'Flávia', 'Giovana', 'Heloísa', 'Ingrid', 'Júlia', 'Lívia', 'Mônica',
  'Paula', 'Raquel', 'Simone', 'Tereza', 'Vera', 'Aparecida', 'Lúcia', 'Sônia',
];
const BOYS = [
  'Miguel', 'Arthur', 'Heitor', 'Theo', 'Davi', 'Gael', 'Bernardo', 'Samuel',
  'João Pedro', 'Benício', 'Lorenzo', 'Ravi', 'Noah', 'Isaac', 'Caleb', 'Nicolas',
];
const GIRLS = [
  'Helena', 'Alice', 'Laura', 'Maria Clara', 'Valentina', 'Heloísa', 'Liz', 'Cecília',
  'Manuela', 'Sophia', 'Isis', 'Lorena', 'Luna', 'Maya', 'Eloá', 'Isadora',
];
const SURNAMES = [
  'Almeida', 'Nogueira', 'Barbosa', 'Cardoso', 'Teixeira', 'Mendes', 'Azevedo',
  'Monteiro', 'Ribeiro', 'Carvalho', 'Moreira', 'Nunes', 'Castro', 'Fernandes',
  'Araujo', 'Correia', 'Pinto', 'Rocha', 'Dias', 'Gomes', 'Lima', 'Pereira',
  'Alves', 'Ferreira', 'Rodrigues', 'Oliveira', 'Santos', 'Machado', 'Batista',
  'Campos', 'Vieira', 'Moura', 'Cavalcanti', 'Peixoto', 'Siqueira', 'Tavares',
  'Aguiar', 'Barros', 'Cunha', 'Duarte', 'Farias', 'Guimarães', 'Leal', 'Macedo',
  'Neves', 'Pacheco', 'Queiroz', 'Rezende', 'Sampaio', 'Vasconcelos',
];

const ADDRESSES = [
  { cep: '09750-240', street: 'Rua Marechal Deodoro', neighborhood: 'Centro' },
  { cep: '09715-140', street: 'Rua Jurubatuba', neighborhood: 'Centro' },
  { cep: '09725-150', street: 'Avenida Senador Vergueiro', neighborhood: 'Jardim do Mar' },
  { cep: '09600-010', street: 'Avenida Kennedy', neighborhood: 'Rudge Ramos' },
  { cep: '09635-000', street: 'Rua dos Vianas', neighborhood: 'Rudge Ramos' },
  { cep: '09770-310', street: 'Rua Baeta Neves', neighborhood: 'Baeta Neves' },
  { cep: '09780-220', street: 'Rua Nova Petrópolis', neighborhood: 'Nova Petrópolis' },
  { cep: '09820-130', street: 'Rua Ferrazópolis', neighborhood: 'Ferrazópolis' },
  { cep: '09861-040', street: 'Avenida Demarchi', neighborhood: 'Demarchi' },
  { cep: '09890-210', street: 'Rua Assunção', neighborhood: 'Assunção' },
  { cep: '09750-500', street: 'Rua Silva Jardim', neighborhood: 'Centro' },
  { cep: '09751-020', street: 'Rua Brás Cubas', neighborhood: 'Centro' },
  { cep: '09606-000', street: 'Rua Tamandaré', neighborhood: 'Rudge Ramos' },
  { cep: '09811-150', street: 'Rua dos Otonis', neighborhood: 'Assunção' },
  { cep: '09726-000', street: 'Avenida Pereira Barreto', neighborhood: 'Jardim do Mar' },
];

const usedNames = new Set();
function uniqueName(first, surA, surB) {
  let name = `${first} ${surA} ${surB}`;
  let i = 0;
  while (usedNames.has(name)) {
    i += 1;
    name = `${first} ${surA} ${pick(SURNAMES)}`;
    if (i > 40) name = `${first} ${surA} ${surB} ${randInt(1, 9)}`;
  }
  usedNames.add(name);
  return name;
}

const people = [];
let nextId = 1;
let nextFamily = 9001;
let nextPhone = 1;
let nextPin = 4100;

function birthOn(ageYears, month, day) {
  const d = new Date(TODAY.getTime());
  d.setFullYear(d.getFullYear() - ageYears);
  d.setMonth(month - 1, day);
  return d;
}

function addPerson(opts) {
  const id = ibsUuid(nextId++);
  const isChild = !!opts.isChild;
  const phone = isChild ? null : formatPhone(nextPhone++);
  const pin = isChild ? null : String(nextPin++);
  const person = {
    id,
    familyId: opts.familyId,
    fullName: opts.fullName,
    role: opts.role || null,
    relationship: opts.relationship,
    birth: opts.birth,
    phone,
    email: isChild ? null : slugEmail(opts.fullName, nextId),
    pin,
    isActive: !isChild,
    isChild,
    gender: opts.gender,
    cep: opts.addr.cep,
    street: opts.addr.street,
    number: String(opts.number),
    neighborhood: opts.addr.neighborhood,
    isHead: !!opts.isHead,
    extraRoles: opts.extraRoles || [],
  };
  people.push(person);
  return person;
}

function newFamilyAddr() {
  const addr = pick(ADDRESSES);
  return { addr, number: randInt(15, 980), familyId: `IBS${nextFamily++}` };
}

function makeCoupleKids(adultRole, nKids, ageBand) {
  const { addr, number, familyId } = newFamilyAddr();
  const surA = pick(SURNAMES);
  let surB = pick(SURNAMES);
  if (surB === surA) surB = pick(SURNAMES);

  let fatherAge;
  let motherAge;
  if (ageBand === 'elderly') {
    fatherAge = randInt(67, 82);
    motherAge = fatherAge - randInt(1, 5);
  } else if (ageBand === 'young') {
    fatherAge = randInt(26, 36);
    motherAge = fatherAge - randInt(0, 4);
  } else {
    fatherAge = randInt(34, 52);
    motherAge = fatherAge - randInt(0, 6);
  }
  if (motherAge < 24 && nKids > 0) motherAge = 24 + randInt(0, 4);

  const fatherName = uniqueName(pick(MEN), surA, surB);
  const motherName = uniqueName(pick(WOMEN), surB, surA);

  const father = addPerson({
    familyId,
    fullName: fatherName,
    role: adultRole,
    relationship: 'Representante Legal',
    birth: birthOn(fatherAge, randInt(1, 12), randInt(1, 28)),
    gender: 'M',
    addr,
    number,
    isHead: true,
  });
  const mother = addPerson({
    familyId,
    fullName: motherName,
    role: adultRole,
    relationship: 'Cônjuge',
    birth: birthOn(motherAge, randInt(1, 12), randInt(1, 28)),
    gender: 'F',
    addr,
    number,
  });

  const kids = [];
  const maxChildAge = Math.min(16, motherAge - 20);
  for (let i = 0; i < nKids; i++) {
    const girl = rand() < 0.5;
    const age = Math.max(0, maxChildAge - i * randInt(2, 4));
    const childAge = Math.min(16, age);
    if (motherAge - childAge < 18) continue;
    kids.push(
      addPerson({
        familyId,
        fullName: uniqueName(girl ? pick(GIRLS) : pick(BOYS), surA, surB),
        role: null,
        relationship: 'Filho(a)',
        birth: birthOn(childAge, randInt(1, 12), randInt(1, 28)),
        gender: girl ? 'F' : 'M',
        addr,
        number,
        isChild: true,
      }),
    );
  }
  return { father, mother, kids, familyId, addr };
}

function makeSingleParent(adultRole, nKids) {
  const { addr, number, familyId } = newFamilyAddr();
  const woman = rand() < 0.7;
  const surA = pick(SURNAMES);
  const surB = pick(SURNAMES);
  const parentAge = randInt(28, 48);
  const parent = addPerson({
    familyId,
    fullName: uniqueName(woman ? pick(WOMEN) : pick(MEN), surA, surB),
    role: adultRole,
    relationship: 'Representante Legal',
    birth: birthOn(parentAge, randInt(1, 12), randInt(1, 28)),
    gender: woman ? 'F' : 'M',
    addr,
    number,
    isHead: true,
  });
  for (let i = 0; i < nKids; i++) {
    const girl = rand() < 0.5;
    const childAge = Math.min(16, Math.max(1, parentAge - 22 - i * 3));
    if (parentAge - childAge < 18) continue;
    addPerson({
      familyId,
      fullName: uniqueName(girl ? pick(GIRLS) : pick(BOYS), surA, surB),
      role: null,
      relationship: 'Filho(a)',
      birth: birthOn(childAge, randInt(1, 12), randInt(1, 28)),
      gender: girl ? 'F' : 'M',
      addr,
      number,
      isChild: true,
    });
  }
  return parent;
}

function makeUnipessoal(adultRole, ageBand) {
  const { addr, number, familyId } = newFamilyAddr();
  const woman = rand() < 0.5;
  let age;
  if (ageBand === 'elderly') age = randInt(66, 84);
  else if (ageBand === 'young') age = randInt(19, 27);
  else age = randInt(28, 58);
  return addPerson({
    familyId,
    fullName: uniqueName(woman ? pick(WOMEN) : pick(MEN), pick(SURNAMES), pick(SURNAMES)),
    role: adultRole,
    relationship: 'Representante Legal',
    birth: birthOn(age, randInt(1, 12), randInt(1, 28)),
    gender: woman ? 'F' : 'M',
    addr,
    number,
    isHead: true,
  });
}

function countRole(role) {
  return people.filter((p) => p.role === role).length;
}

function fillRole(role, target, plan) {
  for (const step of plan) {
    while (countRole(role) + step.adults <= target) {
      if (step.kind === 'couple') makeCoupleKids(role, step.kids, step.age);
      else if (step.kind === 'single') makeSingleParent(role, step.kids);
      else makeUnipessoal(role, step.age);
    }
  }
  while (countRole(role) < target) makeUnipessoal(role, 'adult');
}

// 2 pastores com família
const pastor1 = makeCoupleKids('member', 2, 'adult');
pastor1.father.role = 'pastoral';
pastor1.father.fullName = uniqueName('Ricardo', 'Almeida', 'Menezes');
usedNames.add(pastor1.father.fullName);
const pastor2 = makeCoupleKids('member', 2, 'adult');
pastor2.father.role = 'pastoral';
pastor2.father.fullName = uniqueName('Eduardo', 'Nogueira', 'Camargo');
usedNames.add(pastor2.father.fullName);

fillRole('member', 100, [
  { kind: 'couple', adults: 2, kids: 2, age: 'adult' },
  { kind: 'couple', adults: 2, kids: 1, age: 'young' },
  { kind: 'couple', adults: 2, kids: 0, age: 'adult' },
  { kind: 'couple', adults: 2, kids: 0, age: 'elderly' },
  { kind: 'single', adults: 1, kids: 2 },
  { kind: 'uni', adults: 1, kids: 0, age: 'elderly' },
  { kind: 'uni', adults: 1, kids: 0, age: 'adult' },
]);

fillRole('congregado', 100, [
  { kind: 'couple', adults: 2, kids: 2, age: 'adult' },
  { kind: 'couple', adults: 2, kids: 0, age: 'adult' },
  { kind: 'single', adults: 1, kids: 1 },
  { kind: 'uni', adults: 1, kids: 0, age: 'young' },
  { kind: 'uni', adults: 1, kids: 0, age: 'elderly' },
]);

fillRole('visitantes', 50, [
  { kind: 'couple', adults: 2, kids: 1, age: 'young' },
  { kind: 'couple', adults: 2, kids: 0, age: 'adult' },
  { kind: 'uni', adults: 1, kids: 0, age: 'young' },
  { kind: 'uni', adults: 1, kids: 0, age: 'adult' },
]);

const memberHeads = people.filter((p) => p.role === 'member' && p.isHead);
const congregadoHeads = people.filter((p) => p.role === 'congregado' && p.isHead);
const pastors = people.filter((p) => p.role === 'pastoral');

if (memberHeads[0]) memberHeads[0].extraRoles.push('secretaria');
if (memberHeads[1]) memberHeads[1].extraRoles.push('tesoureiro');
if (memberHeads[2]) memberHeads[2].extraRoles.push('family_acceptor');

const cellMeta = [
  { name: 'Célula Rudge Ramos', weekday: 3, time: '19:30', notes: 'Reunião semanal na casa do anfitrião, bairro Rudge Ramos.' },
  { name: 'Célula Centro', weekday: 4, time: '20:00', notes: 'Pequeno grupo no Centro de São Bernardo do Campo.' },
  { name: 'Célula Assunção', weekday: 2, time: '19:45', notes: 'Encontro de discipulado no bairro Assunção.' },
  { name: 'Célula Baeta Neves', weekday: 5, time: '20:00', notes: 'Célula familiar em Baeta Neves.' },
  { name: 'Célula Ferrazópolis', weekday: 3, time: '19:00', notes: 'Grupo de comunhão em Ferrazópolis.' },
];

const lines = [];
function w(s = '') {
  lines.push(s);
}

w(`-- =============================================================================`);
w(`-- Carga exclusiva da instância IBS (Igreja Batista Semeadores da Verdade)`);
w(`-- Gerado por scripts/generate-ibs-seed.mjs em ${isoDate(TODAY)}`);
w(`-- Isolamento: todas as escritas usam tenant_id IBS. IBN e IBEP permanecem intactos.`);
w(`-- Reexecutável: remove apenas family_id IBS9xxx, e-mails @ibs.conectamais.app e`);
w(`-- dados operacionais já existentes na IBS (hoje vazios, além de KIDS/TEENS).`);
w(`-- =============================================================================`);
w(`begin;`);
w(`set local row_security = off;`);
w(`select set_config('app.bypass_tenant_guard', 'on', true);`);
w(``);
w(`do $seed$`);
w(`declare`);
w(`  v_ibs uuid := '${IBS}'::uuid;`);
w(`  v_ibn uuid := '${IBN}'::uuid;`);
w(`  v_mauricio uuid := '${MAURICIO}'::uuid;`);
w(`begin`);
w(`  if not exists (select 1 from public.igrejas i where i.id = v_ibs and i.code = 'IBS') then`);
w(`    raise exception 'Tenant IBS não encontrado';`);
w(`  end if;`);
w(`end;`);
w(`$seed$;`);
w(``);
w(`-- ---------------------------------------------------------------------------`);
w(`-- 0. Limpeza idempotente (somente IBS / marcadores desta carga)`);
w(`-- ---------------------------------------------------------------------------`);
w(`delete from public.scale_swap_notices n`);
w(` where n.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.scale_swap_audit a`);
w(` where a.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.scale_swap_requests r`);
w(` where r.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.escalas_log el`);
w(` where el.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.voluntarios_escala ve`);
w(` where ve.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.tipos_escala te`);
w(` where te.tenant_id = '${IBS}'::uuid;`);
w(``);
w(`delete from public.pastoral_slot_notices n`);
w(` where n.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.pastoral_slots s`);
w(` where s.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.pastoral_requests pr`);
w(` where pr.tenant_id = '${IBS}'::uuid;`);
w(``);
w(`delete from public.small_group_attendance a`);
w(` where a.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.small_group_members m`);
w(` where m.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.small_groups g`);
w(` where g.tenant_id = '${IBS}'::uuid;`);
w(``);
w(`delete from public.event_avisos a`);
w(` where a.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.event_registrations er`);
w(` where er.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.events e`);
w(` where e.tenant_id = '${IBS}'::uuid;`);
w(``);
w(`delete from public.campaign_contribution_intents i`);
w(` where i.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.campaign_milestone_notices n`);
w(` where n.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.financials f`);
w(` where f.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.campaign_projects c`);
w(` where c.tenant_id = '${IBS}'::uuid;`);
w(``);
w(`delete from public.volunteer_opportunity_interests i`);
w(` where i.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.volunteer_opportunities o`);
w(` where o.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.generosity_interests gi`);
w(` where gi.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.generosity_notices gn`);
w(` where gn.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.generosity_posts gp`);
w(` where gp.tenant_id = '${IBS}'::uuid;`);
w(``);
w(`delete from public.recepcao_cadastro_familiar r`);
w(` where r.tenant_id = '${IBS}'::uuid;`);
w(`delete from public.recepcao_cadastro_familiar_lote l`);
w(` where l.tenant_id = '${IBS}'::uuid;`);
w(``);
w(`delete from public.livros l`);
w(` where l.tenant_id = '${IBS}'::uuid;`);
w(``);
w(`delete from public.profile_access_roles par`);
w(` where par.profile_id in (`);
w(`   select p.id from public.profiles p`);
w(`    where p.family_id ~ '^IBS9[0-9]{3}$'`);
w(`       or lower(coalesce(p.email, '')) like '%@ibs.conectamais.app'`);
w(` );`);
w(`delete from public.profile_igreja_vinculos v`);
w(` where v.profile_id in (`);
w(`   select p.id from public.profiles p`);
w(`    where p.family_id ~ '^IBS9[0-9]{3}$'`);
w(`       or lower(coalesce(p.email, '')) like '%@ibs.conectamais.app'`);
w(` );`);
w(`delete from public.members m`);
w(` where m.tenant_id = '${IBS}'::uuid`);
w(`   and m.family_id ~ '^IBS9[0-9]{3}$';`);
w(`delete from public.profiles p`);
w(` where p.id <> '${MAURICIO}'::uuid`);
w(`   and (p.family_id ~ '^IBS9[0-9]{3}$'`);
w(`        or lower(coalesce(p.email, '')) like '%@ibs.conectamais.app');`);
w(``);
w(`-- ---------------------------------------------------------------------------`);
w(`-- 1. Superadministrador Maurício de Freitas na IBS`);
w(`-- ---------------------------------------------------------------------------`);
w(`insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)`);
w(`values ('${MAURICIO}'::uuid, '${IBS}'::uuid, true, true)`);
w(`on conflict (profile_id, tenant_id) do update`);
w(`  set is_active = true, updated_at = now();`);
w(``);
w(`insert into public.profile_access_roles (profile_id, role_id, tenant_id, granted_by_profile_id)`);
w(`select '${MAURICIO}'::uuid, r.id, '${IBS}'::uuid, '${MAURICIO}'::uuid`);
w(`  from public.access_roles r`);
w(` where r.code in ('super_admin', 'member', 'pastoral', 'secretaria', 'tesoureiro', 'family_acceptor')`);
w(`on conflict (profile_id, role_id) do update`);
w(`  set tenant_id = coalesce(public.profile_access_roles.tenant_id, excluded.tenant_id);`);
w(``);
w(`-- ---------------------------------------------------------------------------`);
w(`-- 2. Salas: réplica da configuração IBN (chaves, tipos, datas)`);
w(`-- ---------------------------------------------------------------------------`);
w(`insert into public.church_room_settings (`);
w(`  tenant_id, room_key, display_label, badge_label, color_hex, is_enabled,`);
w(`  sort_order, is_system, room_kind, start_date, end_date`);
w(`)`);
w(`select '${IBS}'::uuid, r.room_key, r.display_label, r.badge_label, r.color_hex, r.is_enabled,`);
w(`       r.sort_order, r.is_system, r.room_kind, r.start_date, r.end_date`);
w(`  from public.church_room_settings r`);
w(` where r.tenant_id = '${IBN}'::uuid`);
w(`on conflict (tenant_id, room_key) do update`);
w(`  set display_label = excluded.display_label,`);
w(`      badge_label = excluded.badge_label,`);
w(`      color_hex = excluded.color_hex,`);
w(`      is_enabled = excluded.is_enabled,`);
w(`      sort_order = excluded.sort_order,`);
w(`      is_system = excluded.is_system,`);
w(`      room_kind = excluded.room_kind,`);
w(`      start_date = excluded.start_date,`);
w(`      end_date = excluded.end_date,`);
w(`      updated_at = now();`);
w(``);
w(`-- ---------------------------------------------------------------------------`);
w(`-- 3. Pessoas, famílias, papéis e vínculos (somente IBS)`);
w(`-- ---------------------------------------------------------------------------`);

const PROFILE_COLS = `(id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date)`;

for (let i = 0; i < people.length; i += 40) {
  const chunk = people.slice(i, i + 40);
  w(`insert into public.profiles ${PROFILE_COLS} values`);
  chunk.forEach((p, idx) => {
    const visit = p.role === 'visitantes' ? sqlStr(isoDate(addDays(TODAY, -randInt(3, 40)))) : 'null';
    const row = `(${sqlStr(p.id)}, '${IBS}'::uuid, ${sqlStr(p.fullName)}, ${sqlStr(p.email)}, ${sqlStr(p.phone)}, ${sqlStr(isoDate(p.birth))}::date, ${sqlStr(p.familyId)}, ${sqlStr(p.familyId)}, true, now(), ${p.isActive}, ${sqlStr(p.pin)}, ${sqlStr(p.cep)}, ${sqlStr(p.street)}, ${sqlStr(p.number)}, ${sqlStr(p.neighborhood)}, 'São Bernardo do Campo', 'SP', ${visit})`;
    w(`  ${row}${idx === chunk.length - 1 ? ';' : ','}`);
  });
  w(``);
}

w(`insert into public.members (id, tenant_id, full_name, phone, birth_date, relationship, family_id, is_responsavel, accepted, category)`);
w(`values`);
people.forEach((p, idx) => {
  const cat = p.isChild ? 'child' : 'member';
  const row = `(${sqlStr(ibsUuid(8000 + idx))}, '${IBS}'::uuid, ${sqlStr(p.fullName)}, ${sqlStr(p.phone)}, ${sqlStr(isoDate(p.birth))}::date, ${sqlStr(p.relationship)}, ${sqlStr(p.familyId)}, ${p.isHead}, true, ${sqlStr(cat)})`;
  w(`  ${row}${idx === people.length - 1 ? ';' : ','}`);
});
w(``);

w(`insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active, membership_status)`);
w(`select p.id, '${IBS}'::uuid, true, true, 'Ativo'`);
w(`  from public.profiles p`);
w(` where p.family_id ~ '^IBS9[0-9]{3}$'`);
w(`on conflict (profile_id, tenant_id) do update set is_active = true, membership_status = 'Ativo';`);
w(``);

const roleMap = {
  pastoral: 'pastoral',
  member: 'member',
  congregado: 'congregado',
  visitantes: 'visitantes',
};

w(`insert into public.profile_access_roles (profile_id, role_id, tenant_id, granted_by_profile_id)`);
w(`select x.profile_id, r.id, '${IBS}'::uuid, '${MAURICIO}'::uuid`);
w(`  from (values`);
const roleRows = [];
for (const p of people) {
  if (!p.role) continue;
  roleRows.push(`    (${sqlStr(p.id)}::uuid, ${sqlStr(roleMap[p.role])})`);
  for (const extra of p.extraRoles) {
    roleRows.push(`    (${sqlStr(p.id)}::uuid, ${sqlStr(extra)})`);
  }
}
w(roleRows.join(',\n'));
w(`  ) as x(profile_id, role_code)`);
w(`  join public.access_roles r on r.code = x.role_code`);
w(`on conflict (profile_id, role_id) do nothing;`);
w(``);
w(`-- Trigger de cadastro atribui Visitantes a todo perfil novo; manter só nos 50 visitantes.`);
w(`delete from public.profile_access_roles par`);
w(` using public.access_roles ar, public.profiles p`);
w(` where par.role_id = ar.id`);
w(`   and ar.code = 'visitantes'`);
w(`   and par.profile_id = p.id`);
w(`   and p.family_id ~ '^IBS9[0-9]{3}$'`);
w(`   and (`);
w(`     coalesce(p.is_active, false) is not true`);
w(`     or exists (`);
w(`       select 1`);
w(`         from public.profile_access_roles par2`);
w(`         join public.access_roles ar2 on ar2.id = par2.role_id`);
w(`        where par2.profile_id = p.id`);
w(`          and ar2.code in ('member', 'congregado', 'pastoral')`);
w(`     )`);
w(`   );`);
w(``);

w(`-- ---------------------------------------------------------------------------`);
w(`-- 4. Pequenos grupos (5 células) com líder e anfitrião`);
w(`-- ---------------------------------------------------------------------------`);
const cellPool = people.filter((p) => !p.isChild && (p.role === 'member' || p.role === 'congregado'));
const usedInCells = new Set();
for (let i = 0; i < 5; i++) {
  const leader = memberHeads[i];
  const host = congregadoHeads[i] || memberHeads[i + 5];
  const meta = cellMeta[i];
  const gid = ibsUuid(5000 + i);
  w(`insert into public.small_groups (`);
  w(`  id, tenant_id, name, meeting_weekday, meeting_time, host_profile_id, leader_profile_id, notes, is_active, created_by_profile_id`);
  w(`) values (`);
  w(`  '${gid}'::uuid, '${IBS}'::uuid, ${sqlStr(meta.name)}, ${meta.weekday}, time ${sqlStr(meta.time)},`);
  w(`  ${sqlStr(host.id)}::uuid, ${sqlStr(leader.id)}::uuid, ${sqlStr(meta.notes)}, true, '${MAURICIO}'::uuid`);
  w(`);`);
  const ids = [];
  for (const pid of [leader.id, host.id]) {
    if (!usedInCells.has(pid)) {
      ids.push(pid);
      usedInCells.add(pid);
    }
  }
  for (const p of cellPool) {
    if (usedInCells.has(p.id)) continue;
    ids.push(p.id);
    usedInCells.add(p.id);
    if (ids.length >= 12) break;
  }
  w(`insert into public.small_group_members (tenant_id, small_group_id, profile_id)`);
  w(`values`);
  ids.forEach((pid, idx) => {
    w(`  ('${IBS}'::uuid, '${gid}'::uuid, ${sqlStr(pid)}::uuid)${idx === ids.length - 1 ? ';' : ','}`);
  });
  w(``);
}

w(`-- ---------------------------------------------------------------------------`);
w(`-- 5. Acervo de livros doados (cópia integral IBN → IBS)`);
w(`-- ---------------------------------------------------------------------------`);
w(`insert into public.livros (tenant_id, isbn, titulo, autor, editora, ano, capa)`);
w(`select '${IBS}'::uuid, l.isbn, l.titulo, l.autor, l.editora, l.ano, l.capa`);
w(`  from public.livros l`);
w(` where l.tenant_id = '${IBN}'::uuid;`);
w(``);

w(`-- ---------------------------------------------------------------------------`);
w(`-- 6. Mural de voluntários, generosidade e recepção (3 famílias pendentes)`);
w(`-- ---------------------------------------------------------------------------`);
const volTitles = [
  ['Acolhimento no culto da manhã', 'Equipe para receber famílias no acesso principal, com cordialidade e orientação de salas.'],
  ['Apoio ao Ministério Infantil', 'Voluntários para acolher crianças de 0 a 11 anos durante o culto, com ficha de alergias em mãos.'],
  ['Intercessão pelos enfermos', 'Grupo de oração que visita irmãos hospitalizados na região do ABC.'],
  ['Ação solidária de cestas', 'Separação e entrega de alimentos do estoque solidário às famílias acompanhadas pela igreja.'],
];
volTitles.forEach((t, i) => {
  w(`insert into public.volunteer_opportunities (`);
  w(`  tenant_id, titulo, descricao, leader_profile_id, required_gifts, status, created_by`);
  w(`) values (`);
  w(`  '${IBS}'::uuid, ${sqlStr(t[0])}, ${sqlStr(t[1])}, ${sqlStr(pastors[0].id)}::uuid,`);
  w(`  array['acolhimento','servico'], 'aberta', '${MAURICIO}'::uuid`);
  w(`);`);
});
w(``);

const genPosts = [
  ['doacao', 'moveis', 'Berço e cômoda em bom estado', 'Família da Célula Centro disponibiliza berço de madeira e cômoda para uma mãe recente da congregação.'],
  ['pedido', 'saude_equipamentos', 'Cadeira de banho para idosa', 'Irmã da Célula Assunção precisa emprestar cadeira de banho por oito semanas após cirurgia.'],
  ['doacao', 'vestuario', 'Agasalhos infantis (4 a 10 anos)', 'Peças lavadas e em ótimo estado para o inverno, retiradas no templo após o culto.'],
  ['doacao', 'livros', 'Bíblias de estudo para novos convertidos', 'Lote de Bíblias para presentear visitantes que concluírem o curso de batismo.'],
];
genPosts.forEach((g, i) => {
  const author = memberHeads[i + 3] || memberHeads[0];
  w(`insert into public.generosity_posts (tenant_id, user_id, tipo, categoria, titulo, descricao, status)`);
  w(`values ('${IBS}'::uuid, ${sqlStr(author.id)}::uuid, ${sqlStr(g[0])}, ${sqlStr(g[1])}, ${sqlStr(g[2])}, ${sqlStr(g[3])}, 'ativo');`);
});
w(``);

const recepcaoFamilies = [
  {
    street: 'Rua Marechal Deodoro',
    neighborhood: 'Centro',
    cep: '09750-240',
    number: '412',
    members: [
      { name: 'Rogério Pacheco Vasconcelos', rel: 'Representante Legal', birth: '1986-03-12', informant: true },
      { name: 'Tatiane Pacheco Vasconcelos', rel: 'Cônjuge', birth: '1988-07-22', informant: false },
      { name: 'Lara Pacheco Vasconcelos', rel: 'Filho(a)', birth: '2016-11-03', informant: false },
    ],
  },
  {
    street: 'Avenida Kennedy',
    neighborhood: 'Rudge Ramos',
    cep: '09600-010',
    number: '1550',
    members: [
      { name: 'Sílvia Guimarães Leal', rel: 'Representante Legal', birth: '1979-01-30', informant: true },
      { name: 'Caio Guimarães Leal', rel: 'Filho(a)', birth: '2012-05-18', informant: false },
    ],
  },
  {
    street: 'Rua Assunção',
    neighborhood: 'Assunção',
    cep: '09890-210',
    number: '88',
    members: [
      { name: 'Benedito Sampaio Queiroz', rel: 'Representante Legal', birth: '1954-09-09', informant: true },
      { name: 'Irene Sampaio Queiroz', rel: 'Cônjuge', birth: '1957-04-14', informant: false },
    ],
  },
];

recepcaoFamilies.forEach((fam, fi) => {
  const loteId = ibsUuid(6000 + fi);
  w(`insert into public.recepcao_cadastro_familiar_lote (id, status, member_count, tenant_id)`);
  w(`values ('${loteId}'::uuid, 'pending', ${fam.members.length}, '${IBS}'::uuid);`);
  fam.members.forEach((m, mi) => {
    const phone = m.informant ? formatRecepcaoPhone(fi * 10 + mi + 1) : null;
    w(`insert into public.recepcao_cadastro_familiar (`);
    w(`  submission_id, is_informant, status, full_name, birth_date, phone, relationship,`);
    w(`  cep, address_number, address_street, address_neighborhood, address_city, address_state, tenant_id`);
    w(`) values (`);
    w(`  '${loteId}'::uuid, ${m.informant}, 'pending', ${sqlStr(m.name)}, ${sqlStr(m.birth)}::date, ${sqlStr(phone)}, ${sqlStr(m.rel)},`);
    w(`  ${sqlStr(fam.cep)}, ${sqlStr(fam.number)}, ${sqlStr(fam.street)}, ${sqlStr(fam.neighborhood)}, 'São Bernardo do Campo', 'SP', '${IBS}'::uuid`);
    w(`);`);
  });
});
w(``);

w(`-- ---------------------------------------------------------------------------`);
w(`-- 7. Agenda de eventos (próximos 60 dias)`);
w(`-- ---------------------------------------------------------------------------`);
const eventDefs = [];
function pushEvent(name, local, date, hour, cap, rooms, kids, teens) {
  eventDefs.push({ name, local, date, hour, cap, rooms, kids, teens });
}
for (let d = 0; d <= 60; d++) {
  const day = addDays(TODAY, d);
  const dow = day.getDay();
  const ds = isoDate(day);
  if (dow === 0) {
    pushEvent('Culto da manhã', 'Salão de Eventos IBS', ds, '10:00', 280, ['KIDS', 'TEENS'], true, true);
    pushEvent('Culto da noite', 'Salão de Eventos IBS', ds, '18:30', 220, ['TEENS'], false, true);
  } else if (dow === 3) {
    pushEvent('Culto de oração e palavra', 'Salão de Eventos IBS', ds, '19:30', 120, [], false, false);
  } else if (dow === 6 && d % 14 === 6) {
    pushEvent('Encontro de casais', 'Salão de Eventos IBS', ds, '19:00', 80, [], false, false);
  } else if (dow === 2 && d > 7 && d < 50) {
    pushEvent('Curso de batismo', 'Curso de Batismo', ds, '20:00', 40, ['CURSO_DE_BATISMO'], false, false);
  }
}
pushEvent('Conferência de missões IBS', 'Salão de Eventos IBS', isoDate(addDays(TODAY, 21)), '19:00', 300, ['KIDS', 'TEENS'], true, true);
pushEvent('Ação solidária — entrega de cestas', 'Salão de Eventos IBS', isoDate(addDays(TODAY, 35)), '09:00', 90, [], false, false);
pushEvent('Retiro de jovens IBS', 'IBS Jovens', isoDate(addDays(TODAY, 42)), '08:00', 60, ['TEENS'], false, true);

eventDefs.forEach((e, i) => {
  const roomsSql = e.rooms.length
    ? `array[${e.rooms.map((k) => sqlStr(k)).join(', ')}]::text[]`
    : `'{}'::text[]`;
  w(`insert into public.events (`);
  w(`  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,`);
  w(`  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys`);
  w(`) values (`);
  w(`  '${IBS}'::uuid, ${sqlStr(e.name)}, ${sqlStr(e.local)},`);
  w(`  timestamptz '${e.date} ${e.hour}:00-03', ${e.cap}, ${e.kids}, ${e.teens},`);
  w(`  true, true, false, false, ${roomsSql}`);
  w(`);`);
});
w(``);

w(`-- ---------------------------------------------------------------------------`);
w(`-- 8. Campanhas (centavos distintos para digitação da direita para a esquerda)`);
w(`-- ---------------------------------------------------------------------------`);
const campaigns = [
  { id: ibsUuid(7001), titulo: 'Reforma do templo', desc: 'Cobertura e climatização do Salão de Eventos IBS.', meta: '85000.17', cents: '0.17', arrec: '12450.17' },
  { id: ibsUuid(7002), titulo: 'Missões transculturais', desc: 'Sustento de missionários e viagens de curta duração.', meta: '42000.31', cents: '0.31', arrec: '8670.31' },
  { id: ibsUuid(7003), titulo: 'Natal solidário do ABC', desc: 'Cestas, higiene e brinquedos para famílias acompanhadas.', meta: '18000.48', cents: '0.48', arrec: '4320.48' },
  { id: ibsUuid(7004), titulo: 'Van do Ministério Infantil', desc: 'Aquisição de van para buscar crianças da periferia.', meta: '95000.62', cents: '0.62', arrec: '15120.62' },
];
campaigns.forEach((c) => {
  w(`insert into public.campaign_projects (`);
  w(`  id, tenant_id, titulo, descricao, meta_financeira, valor_arrecadado, data_inicio, data_fim,`);
  w(`  status, centavos_referencia, created_by_profile_id`);
  w(`) values (`);
  w(`  '${c.id}'::uuid, '${IBS}'::uuid, ${sqlStr(c.titulo)}, ${sqlStr(c.desc)}, ${c.meta}, ${c.arrec},`);
  w(`  date '2026-07-01', date '2026-12-31', 'ativo', ${c.cents}, '${MAURICIO}'::uuid`);
  w(`);`);
});
w(`do $p$ begin perform public.ensure_primicias_defaults('${IBS}'::uuid); end; $p$;`);
w(``);

w(`-- ---------------------------------------------------------------------------`);
w(`-- 9. Avisos do mural (6 comunicados publicados)`);
w(`-- ---------------------------------------------------------------------------`);
const avisos = [
  ['Comunicado pastoral — mês da família', 'Durante setembro, os cultos da noite terão uma palavra especial às famílias da IBS. Tragam os filhos para o momento de bênção.'],
  ['Batismo comunitário', 'Inscrições abertas para o curso de batismo às terças, 20h, na sala Curso de Batismo. Fale com a secretaria após o culto.'],
  ['Reunião de ministérios', 'Líderes de acolhimento, infantil e louvor reúnem-se na quinta, 20h, na sala de Discipulado para alinhar as escalas de outubro.'],
  ['Manutenção da agenda de eventos', 'O culto de oração da quarta passa a começar às 19h30. Confiram a grade no aplicativo antes de sair de casa.'],
  ['Mutirão de limpeza do templo', 'Sábado, 8h, mutirão voluntário para preparar o Salão de Eventos IBS à conferência de missões. Tragam produtos de limpeza se puderem.'],
  ['Células no ABC', 'Novos pequenos grupos em Rudge Ramos, Centro, Assunção, Baeta Neves e Ferrazópolis. Procurem os líderes para encaixe de horário.'],
];
avisos.forEach((a, i) => {
  w(`insert into public.event_avisos (tenant_id, title, body, sort_order, is_published, audience, created_by_profile_id)`);
  w(`values ('${IBS}'::uuid, ${sqlStr(a[0])}, ${sqlStr(a[1])}, ${i + 1}, true, 'all', '${MAURICIO}'::uuid);`);
});
w(``);

w(`-- ---------------------------------------------------------------------------`);
w(`-- 10. Histórico financeiro de 12 meses (dízimos, ofertas, campanhas)`);
w(`-- ---------------------------------------------------------------------------`);
const finRows = [];
const tithers = people.filter((p) => p.role === 'member' && p.isHead).slice(0, 36);
for (let m = 0; m < 12; m++) {
  const monthDate = new Date(2025, 8 + m, 1); // Sep 2025 .. Aug 2026
  const y = monthDate.getFullYear();
  const mo = monthDate.getMonth();
  for (let wkd = 0; wkd < 5; wkd++) {
    const d = new Date(y, mo, 1 + wkd * 7);
    if (d.getMonth() !== mo) continue;
    if (d.getDay() !== 0) d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
    if (d.getMonth() !== mo) continue;
    const ds = isoDate(d);
    const oferta = (3200 + randInt(80, 900) + randInt(0, 99) / 100).toFixed(2);
    finRows.push({
      date: ds,
      account: 'SICREDI',
      amount: oferta,
      ministry: 'OFERTAS',
      kind: 'ENTRADAS',
      movement: 'ORDINÁRIO',
      comments: 'Oferta do culto — IBS',
    });
  }
  tithers.forEach((p, ti) => {
    const day = 5 + (ti % 20);
    const d = new Date(y, mo, day);
    const base = 180 + (ti * 17) % 420;
    const amount = `${base}.00`;
    finRows.push({
      date: isoDate(d),
      account: 'SICREDI',
      amount,
      ministry: 'DÍZIMOS',
      kind: 'ENTRADAS',
      movement: 'ORDINÁRIO',
      comments: `Dízimo — ${p.fullName} / ${p.familyId}`,
    });
  });
  if (m % 2 === 0) {
    finRows.push({
      date: isoDate(new Date(y, mo, 10)),
      account: 'SICREDI',
      amount: '4200.00',
      ministry: 'ALUGUEL',
      kind: 'SAÍDAS',
      movement: 'ORDINÁRIO',
      comments: 'Aluguel do templo IBS',
    });
  }
}
campaigns.forEach((c, ci) => {
  const givers = tithers.slice(ci * 4, ci * 4 + 6);
  givers.forEach((p, gi) => {
    const d = addDays(new Date('2026-07-15T12:00:00-03:00'), ci * 7 + gi);
    const reais = 150 + gi * 40 + ci * 25;
    finRows.push({
      date: isoDate(d),
      account: 'MPAGO',
      amount: `${reais}${c.cents.slice(1)}`,
      ministry: 'CAMPANHAS',
      kind: 'ENTRADAS',
      movement: 'EXTRAORDINÁRIO',
      comments: `Doação campanha ${c.titulo} — ${p.fullName}`,
      campaignId: c.id,
    });
  });
});

for (let i = 0; i < finRows.length; i += 80) {
  const chunk = finRows.slice(i, i + 80);
  w(`insert into public.financials (tenant_id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, campaign_project_id)`);
  w(`values`);
  chunk.forEach((f, idx) => {
    const camp = f.campaignId ? sqlStr(f.campaignId) + '::uuid' : 'null';
    w(`  ('${IBS}'::uuid, ${sqlStr(f.date)}::date, ${sqlStr(f.account)}, ${f.amount}, ${sqlStr(f.ministry)}, ${sqlStr(f.kind)}, ${sqlStr(f.movement)}, 'REALIZADO', ${sqlStr(f.comments)}, ${camp})${idx === chunk.length - 1 ? ';' : ','}`);
  });
  w(``);
}

w(`-- ---------------------------------------------------------------------------`);
w(`-- 11. Escalas com troca, pedidos de oração e agenda pastoral`);
w(`-- ---------------------------------------------------------------------------`);
const scaleTypes = [
  { codigo: 'ibs_acolhimento_estacionamento', nome: 'Acolhimento / Estacionamento', modo: 'equipe', vagas: 4 },
  { codigo: 'ibs_ministerio_infantil', nome: 'Ministério Infantil', modo: 'equipe', vagas: 3 },
  { codigo: 'ibs_louvor', nome: 'Ministério de Louvor', modo: 'individual', vagas: 1 },
];
const scaleServants = people.filter((p) => !p.isChild && (p.role === 'member' || p.role === 'congregado')).slice(10, 34);
scaleTypes.forEach((t, ti) => {
  const tid = ibsUuid(7100 + ti);
  w(`insert into public.tipos_escala (id, tenant_id, codigo, nome, is_ativa, vagas_por_servico, modo_ciclo, allow_swap)`);
  w(`values ('${tid}'::uuid, '${IBS}'::uuid, ${sqlStr(t.codigo)}, ${sqlStr(t.nome)}, true, ${t.vagas}, ${sqlStr(t.modo)}, true);`);
  const servants = scaleServants.slice(ti * 8, ti * 8 + 8);
  servants.forEach((p, si) => {
    const vid = ibsUuid(7200 + ti * 10 + si);
    w(`insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)`);
    w(`values ('${vid}'::uuid, '${IBS}'::uuid, '${tid}'::uuid, ${sqlStr(p.fullName)}, true, ${si + 1});`);
    const sunday = addDays(TODAY, ((7 - TODAY.getDay()) % 7) || 7);
    if (si < t.vagas) {
      w(`insert into public.escalas_log (tenant_id, tipo_escala_id, voluntario_id, data_servico)`);
      w(`values ('${IBS}'::uuid, '${tid}'::uuid, '${vid}'::uuid, ${sqlStr(isoDate(sunday))}::date);`);
    }
  });
  w(``);
});

w(`insert into public.scale_swap_requests (`);
w(`  tenant_id, tipo_escala_id, data_servico, solicitante_profile_id, substituto_profile_id,`);
w(`  voluntario_id_origem, voluntario_id_substituto, status, motivo`);
w(`)`);
w(`select '${IBS}'::uuid, te.id, el.data_servico,`);
w(`       p1.id, p2.id, el.voluntario_id, v2.id, 'pendente',`);
w(`       'Viagem familiar no fim de semana; peço cobertura no Acolhimento.'`);
w(`  from public.tipos_escala te`);
w(`  join public.escalas_log el on el.tipo_escala_id = te.id`);
w(`  join public.voluntarios_escala v1 on v1.id = el.voluntario_id`);
w(`  join public.profiles p1 on p1.full_name = v1.nome and p1.tenant_id = '${IBS}'::uuid`);
w(`  join public.voluntarios_escala v2 on v2.tipo_escala_id = te.id and v2.id <> v1.id`);
w(`  join public.profiles p2 on p2.full_name = v2.nome and p2.tenant_id = '${IBS}'::uuid`);
w(` where te.codigo = 'ibs_acolhimento_estacionamento'`);
w(` order by v2.ordem_sequencial`);
w(` limit 1;`);
w(``);

const prayer = [
  { motivo: 'Cirurgia de joelho da esposa', situacao: 'Fila do SUS com data marcada para outubro', dest: 'Equipe pastoral', conf: true, req: 'family', urg: 2, cat: '10000000-0000-4000-8000-000000000001', sub: '20000000-0000-4000-8000-000000000002' },
  { motivo: 'Desemprego prolongado', situacao: 'Três meses sem renda fixa, aluguel atrasado', dest: 'Equipe pastoral', conf: true, req: 'self', urg: 2, cat: '10000000-0000-4000-8000-000000000003', sub: '20000000-0000-4000-8000-000000000022' },
  { motivo: 'Filho adolescente afastado da fé', situacao: 'Conflitos em casa e recusa em vir aos cultos', dest: 'Equipe pastoral', conf: false, req: 'family', urg: 1, cat: '10000000-0000-4000-8000-000000000002', sub: '20000000-0000-4000-8000-000000000017' },
  { motivo: 'Ansiedade e insônia', situacao: 'Acompanhamento médico iniciado, pede intercessão', dest: 'Equipe pastoral', conf: true, req: 'self', urg: 1, cat: '10000000-0000-4000-8000-000000000001', sub: '20000000-0000-4000-8000-000000000006' },
  { motivo: 'Ações de graças pelo emprego novo', situacao: 'Contrato assinado na última sexta-feira', dest: 'Equipe pastoral', conf: false, req: 'self', urg: 1, cat: '10000000-0000-4000-8000-000000000005', sub: '20000000-0000-4000-8000-000000000046' },
  { motivo: 'Proteção na viagem missionária', situacao: 'Equipe saindo para o interior no próximo mês', dest: 'Equipe pastoral', conf: false, req: 'self', urg: 1, cat: '10000000-0000-4000-8000-000000000004', sub: '20000000-0000-4000-8000-000000000042' },
];
const prayerPeople = people.filter((p) => p.role === 'member' && !p.isChild).slice(0, prayer.length);
prayer.forEach((pr, i) => {
  const p = prayerPeople[i];
  w(`insert into public.pastoral_requests (`);
  w(`  tenant_id, profile_id, phone, motivo, situacao, description, category_id, subcategory_id,`);
  w(`  destination_label, confidential, request_for, status, urgency_level, target_role, contact_preference`);
  w(`) values (`);
  w(`  '${IBS}'::uuid, ${sqlStr(p.id)}::uuid, ${sqlStr(p.phone)}, ${sqlStr(pr.motivo)}, ${sqlStr(pr.situacao)},`);
  w(`  ${sqlStr(pr.situacao)}, '${pr.cat}'::uuid, '${pr.sub}'::uuid, ${sqlStr(pr.dest)}, ${pr.conf}, ${sqlStr(pr.req)},`);
  w(`  'new', ${pr.urg}, 'pastor', 'message'`);
  w(`);`);
});
w(``);

w(`-- Agenda pastoral: seg–sex, 08h–21h, próximos 21 dias úteis`);
w(`insert into public.pastoral_slots (`);
w(`  tenant_id, pastor_id, data_hora_inicio, data_hora_fim, status, tipo_atendimento, is_published, created_by_profile_id`);
w(`)`);
w(`select '${IBS}'::uuid, p.id,`);
w(`       ts, ts + interval '50 minutes', 'disponivel',`);
w(`       case when extract(hour from ts) >= 18 then 'online' else 'presencial' end,`);
w(`       true, '${MAURICIO}'::uuid`);
w(`  from (values`);
w(`    (${sqlStr(pastors[0].id)}::uuid),`);
w(`    (${sqlStr(pastors[1].id)}::uuid)`);
w(`  ) as p(id)`);
w(`  cross join generate_series(`);
w(`    date '2026-09-11', date '2026-10-09', interval '1 day'`);
w(`  ) as d(day)`);
w(`  cross join (values (time '08:00'), (time '10:30'), (time '14:00'), (time '16:30'), (time '19:00')) as h(hh)`);
w(`  cross join lateral (`);
w(`    select (d.day + h.hh) at time zone 'America/Sao_Paulo' as ts`);
w(`  ) x`);
  w(` where extract(isodow from d.day) between 1 and 5`);
w(`   and mod(abs(hashtext(p.id::text || d.day::text || h.hh::text)), 3) = 0;`);
w(``);

w(`commit;`);
w(``);
w(`-- Conferência (não altera dados)`);
w(`select 'IBS_profiles_login' as metric, count(*)::text as value`);
w(`  from public.profiles p`);
w(`  join public.profile_igreja_vinculos v on v.profile_id = p.id and v.tenant_id = '${IBS}'::uuid and v.is_active`);
w(` where p.is_active and p.family_id ~ '^IBS9[0-9]{3}$'`);
w(`union all select 'IBS_members', count(*)::text from public.members m where m.tenant_id = '${IBS}'::uuid`);
w(`union all select 'IBS_rooms', count(*)::text from public.church_room_settings r where r.tenant_id = '${IBS}'::uuid`);
w(`union all select 'IBS_livros', count(*)::text from public.livros l where l.tenant_id = '${IBS}'::uuid`);
w(`union all select 'IBS_events', count(*)::text from public.events e where e.tenant_id = '${IBS}'::uuid`);
w(`union all select 'IBS_campaigns', count(*)::text from public.campaign_projects c where c.tenant_id = '${IBS}'::uuid`);
w(`union all select 'IBS_avisos', count(*)::text from public.event_avisos a where a.tenant_id = '${IBS}'::uuid`);
w(`union all select 'IBS_celulas', count(*)::text from public.small_groups g where g.tenant_id = '${IBS}'::uuid`);
w(`union all select 'IBS_recepcao_pending', count(*)::text from public.recepcao_cadastro_familiar_lote l where l.tenant_id = '${IBS}'::uuid and l.status = 'pending'`);
w(`union all select 'IBS_financials', count(*)::text from public.financials f where f.tenant_id = '${IBS}'::uuid`)
w(`union all select 'IBN_vinculos', count(*)::text from public.profile_igreja_vinculos v where v.tenant_id = '${IBN}'::uuid and v.is_active`)
w(`union all select 'IBN_financials', count(*)::text from public.financials f where f.tenant_id = '${IBN}'::uuid`)
w(`union all select 'IBEP_vinculos', count(*)::text from public.profile_igreja_vinculos v where v.tenant_id = '68b9e46e-a5e9-45b5-9124-ffa3447d14f4'::uuid and v.is_active;`);

const sql = lines.join('\n') + '\n';
fs.writeFileSync(OUT, sql, 'utf8');

const login = people.filter((p) => p.isActive);
const byRole = {};
for (const p of login) {
  byRole[p.role] = (byRole[p.role] || 0) + 1;
}
console.log('Wrote', OUT);
console.log('bytes', sql.length);
console.log('profiles', people.length, 'login', login.length, byRole);
console.log('families', new Set(people.map((p) => p.familyId)).size);
console.log('events', eventDefs.length, 'financials', finRows.length);
console.log('pastors', pastors.map((p) => p.fullName));
