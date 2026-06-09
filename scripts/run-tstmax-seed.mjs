/**
 * Executa a carga TstMax via REST/RPC (sem SQL Editor).
 * Uso: node scripts/run-tstmax-seed.mjs
 *
 * Variáveis opcionais:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   TSTMAX_ACTOR_PROFILE_ID — perfil com permissão de eventos (default: Maurício)
 */

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  'https://bldbrsuiwctoaxzcrjoc.supabase.co';
const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZGJyc3Vpd2N0b2F4emNyam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTgyMTQsImV4cCI6MjA5NTAzNDIxNH0.q2ME_1_Qatxfc6Aas02H7A6y6dUpk4BsNQyDIeQYVgU';
const ACTOR_PROFILE_ID =
  process.env.TSTMAX_ACTOR_PROFILE_ID?.trim() ||
  '04b919ba-38b4-4fe5-a371-2e98e9acbc0d';

const REST = `${SUPABASE_URL}/rest/v1`;
const RPC = `${SUPABASE_URL}/rest/v1/rpc`;

const FAMILY_SIZES = [
  1, 2, 3, 2, 3, 4, 2, 2, 3, 3, 2, 4, 1, 2, 3, 2, 3, 2, 3, 1, 2, 4, 2, 3, 2, 3, 4, 2, 1, 3,
];

const ctx = {};

function pad3(n) {
  return String(n).padStart(3, '0');
}

function pad4(n) {
  return String(n).padStart(4, '0');
}

