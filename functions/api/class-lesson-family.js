/**
 * Sugestão da conversa em família a partir do título, da passagem e do objetivo.
 * Quem planeja a aula usa isto sem a permissão da Abigail.
 * POST /api/class-lesson-family
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-session-token, x-profile-id, x-ghost-profile-id, x-tenant-id',
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest'];
const GEMINI_TIMEOUT_MS = 45_000;

const DEFAULT_SUPABASE_URL = 'https://bldbrsuiwctoaxzcrjoc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZGJyc3Vpd2N0b2F4emNyam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTgyMTQsImV4cCI6MjA5NTAzNDIxNH0.q2ME_1_Qatxfc6Aas02H7A6y6dUpk4BsNQyDIeQYVgU';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

const clip = (value, max) => {
  const text = String(value ?? '').trim();
  return text.length <= max ? text : text.slice(0, max);
};

const isUsableSupabaseUrl = (value) => {
  const base = String(value || '').trim().replace(/\/$/, '');
  if (!base.startsWith('https://') || /\s/.test(base)) {
    return false;
  }

  try {
    const parsed = new URL(base);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

const isUsableSupabaseKey = (value) => {
  const key = String(value || '').trim();
  return key.startsWith('eyJ') && key.length > 80;
};

const getSupabaseUrl = (env) => {
  for (const raw of [env?.SUPABASE_URL, env?.EXPO_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL]) {
    const base = String(raw || '').trim().replace(/\/$/, '');
    if (isUsableSupabaseUrl(base)) {
      return base;
    }
  }

  return DEFAULT_SUPABASE_URL;
};

const getSupabaseKey = (env) => {
  for (const raw of [
    env?.SUPABASE_SERVICE_ROLE_KEY,
    env?.SUPABASE_ANON_KEY,
    env?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    DEFAULT_SUPABASE_ANON_KEY,
  ]) {
    if (isUsableSupabaseKey(raw)) {
      return String(raw).trim();
    }
  }

  return DEFAULT_SUPABASE_ANON_KEY;
};

const copyIdentityHeaders = (request) => {
  const headers = {};
  const pairs = [
    ['x-session-token', 'X-Session-Token'],
    ['x-profile-id', 'X-Profile-Id'],
    ['x-ghost-profile-id', 'X-Ghost-Profile-Id'],
    ['x-tenant-id', 'X-Tenant-Id'],
  ];

  for (const [lower, mixed] of pairs) {
    const value = request.headers.get(lower)?.trim() || request.headers.get(mixed)?.trim();
    if (value) {
      headers[lower] = value;
    }
  }

  return headers;
};

const supabaseRpc = async (env, functionName, payload, request) => {
  const response = await fetch(`${getSupabaseUrl(env)}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: getSupabaseKey(env),
      Authorization: `Bearer ${getSupabaseKey(env)}`,
      ...copyIdentityHeaders(request),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${functionName}: ${response.status} ${errorText}`);
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const readGeminiKey = async (env) => {
  const fromEnv = String(env?.GEMINI_API_KEY ?? '').trim();
  if (fromEnv.startsWith('AIza')) {
    return fromEnv;
  }

  try {
    const response = await fetch(
      `${getSupabaseUrl(env)}/rest/v1/ai_server_config?config_key=eq.gemini_api_key&select=config_value`,
      {
        headers: {
          apikey: getSupabaseKey(env),
          Authorization: `Bearer ${getSupabaseKey(env)}`,
          Accept: 'application/json',
        },
      }
    );

    if (response.ok) {
      const rows = await response.json();
      const fromTable = Array.isArray(rows) ? String(rows[0]?.config_value ?? '').trim() : '';
      if (fromTable.startsWith('AIza')) {
        return fromTable;
      }
    }
  } catch (error) {
    console.error('class-lesson-family.key', error);
  }

  return null;
};

const extractGeminiText = (payload) => {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .filter((part) => part?.thought !== true)
    .map((part) => String(part?.text ?? ''))
    .join('')
    .trim();
};

const cleanSuggestion = (value) =>
  String(value ?? '')
    .replace(/^["“”']+|["“”']+$/g, '')
    .replace(/\*\*/g, '')
    .trim();

const parseAgeLimit = (value) => {
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) ? Number.parseInt(text, 10) : null;
};

const readAgeLimit = async (env, request, parameter) => {
  try {
    return parseAgeLimit(await supabaseRpc(env, 'get_app_parameter_value', { p_parameter: parameter }, request));
  } catch (error) {
    console.error('class-lesson-family.age', parameter, error);
    return null;
  }
};