function formatPhoneLikeProfiles(raw) {
  const d = (raw || '').replace(/\D/g, '');
  const n = d.length;
  if (n === 0) return '';
  if (n <= 2) return d;
  if (n <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (n <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function formatCepFromNumber(num) {
  const s = String(num).padStart(8, '0');
  return `${s.slice(0, 5)}-${s.slice(5, 8)}`;
}

function addDaysIso(baseIso, days) {
  const d = new Date(`${baseIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextSundayDate() {
  const today = new Date();
  const dow = today.getDay();
  const d = new Date(today);
  if (dow === 0) d.setDate(d.getDate() + 7);
  else d.setDate(d.getDate() + (7 - dow));
  return d.toISOString().slice(0, 10);
}

function eventIso(baseDate, dayOffset, time) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${baseDate}T12:00:00`);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function addDaysToDate(baseDate, days) {
  const d = new Date(`${baseDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function api(path, { method = 'GET', body, actor = false, actorId, prefer } = {}) {
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  if (actorId) headers['x-profile-id'] = actorId;
  else if (actor) headers['x-profile-id'] = ACTOR_PROFILE_ID;
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${REST}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return data;
}

async function rpc(name, args = {}, { actor = false } = {}) {
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  if (actor) headers['x-profile-id'] = ACTOR_PROFILE_ID;

  const res = await fetch(`${RPC}/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`RPC ${name} → ${res.status}: ${text}`);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function cityForFamily(familyIdx) {
  const cityIdx = (familyIdx - 1) % 3;
  if (cityIdx === 0) {
    return {
      cep: formatCepFromNumber(11660010 + familyIdx),
      street: `TstMax Rua Caraguatatuba ${familyIdx}`,
      neighborhood: 'Centro',
      city: 'Caraguatatuba',
    };
  }
  if (cityIdx === 1) {
    return {
      cep: formatCepFromNumber(11680010 + familyIdx),
      street: `TstMax Rua Ubatuba ${familyIdx}`,
      neighborhood: 'Centro',
      city: 'Ubatuba',
    };
  }
  return {
    cep: formatCepFromNumber(11600010 + familyIdx),
    street: `TstMax Rua Sao Sebastiao ${familyIdx}`,
    neighborhood: 'Centro',
    city: 'São Sebastião',
  };
}

function cityForIndividual(individualIdx) {
  const cityIdx = (individualIdx + 1) % 3;
  if (cityIdx === 0) {
    return {
      cep: `11660-${pad3(200 + individualIdx)}`,
      street: 'TstMax Av Individual Caraguatatuba',
      neighborhood: 'Martim de Sá',
      city: 'Caraguatatuba',
    };
  }
  if (cityIdx === 1) {
    return {
      cep: `11680-${pad3(200 + individualIdx)}`,
      street: 'TstMax Av Individual Ubatuba',
      neighborhood: 'Itaguá',
      city: 'Ubatuba',
    };
  }
  return {
    cep: `11600-${pad3(200 + individualIdx)}`,
    street: 'TstMax Av Individual Sao Sebastiao',
    neighborhood: 'Topolândia',
    city: 'São Sebastião',
  };
}

async function cleanup() {
  console.log('Limpando dados TstMax…');

  await api('/checkins?family_id=like.TstMax*', { method: 'DELETE' });

  const events = await api('/events?name=like.TstMax*&select=id');
  const eventIds = (events || []).map((e) => e.id);
  if (eventIds.length) {
    const inList = `(${eventIds.join(',')})`;
    await api(`/event_quorum_registry?event_id=in.${inList}`, { method: 'DELETE' });
    await api(`/event_registrations?event_id=in.${inList}`, { method: 'DELETE' });
  }
  await api('/event_registrations?family_id=like.TstMax*', { method: 'DELETE' });
  await api('/events?name=like.TstMax*', { method: 'DELETE', actor: true });

  const tipos = await api('/tipos_escala?codigo=like.tstmax*&select=id');
  const tipoIds = (tipos || []).map((t) => t.id);
  if (tipoIds.length) {
    const inList = `(${tipoIds.join(',')})`;
    await api(`/escalas_log?tipo_escala_id=in.${inList}`, { method: 'DELETE' });
    await api(`/voluntarios_escala?tipo_escala_id=in.${inList}`, { method: 'DELETE' });
  }
  await api('/tipos_escala?codigo=like.tstmax*', { method: 'DELETE', actor: true });

  await api('/pastoral_requests?or=(motivo.like.TstMax*,description.like.TstMax*)', {
    method: 'DELETE',
  });
  await api('/profile_vehicles?placa=like.TST*', { method: 'DELETE' });

  const tstmaxProfiles = await api('/profiles?family_id=like.TstMax*&select=id');
  const profileIds = (tstmaxProfiles || []).map((p) => p.id).filter(Boolean);
  if (profileIds.length) {
    const inList = `(${profileIds.join(',')})`;
    await api(`/profile_access_roles?profile_id=in.${inList}`, {
      method: 'DELETE',
      actor: true,
    });
  }

  await api('/members?or=(family_id.like.TstMax*,full_name.like.TstMax*)', { method: 'DELETE' });
  await api('/profiles?family_id=like.TstMax*', { method: 'DELETE', actor: true });
  await api('/profiles?full_name=like.TstMax*', { method: 'DELETE', actor: true });
  await api('/profiles?email=like.*@tstmax.demo', { method: 'DELETE', actor: true });
}

async function seedPopulation() {
  console.log('Inserindo população…');
  let peopleMembers = 0;

  for (let familyIdx = 1; familyIdx <= 30; familyIdx += 1) {
    const familyId = `TstMaxF${pad3(familyIdx)}`;
    const size = FAMILY_SIZES[familyIdx - 1];
    const addr = cityForFamily(familyIdx);

    for (let memberIdx = 1; memberIdx <= size; memberIdx += 1) {
      let phone = formatPhoneLikeProfiles(
        `12${'99'}${String(9000000 + familyIdx * 100 + memberIdx).padStart(7, '0')}`,
      );
      let accepted = true;
      let isActive = false;
      let name;
      let relationship;
      let birth;
      let pin = null;

      if (memberIdx === 1) {
        name = `TstMax F${pad3(familyIdx)} Representante`;
        relationship = 'Representante Legal';
        birth = addDaysIso('1980-01-01', (familyIdx * 37) % 5000);
        pin = pad4(1000 + familyIdx);
        isActive = true;
      } else if (memberIdx === 2 && size === 2 && familyIdx % 5 === 0) {
        name = `TstMax F${pad3(familyIdx)} Conjuge`;
        relationship = 'Cônjuge';
        birth = addDaysIso('1985-06-15', (familyIdx * 11) % 3000);
      } else if (memberIdx === size && familyIdx === 6) {
        name = `TstMax F${pad3(familyIdx)} Pendente`;
        relationship = 'Filho(a)';
        birth = addDaysIso('2015-03-10', memberIdx);
        accepted = false;
        phone = null;
      } else if (memberIdx % 2 === 0) {
        name = `TstMax F${pad3(familyIdx)} Filho Kids ${memberIdx}`;
        relationship = 'Filho(a)';
        birth = addDaysIso('2018-01-01', (familyIdx + memberIdx) % 800);
        phone = null;
      } else {
        name = `TstMax F${pad3(familyIdx)} Filho Teen ${memberIdx}`;
        relationship = 'Filho(a)';
        birth = addDaysIso('2010-01-01', (familyIdx + memberIdx) % 600);
        phone = null;
      }

      const email = `${name.toLowerCase().replace(/ /g, '.')}@tstmax.demo`;
      const profileBase = {
        full_name: name,
        phone,
        birth_date: birth,
        family_id: familyId,
        codigo_membro: familyId,
        lgpd_accepted: true,
        is_active: isActive,
        cep: addr.cep,
        address_street: addr.street,
        address_number: String(10 + memberIdx),
        address_neighborhood: addr.neighborhood,
        address_city: addr.city,
        address_state: 'SP',
      };

      if (memberIdx === 1 || isActive) {
        const rows = await api('/profiles', {
          method: 'POST',
          body: { ...profileBase, email, access_pin: pin },
          prefer: 'return=representation',
        });
        const id = rows?.[0]?.id;
        if (familyIdx === 1) ctx.profile_f1_pai = id;
        if (familyIdx === 3 && memberIdx === 1) ctx.profile_f3_pai = id;
      } else if (accepted) {
        await api('/profiles', {
          method: 'POST',
          body: { ...profileBase, is_active: false },
        });
      }

      await api('/members', {
        method: 'POST',
        body: {
          full_name: name,
          phone,
          birth_date: birth,
          relationship,
          family_id: familyId,
          accepted,
        },
      });
      peopleMembers += 1;
    }
  }

  for (let individualIdx = 1; individualIdx <= 20; individualIdx += 1) {
    const familyId = `TstMaxI${pad3(individualIdx)}`;
    const addr = cityForIndividual(individualIdx);
    const phone = formatPhoneLikeProfiles(`1299005${pad4(individualIdx)}`);
    const name = `TstMax I${pad3(individualIdx)} Individual`;
    const email = `${name.toLowerCase().replace(/ /g, '.')}@tstmax.demo`;
    const birth = addDaysIso('1975-01-01', individualIdx * 97);
    const pin = pad4(3000 + individualIdx);

    await api('/profiles', {
      method: 'POST',
      body: {
        full_name: name,
        email,
        phone,
        birth_date: birth,
        family_id: familyId,
        codigo_membro: familyId,
        lgpd_accepted: true,
        is_active: true,
        access_pin: pin,
        cep: addr.cep,
        address_street: addr.street,
        address_number: String(individualIdx),
        address_neighborhood: addr.neighborhood,
        address_city: addr.city,
        address_state: 'SP',
      },
    });

    await api('/members', {
      method: 'POST',
      body: {
        full_name: name,
        phone,
        birth_date: birth,
        relationship: 'Representante Legal',
        family_id: familyId,
        accepted: true,
      },
    });
    peopleMembers += 1;
  }

  ctx.people_members_total = peopleMembers;
  console.log(`Membros inseridos: ${peopleMembers} (meta >= 80)`);
}

const CITY_CENTERS = {
  'caraguatatuba|sp': { lat: -23.6206, lng: -45.4131 },
  'ubatuba|sp': { lat: -23.433889, lng: -45.071944 },
  'sao sebastiao|sp': { lat: -23.76, lng: -45.41 },
};

function cityCenterKey(city, state) {
  const normalizedCity = (city || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return `${normalizedCity}|${(state || 'sp').trim().toLowerCase()}`;
}

function approximateCoordForCep(cepDigits, city, state) {
  const center = CITY_CENTERS[cityCenterKey(city, state)];
  if (!center) return null;

  const suffix = Number.parseInt(cepDigits.slice(-5), 10) || 0;
  const prefix = Number.parseInt(cepDigits.slice(0, 3), 10) || 0;
  const angle = ((suffix * 137 + prefix * 17) % 360) * (Math.PI / 180);
  const distanceKm = 0.35 + (suffix % 11) * 0.18;
  const kmPerDegLat = 111.32;
  const latRadians = (center.lat * Math.PI) / 180;
  const kmPerDegLng = Math.max(kmPerDegLat * Math.cos(latRadians), 0.01);

  return {
    lat: center.lat + (distanceKm / kmPerDegLat) * Math.cos(angle),
    lng: center.lng + (distanceKm / kmPerDegLng) * Math.sin(angle),
  };
}

async function seedCepGeolocations() {
  const profiles = await api(
    '/profiles?family_id=like.TstMax*&select=cep,address_city,address_state,address_neighborhood&cep=not.is.null',
  );
  const byCep = new Map();

  for (const profile of profiles || []) {
    const digits = (profile.cep || '').replace(/\D/g, '');
    if (digits.length !== 8 || byCep.has(digits)) continue;
    byCep.set(digits, profile);
  }

  console.log(`Gravando ${byCep.size} CEPs TstMax em cep_geolocations…`);
  let upserted = 0;

  for (const [cepDigits, profile] of byCep.entries()) {
    const coord = approximateCoordForCep(
      cepDigits,
      profile.address_city,
      profile.address_state,
    );
    if (!coord) continue;

    try {
      await rpc('upsert_cep_geolocation', {
        p_cep: cepDigits,
        p_latitude: coord.lat,
        p_longitude: coord.lng,
        p_logradouro: null,
        p_bairro: profile.address_neighborhood?.trim() || null,
        p_localidade: profile.address_city?.trim() || null,
        p_uf: profile.address_state?.trim() || 'SP',
        p_source: 'tstmax_seed_approx',
      });
      upserted += 1;
    } catch (err) {
      console.warn(`CEP ${cepDigits}:`, err.message);
    }
  }

  console.log(`CEPs gravados: ${upserted}/${byCep.size}`);
}

async function ensureTstMaxVisitantesOnly() {
  const profiles = await api(
    '/profiles?or=(family_id.like.TstMax*,full_name.like.TstMax*,email.like.*@tstmax.demo)&select=id',
  );
  const ids = (profiles || []).map((p) => p.id).filter(Boolean);
  if (!ids.length) return;

  console.log(`Garantindo ${ids.length} perfis TstMax como visitantes (sem papéis ACL)…`);

  for (let index = 0; index < ids.length; index += 50) {
    const chunk = ids.slice(index, index + 50);
    await api(`/profile_access_roles?profile_id=in.(${chunk.join(',')})`, {
      method: 'DELETE',
      actor: true,
    });
  }

  console.log('Papéis ACL removidos dos perfis TstMax.');
}

async function seedVehicles() {
  const reps = await api(
    '/profiles?full_name=like.TstMax%20F*Representante&address_city=eq.Caraguatatuba&is_active=eq.true&select=phone,full_name&order=full_name&limit=10',
  );
  let n = 1;
  for (const p of reps || []) {
    if (!p.phone) continue;
    try {
      await api('/profile_vehicles', {
        method: 'POST',
        actor: true,
        body: {
          phone: p.phone,
          placa: `TST${pad4(n)}`,
          marca: 'Fiat',
          modelo: 'Uno',
          cor: 'Branco',
          celular: p.phone,
        },
      });
      n += 1;
    } catch (err) {
      console.warn('Veículo ignorado:', err.message);
    }
  }
}

async function seedEvents() {
  const vDay = nextSundayDate();
  ctx.event_day = vDay;

  const specs = [
    ['event_full', 'TstMax Culto Totem+Quorum+Salas', 0, '10:00', 'TstMax Templo Principal', 400, true, true, true, true, true],
    ['event_totem_only', 'TstMax Culto So Totem', 14, '10:00', 'TstMax Templo B', 300, true, false, false, true, false],
    ['event_quorum_only', 'TstMax Culto So Quorum', 21, '10:00', 'TstMax Templo C', 250, false, true, false, false, true],
    ['event_plain', 'TstMax Encontro Simples', 28, '15:00', 'TstMax Salao Social', 120, false, false, true, false, false],
    ['event_double_am', 'TstMax Duplo Dia Manha', 35, '09:30', 'TstMax Campus A', 200, true, true, false, true, false],
    ['event_double_pm', 'TstMax Duplo Dia Noite', 35, '19:00', 'TstMax Campus A', 180, false, true, true, true, true],
  ];

  for (const [key, name, offset, time, local, cap, kids, teens, ofertas, totem, quorum] of specs) {
    const rows = await api('/events', {
      method: 'POST',
      actor: true,
      prefer: 'return=representation',
      body: {
        name,
        event_date: eventIso(vDay, offset, time),
        event_local: local,
        max_capacity: cap,
        kids_room: kids,
        teens_room: teens,
        parm_ofertas: ofertas,
        totem_ativo: totem,
        requer_quorum: quorum,
        is_locked: false,
      },
    });
    ctx[key] = rows?.[0]?.id;
  }
}

async function seedRegistrations() {
  const members = await api(
    '/members?family_id=like.TstMax*&accepted=eq.true&full_name=not.like.*Pendente*&select=id,family_id,full_name&order=family_id,full_name',
  );

  for (const m of members || []) {
    const result = await rpc('register_member_atomic', {
      p_event_id: ctx.event_full,
      p_member_id: m.id,
      p_family_group_id: m.family_id,
    });
    if (result?.success !== true && result?.success !== 'true') {
      console.warn(`register_member_atomic ${m.full_name}:`, result);
    }
  }

  const sampleFamilies = [
    'TstMaxF001', 'TstMaxF002', 'TstMaxF003', 'TstMaxF004', 'TstMaxF005',
    'TstMaxF010', 'TstMaxF015', 'TstMaxF020', 'TstMaxF025', 'TstMaxF030',
  ];
  const sampleMembers = (members || []).filter((m) => sampleFamilies.includes(m.family_id));
  for (const m of sampleMembers) {
    await rpc('register_member_atomic', {
      p_event_id: ctx.event_totem_only,
      p_member_id: m.id,
      p_family_group_id: m.family_id,
    });
  }

  for (const familyId of ['TstMaxF001', 'TstMaxF004', 'TstMaxF010', 'TstMaxI005']) {
    await rpc('confirm_totem_checkin', {
      p_event_id: ctx.event_full,
      p_family_id: familyId,
    });
  }
}

async function seedScales() {
  const sunday = nextSundayDate();

  const tipoEquipe = await rpc(
    'cadastrar_tipo_escala',
    {
      p_codigo: 'tstmax_vigilancia',
      p_nome: 'TstMax Vigilancia Equipe',
      p_vagas_por_servico: 4,
      p_modo_ciclo: 'equipe',
    },
    { actor: true },
  );
  const tipoInd = await rpc(
    'cadastrar_tipo_escala',
    {
      p_codigo: 'tstmax_intercessao',
      p_nome: 'TstMax Intercessao Individual',
      p_vagas_por_servico: 1,
      p_modo_ciclo: 'individual',
    },
    { actor: true },
  );

  const tipoEquipeId = tipoEquipe?.id;
  const tipoIndId = tipoInd?.id;

  const repProfiles = await api(
    '/profiles?full_name=like.TstMax%20F*Representante&select=id,full_name&order=full_name&limit=9',
  );
  const volunteerIds = [];

  for (let i = 0; i < Math.min(6, repProfiles?.length || 0); i += 1) {
    const result = await rpc(
      'cadastrar_voluntario_escala',
      {
        p_tipo_escala_id: tipoEquipeId,
        p_profile_id: repProfiles[i].id,
      },
      { actor: true },
    );
    if (result?.success) volunteerIds.push({ tipoId: tipoEquipeId, volId: result.voluntario_id });
  }

  for (let i = 0; i < Math.min(3, repProfiles?.length || 0); i += 1) {
    const result = await rpc(
      'cadastrar_voluntario_escala',
      {
        p_tipo_escala_id: tipoIndId,
        p_profile_id: repProfiles[i].id,
      },
      { actor: true },
    );
    if (result?.success) {
      await rpc(
        'registrar_escala_manual',
        {
          p_tipo_escala_id: tipoIndId,
          p_voluntario_id: result.voluntario_id,
          p_data_servico: addDaysToDate(sunday, i * 7),
        },
        { actor: true },
      );
    }
  }

  for (let i = 0; i < Math.min(4, volunteerIds.length); i += 1) {
    await rpc(
      'registrar_escala_manual',
      {
        p_tipo_escala_id: volunteerIds[i].tipoId,
        p_voluntario_id: volunteerIds[i].volId,
        p_data_servico: sunday,
      },
      { actor: true },
    );
  }
}

async function seedPastoral() {
  if (!ctx.profile_f1_pai) {
    const f1 = await api(
      '/profiles?family_id=eq.TstMaxF001&full_name=like.*Representante&select=id,phone&limit=1',
    );
    ctx.profile_f1_pai = f1?.[0]?.id;
    if (f1?.[0]) ctx.profile_f1_phone = f1[0].phone;
  }
  if (!ctx.profile_f3_pai) {
    const f3 = await api(
      '/profiles?family_id=eq.TstMaxF003&full_name=like.*Representante&select=id,phone&limit=1',
    );
    ctx.profile_f3_pai = f3?.[0]?.id;
    if (f3?.[0]) ctx.profile_f3_phone = f3[0].phone;
  }

  if (ctx.profile_f1_pai) {
    const p1 = await api(`/profiles?id=eq.${ctx.profile_f1_pai}&select=phone`);
    await api('/pastoral_requests', {
      method: 'POST',
      actorId: ctx.profile_f1_pai,
      body: {
        profile_id: ctx.profile_f1_pai,
        phone: p1?.[0]?.phone,
        motivo: 'TstMax Pedido proprio',
        situacao: 'TstMax Situacao teste',
        description: 'TstMax Descricao pedido pastoral para carga massiva.',
        category_id: '10000000-0000-4000-8000-000000000001',
        subcategory_id: '20000000-0000-4000-8000-000000000006',
        destination_label: 'Sigilo pastoral',
        confidential: true,
        request_for: 'self',
        status: 'new',
        urgency_level: 1,
      },
    });
  }

  if (ctx.profile_f3_pai) {
    const p3 = await api(`/profiles?id=eq.${ctx.profile_f3_pai}&select=phone`);
    const teen = await api(
      "/members?family_id=eq.TstMaxF003&full_name=like.*Teen*&select=full_name&limit=1",
    );
    await api('/pastoral_requests', {
      method: 'POST',
      actorId: ctx.profile_f3_pai,
      body: {
        profile_id: ctx.profile_f3_pai,
        phone: p3?.[0]?.phone,
        motivo: 'TstMax Pedido familia',
        situacao: 'TstMax Filho em crise',
        description: 'TstMax Pedido em nome de familiar para teste integrado.',
        category_id: '10000000-0000-4000-8000-000000000002',
        subcategory_id: '20000000-0000-4000-8000-000000000015',
        destination_label: 'Intercessao',
        confidential: false,
        request_for: 'family',
        beneficiary_name: teen?.[0]?.full_name,
        beneficiary_relationship: 'Filho(a)',
        status: 'new',
        urgency_level: 2,
      },
    });
  }
}

async function report() {
  const members = await api('/members?family_id=like.TstMax*&select=family_id');
  const profiles = await api('/profiles?family_id=like.TstMax*&select=id');
  const events = await api('/events?name=like.TstMax*&select=id', { actor: true });
  const registrations = await api('/event_registrations?family_id=like.TstMax*&select=id', {
    actor: true,
  });
  const checkins = await api('/checkins?family_id=like.TstMax*&select=id', { actor: true });
  const pastoral = await api('/pastoral_requests?motivo=like.TstMax*&select=id', { actor: true });
  const directory = await fetch(`${RPC}/list_profiles_members_directory`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  }).then((r) => r.json());
  const directoryTstMax = (directory || []).filter((r) =>
    String(r.full_name || '').includes('TstMax'),
  ).length;

  const byType = { familia: 0, individual: 0 };
  for (const m of members || []) {
    if (m.family_id?.startsWith('TstMaxF')) byType.familia += 1;
    else if (m.family_id?.startsWith('TstMaxI')) byType.individual += 1;
  }

  const cities = await api(
    '/profiles?full_name=like.TstMax*&is_active=eq.true&select=address_city',
  );
  const cityCount = {};
  for (const p of cities || []) {
    const c = p.address_city || '(sem cidade)';
    cityCount[c] = (cityCount[c] || 0) + 1;
  }

  console.log('\n=== Conferência ===');
  console.log('profiles:', profiles?.length ?? 0);
  console.log('members:', members?.length ?? 0);
  console.log('events:', events?.length ?? 0);
  console.log('registrations:', registrations?.length ?? 0);
  console.log('checkins:', checkins?.length ?? 0);
  console.log('pastoral_requests:', pastoral?.length ?? 0);
  console.log('lista_membros (directory TstMax):', directoryTstMax);
  console.log('familia:', byType.familia, '| individual:', byType.individual);
  console.log('cidades (ativos):', cityCount);
}

async function main() {
  console.log('TstMax seed via API →', SUPABASE_URL);
  await cleanup();
  await seedPopulation();
  await ensureTstMaxVisitantesOnly();
  try {
    await seedCepGeolocations();
  } catch (err) {
    console.warn('CEPs TstMax (opcional):', err.message);
  }
  await seedVehicles();
  await seedEvents();
  await seedRegistrations();
  await seedScales();
  try {
    await seedPastoral();
  } catch (err) {
    console.warn('Pedidos pastorais (opcional):', err.message);
  }
  await report();
  console.log('\nConcluído.');
}

main().catch((err) => {
  console.error('\nFalha:', err.message);
  process.exit(1);
});