const familySystemPrompt = (roomKey, idadeKids, idadeTeens) => {
  const lines = [
    'Redija a conversa em família de uma aula.',
    'Use somente o título, a passagem bíblica e o objetivo informados. Não troque a passagem e não invente outro tema.',
    'Escreva em português do Brasil, de 2 a 4 frases, para os pais aplicarem em casa durante a semana: uma pergunta e um desafio curto.',
    'A linguagem e a pergunta seguem a faixa etária da sala. Não faça pergunta que a criança ou o jovem dessa idade não consiga entender ou responder.',
  ];

  if (roomKey === 'TEENS') {
    const from = idadeKids != null ? idadeKids + 1 : null;
    lines.push(
      from != null && idadeTeens != null
        ? `A sala é de jovens, cerca de ${from} a ${idadeTeens} anos.`
        : 'A sala é de jovens.'
    );
    lines.push(
      'Fale como com adolescente: direto e respeitoso. Não use fala de criança pequena nem vocabulário de adulto. A pergunta cabe na semana deles: escola, amigos, escolhas, casa.'
    );
  } else {
    lines.push(idadeKids != null ? `A sala é infantil, crianças de até ${idadeKids} anos.` : 'A sala é infantil.');
    lines.push(
      'Frases curtas e palavras do dia a dia. Exemplos concretos: casa, brincadeira, medo, cuidado, família. Sem termos abstratos e sem pergunta que uma criança pequena não saiba responder.'
    );
  }

  lines.push('Devolva só o texto, sem título, sem aspas e sem markdown.');
  return lines.join('\n');
};

const suggestFamilyExtension = async (apiKey, prompt, systemPrompt) => {
  const bodyPayload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 512,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let lastStatus = 0;

  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      lastStatus = response.status;
      const raw = await response.text();

      if (response.ok) {
        const text = cleanSuggestion(extractGeminiText(JSON.parse(raw)));
        if (text) {
          return text;
        }
      } else if (lastStatus === 400 && bodyPayload.generationConfig.thinkingConfig) {
        delete bodyPayload.generationConfig.thinkingConfig;
        continue;
      }
    } catch (error) {
      console.error('class-lesson-family.gemini', model, error);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastStatus === 429 ? 'Aguarde alguns segundos e tente de novo.' : 'Não foi possível sugerir a conversa.');
};

const handlePost = async (request, env) => {
  const sessionToken =
    request.headers.get('x-session-token')?.trim() || request.headers.get('X-Session-Token')?.trim() || '';

  if (!sessionToken) {
    return jsonResponse({ error: 'Sessão inválida. Saia e entre novamente.' }, 401);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Pedido inválido.' }, 400);
  }

  const eventId = String(body?.eventId ?? '').trim();
  const roomKey = String(body?.roomKey ?? '').trim().toUpperCase();
  const title = clip(body?.title, 240);
  const biblePassage = clip(body?.biblePassage, 240);
  const mainObjective = clip(body?.mainObjective, 800);
  const roomLabel = clip(body?.roomLabel, 80);

  if (!eventId || (roomKey !== 'KIDS' && roomKey !== 'TEENS')) {
    return jsonResponse({ error: 'Sala inválida.' }, 400);
  }

  if (title.length < 2 || biblePassage.length < 1 || mainObjective.length < 1) {
    return jsonResponse(
      { error: 'Preencha o título, a passagem e o objetivo para sugerir a conversa.' },
      400
    );
  }

  let gate;

  try {
    gate = await supabaseRpc(env, 'get_class_lesson', { p_event_id: eventId, p_room_key: roomKey }, request);
  } catch (error) {
    console.error('class-lesson-family.gate', error);
    return jsonResponse({ error: 'Não foi possível confirmar o planejamento desta sala.' }, 503);
  }

  if (!gate || gate.success !== true) {
    return jsonResponse(
      { error: String(gate?.message || 'Sem permissão para o planejamento desta sala.') },
      403
    );
  }

  const apiKey = await readGeminiKey(env);

  if (!apiKey) {
    return jsonResponse(
      { error: 'A sugestão da conversa em família ainda não está disponível neste ambiente.' },
      503
    );
  }

  const [idadeKids, idadeTeens] = await Promise.all([
    readAgeLimit(env, request, 'idade_kids'),
    readAgeLimit(env, request, 'idade_teens'),
  ]);

  const prompt = [
    `Sala: ${roomLabel || (roomKey === 'TEENS' ? 'Jovens' : 'Infantil')}`,
    `Título: ${title}`,
    `Passagem: ${biblePassage}`,
    `Objetivo: ${mainObjective}`,
  ].join('\n');

  try {
    const text = await suggestFamilyExtension(apiKey, prompt, familySystemPrompt(roomKey, idadeKids, idadeTeens));
    return jsonResponse({ text });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Não foi possível sugerir a conversa.' },
      502
    );
  }
};

export const onRequestOptions = async () => new Response('ok', { headers: CORS_HEADERS });

export const onRequestPost = async (context) => {
  try {
    return await handlePost(context.request, context.env);
  } catch (error) {
    console.error('class-lesson-family', error);
    return jsonResponse({ error: 'Não foi possível sugerir a conversa.' }, 500);
  }
};
