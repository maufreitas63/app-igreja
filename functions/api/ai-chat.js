const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-session-token, x-profile-id, x-ghost-profile-id, x-tenant-id',
};

const UNAUTHORIZED = 'nao autorizado para esta funçao';

const BASE_SYSTEM_PROMPT = [
  'Você é a Abigail, assistente de gestão da igreja.',
  'Tom acolhedor e profissional. Vá direto ao que foi perguntado, sem se apresentar de novo.',
  'Responda em português do Brasil, de forma breve e objetiva.',
].join('\n');

const ISOLATION_PROMPT = [
  'Só a igreja da sessão. Para nomes, cargos, contatos, eventos ou finanças, use as ferramentas.',
  'Não invente, não peça dump da igreja, não envie tenant_id. Sem PIN, senha, CPF, PIX ou conteúdo pastoral.',
  'Quantidade 0 é zero nesta instância. Finanças: saldo_atual em resultado_historico.',
].join('\n');

const GEMINI_BUSY_MESSAGE =
  'O assistente está recebendo muitas consultas no momento. Aguarde alguns segundos e tente novamente.';

const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash'];
const GEMINI_TIMEOUT_MS = 45_000;
const GEMINI_BUSY_BACKOFF_MS = 2_500;
const GEMINI_BUSY_RETRIES = 1;
const MAX_HISTORY_ITEMS = 2;
const MAX_HISTORY_CHARS = 400;
const MAX_QUESTION_CHARS = 1_200;
const MAX_TOOL_ROUNDS = 2;
const MAX_TOOL_CALLS_PER_ROUND = 2;
const MAX_TOOL_RESULT_CHARS = 2_500;

const ALLOWED_TOOLS = new Set([
  'buscar_pessoas',
  'buscar_lideranca',
  'cadastro_detalhe',
  'buscar_eventos',
  'financas_resumo',
  'cuidado_pastoral_totais',
  'pequenos_grupos',
  'aniversariantes',
]);

const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'buscar_pessoas',
        description:
          'Busca cadastros desta instância por nome, telefone, código ou cargo. Não lista a igreja inteira.',
        parameters: {
          type: 'OBJECT',
          properties: {
            busca: { type: 'STRING', description: 'Trecho do nome, telefone, código ou cargo (mínimo 2 caracteres).' },
            papel: { type: 'STRING', description: 'Filtro opcional: member, congregado ou visitante.' },
          },
          required: ['busca'],
        },
      },
      {
        name: 'buscar_lideranca',
        description:
          'Lista pessoas com papéis de liderança nesta instância (secretaria, tesoureiro, pastoral, líder, etc.).',
        parameters: {
          type: 'OBJECT',
          properties: {
            busca: { type: 'STRING', description: 'Filtro opcional por nome, cargo ou papel.' },
          },
        },
      },
      {
        name: 'cadastro_detalhe',
        description:
          'Dados cadastrais de uma pessoa desta instância (nome, cargo, contato, endereço). Sem PIN, senha, CPF ou PIX.',
        parameters: {
          type: 'OBJECT',
          properties: {
            busca: { type: 'STRING', description: 'Nome, telefone ou código do cadastro.' },
          },
          required: ['busca'],
        },
      },
      {
        name: 'buscar_eventos',
        description: 'Consulta eventos desta instância (recentes, próximos ou busca por nome).',
        parameters: {
          type: 'OBJECT',
          properties: {
            recorte: { type: 'STRING', description: 'recentes, proximos ou todos.' },
            busca: { type: 'STRING', description: 'Filtro opcional pelo nome do evento.' },
          },
        },
      },
      {
        name: 'financas_resumo',
        description:
          'Resumo financeiro desta instância (saldo e totais). Só funciona se o operador tiver permissão.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'cuidado_pastoral_totais',
        description: 'Totais de pedidos de cuidado pastoral por status, sem conteúdo nem identidade.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'pequenos_grupos',
        description: 'Lista os pequenos grupos/células desta instância.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'aniversariantes',
        description: 'Aniversariantes do mês corrente nesta instância.',
        parameters: { type: 'OBJECT', properties: {} },
      },
    ],
  },
];

const compactBootstrap = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const igreja = snapshot.igreja && typeof snapshot.igreja === 'object' ? snapshot.igreja : null;

  return {
    igreja: igreja ? { nome: igreja.nome ?? igreja.name, codigo: igreja.codigo ?? igreja.code } : undefined,
    operador: snapshot.operador,
    pessoas: snapshot.pessoas,
    eventos: snapshot.eventos,
  };
};

const clipText = (value, maxChars) => {
  const trimmed = String(value || '').trim();
  return trimmed.length <= maxChars ? trimmed : `${trimmed.slice(0, maxChars)}…`;
};

const buildSystemPrompt = (snapshot) => {
  const parts = [BASE_SYSTEM_PROMPT, ISOLATION_PROMPT];
  const compact = compactBootstrap(snapshot);

  if (compact) {
    parts.push(`contexto:\n${JSON.stringify(compact)}`);
  } else {
    parts.push('Sem resumo da instância. Use as ferramentas; não invente dados.');
  }

  return parts.join('\n\n');
};

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });

const DEFAULT_SUPABASE_URL = 'https://bldbrsuiwctoaxzcrjoc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZGJyc3Vpd2N0b2F4emNyam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTgyMTQsImV4cCI6MjA5NTAzNDIxNH0.q2ME_1_Qatxfc6Aas02H7A6y6dUpk4BsNQyDIeQYVgU';

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
  const candidates = [env?.SUPABASE_URL, env?.EXPO_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL];

  for (const raw of candidates) {
    const base = String(raw || '').trim().replace(/\/$/, '');
    if (isUsableSupabaseUrl(base)) {
      return base;
    }
  }

  return DEFAULT_SUPABASE_URL;
};

const getSupabaseKey = (env) => {
  const candidates = [
    env?.SUPABASE_SERVICE_ROLE_KEY,
    env?.SUPABASE_ANON_KEY,
    env?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    DEFAULT_SUPABASE_ANON_KEY,
  ];

  for (const raw of candidates) {
    if (isUsableSupabaseKey(raw)) {
      return String(raw).trim();
    }
  }

  return DEFAULT_SUPABASE_ANON_KEY;
};

const copyIdentityHeaders = (request) => {
  const headers = {};
  const sessionToken =
    request.headers.get('x-session-token')?.trim() || request.headers.get('X-Session-Token')?.trim();
  const profileId =
    request.headers.get('x-profile-id')?.trim() || request.headers.get('X-Profile-Id')?.trim();
  const ghostProfileId =
    request.headers.get('x-ghost-profile-id')?.trim() || request.headers.get('X-Ghost-Profile-Id')?.trim();
  const tenantId =
    request.headers.get('x-tenant-id')?.trim() || request.headers.get('X-Tenant-Id')?.trim();

  if (sessionToken) headers['x-session-token'] = sessionToken;
  if (profileId) headers['x-profile-id'] = profileId;
  if (ghostProfileId) headers['x-ghost-profile-id'] = ghostProfileId;
  if (tenantId) headers['x-tenant-id'] = tenantId;

  return headers;
};

const supabaseRpc = async (env, functionName, payload, request) => {
  const supabaseUrl = getSupabaseUrl(env);
  const supabaseKey = getSupabaseKey(env);

  let response;

  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        ...(request ? copyIdentityHeaders(request) : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(`${functionName}: network ${error?.message || error}`);
  }

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

const authenticateAiLeadership = async (request, env) => {
  // Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  const sessionToken =
    request.headers.get('x-session-token')?.trim() ||
    request.headers.get('X-Session-Token')?.trim() ||
    '';

  if (!sessionToken) {
    return { ok: false, error: UNAUTHORIZED, status: 401 };
  }

  const realProfileId = await supabaseRpc(
    env,
    'resolve_profile_session_token',
    { p_token: sessionToken },
    request
  );

  if (!realProfileId || typeof realProfileId !== 'string') {
    return { ok: false, error: UNAUTHORIZED, status: 401 };
  }

  let actorProfileId = realProfileId;
  const ghostProfileId =
    request.headers.get('x-ghost-profile-id')?.trim() ||
    request.headers.get('X-Ghost-Profile-Id')?.trim() ||
    '';

  if (ghostProfileId && ghostProfileId !== realProfileId) {
    try {
      const canGhost = await supabaseRpc(
        env,
        'can_operate_ghost_mode',
        { p_profile_id: realProfileId },
        request
      );

      if (canGhost === true) {
        actorProfileId = ghostProfileId;
      }
    } catch (error) {
      console.error('can_operate_ghost_mode', error);
    }
  }

  const isLeadership = await supabaseRpc(
    env,
    'profile_is_leadership',
    { p_profile_id: actorProfileId },
    request
  );

  if (isLeadership !== true) {
    return { ok: false, error: 'Acesso restrito à liderança.', status: 403 };
  }

  let roleAtTime = 'Liderança';

  try {
    const roleNames = await supabaseRpc(
      env,
      'profile_role_names_csv',
      { p_profile_id: actorProfileId },
      request
    );

    if (typeof roleNames === 'string' && roleNames.trim()) {
      roleAtTime = roleNames.trim();
    }
  } catch (error) {
    console.error('profile_role_names_csv', error);
  }

  return { ok: true, profileId: actorProfileId, roleAtTime, request };
};

const resolveGeminiApiKey = async (env, auth) => {
  const supabaseUrl = getSupabaseUrl(env);
  const supabaseKey = getSupabaseKey(env);

  try {
    const configResponse = await fetch(
      `${supabaseUrl}/rest/v1/ai_server_config?config_key=eq.gemini_api_key&select=config_value`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (configResponse.ok) {
      const rows = await configResponse.json();
      const fromTable = Array.isArray(rows) ? String(rows[0]?.config_value ?? '').trim() : '';

      if (fromTable.startsWith('AIza')) {
        return fromTable;
      }
    }
  } catch (error) {
    console.error('ai_server_config', error);
  }

  try {
    const fromDatabase = await supabaseRpc(
      env,
      'obter_chave_gemini_ia_lideranca',
      { p_actor_profile_id: auth.profileId },
      auth.request
    );

    if (typeof fromDatabase === 'string' && fromDatabase.trim().startsWith('AIza')) {
      return fromDatabase.trim();
    }
  } catch (error) {
    console.error('obter_chave_gemini_ia_lideranca', error);
  }

  const fromEnv = env.GEMINI_API_KEY?.trim();
  return fromEnv && fromEnv.startsWith('AIza') ? fromEnv : null;
};

const buildGeminiContents = (question, history) => {
  const contents = history
    .filter((item) => item?.content?.trim())
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: clipText(item.content, MAX_HISTORY_CHARS) }],
    }));

  contents.push({
    role: 'user',
    parts: [{ text: clipText(question, MAX_QUESTION_CHARS) }],
  });

  return contents;
};

const extractGeminiText = (payload) => {
  const candidates = payload?.candidates;

  if (!Array.isArray(candidates) || !candidates.length) {
    return '';
  }

  const parts = candidates[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .filter((part) => part?.thought !== true)
    .map((part) => String(part?.text ?? ''))
    .join('');
};

const extractGeminiFunctionCalls = (payload) => {
  const parts = payload?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return [];
  }

  const calls = [];

  for (const part of parts) {
    const raw = part?.functionCall || part?.function_call;

    if (!raw?.name) {
      continue;
    }

    calls.push({
      name: String(raw.name).trim(),
      args: raw.args && typeof raw.args === 'object' && !Array.isArray(raw.args) ? raw.args : {},
    });
  }

  return calls;
};

const isGeminiModelUnavailable = (status, errorText) => {
  const text = String(errorText || '').toLowerCase();
  return status === 404 || text.includes('not found') || text.includes('is not found for api version');
};

const isGeminiBusy = (status, errorText) => {
  const text = String(errorText || '').toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    text.includes('unavailable') ||
    text.includes('high demand') ||
    text.includes('overloaded') ||
    text.includes('rate limit') ||
    text.includes('resource_exhausted') ||
    text.includes('try again later')
  );
};

const describeGeminiError = (status, errorText) => {
  const text = String(errorText || '').toLowerCase();

  if (status === 401 || status === 403 || text.includes('api key not valid') || text.includes('api_key_invalid')) {
    return 'Chave Gemini inválida ou sem permissão. O Super Administrador deve cadastrar uma chave válida em Abigail → Chave API.';
  }

  if (isGeminiBusy(status, errorText)) {
    return GEMINI_BUSY_MESSAGE;
  }

  if (isGeminiModelUnavailable(status, errorText)) {
    return 'O modelo de IA não está disponível para esta chave. Tente novamente após a atualização do aplicativo.';
  }

  if (text.includes('abort') || text.includes('timed out') || text.includes('timeout')) {
    return 'O modelo de IA demorou demais para responder. Tente de novo em instantes.';
  }

  if (text.includes('empty_candidates')) {
    return 'O modelo de IA não devolveu resposta. Reformule a pergunta de forma mais objetiva e tente de novo.';
  }

  console.error(
    JSON.stringify({
      event: 'ai-chat.gemini_unmapped_error',
      status,
      excerpt: String(errorText || '').slice(0, 400),
    })
  );

  return 'Não foi possível concluir a consulta à IA agora. Tente de novo em instantes.';
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clampToolResult = (value) => {
  const text = JSON.stringify(value ?? { ok: false, erro: 'resposta_vazia' });

  if (text.length <= MAX_TOOL_RESULT_CHARS) {
    return JSON.parse(text);
  }

  return {
    ok: true,
    truncado: true,
    aviso: 'Resultado limitado para caber no contexto. Refine a busca.',
    recorte: text.slice(0, MAX_TOOL_RESULT_CHARS),
  };
};

const parseRpcJson = (snapshot) => {
  if (typeof snapshot === 'string') {
    try {
      return JSON.parse(snapshot);
    } catch {
      return null;
    }
  }

  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : null;
};

const fetchInstanceContext = async (env, auth) => {
  try {
    const started = Date.now();
    const snapshot = await supabaseRpc(
      env,
      'consultar_ferramenta_ia_lideranca',
      {
        p_actor_profile_id: auth.profileId,
        p_ferramenta: 'resumo_instancia',
        p_parametros: {},
      },
      auth.request
    );

    console.log(JSON.stringify({ event: 'ai-chat.resumo_ok', ms: Date.now() - started }));
    return parseRpcJson(snapshot);
  } catch (error) {
    console.error(JSON.stringify({ event: 'ai-chat.resumo_error', error: String(error?.message || error) }));
  }

  return null;
};

const executeAiTool = async (env, auth, call) => {
  const name = String(call?.name || '').trim();
  const started = Date.now();

  if (!ALLOWED_TOOLS.has(name)) {
    console.error(JSON.stringify({ event: 'ai-chat.tool_blocked', name }));
    return { ok: false, erro: 'ferramenta_nao_permitida' };
  }

  try {
    const data = await supabaseRpc(
      env,
      'consultar_ferramenta_ia_lideranca',
      {
        p_actor_profile_id: auth.profileId,
        p_ferramenta: name,
        p_parametros: call.args || {},
      },
      auth.request
    );

    console.log(JSON.stringify({ event: 'ai-chat.tool_ok', name, ms: Date.now() - started }));
    return clampToolResult(data);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'ai-chat.tool_error',
        name,
        error: String(error?.message || error),
        ms: Date.now() - started,
      })
    );
    return { ok: false, erro: 'consulta_indisponivel' };
  }
};

const fetchGeminiTurn = async (apiKey, contents, systemPrompt, allowTools) => {
  const bodyPayload = {
    systemInstruction: { parts: [{ text: systemPrompt || BASE_SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  if (allowTools) {
    bodyPayload.tools = GEMINI_TOOLS;
    bodyPayload.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
  }

  let lastStatus = 0;
  let lastText = '';
  let droppedThinking = false;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt <= GEMINI_BUSY_RETRIES; attempt += 1) {
      if (attempt > 0) {
        console.log(
          JSON.stringify({
            event: 'ai-chat.gemini_retry',
            model,
            attempt,
            waitMs: GEMINI_BUSY_BACKOFF_MS,
          })
        );
        await sleep(GEMINI_BUSY_BACKOFF_MS);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
      const started = Date.now();

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal,
          }
        );

        lastStatus = response.status;
        lastText = await response.text();

        console.log(
          JSON.stringify({
            event: 'ai-chat.gemini_turn',
            model,
            status: lastStatus,
            ms: Date.now() - started,
            allowTools,
            attempt,
          })
        );

        if (response.ok) {
          let payload = null;

          try {
            payload = JSON.parse(lastText);
          } catch {
            lastText = 'invalid_json';
            break;
          }

          const functionCalls = allowTools ? extractGeminiFunctionCalls(payload) : [];
          const text = extractGeminiText(payload).trim();

          if (functionCalls.length || text) {
            return { ok: true, text, functionCalls, model };
          }

          lastText = 'empty_candidates';
          break;
        }

        console.error(
          JSON.stringify({
            event: 'ai-chat.gemini_error',
            model,
            status: lastStatus,
            excerpt: lastText.slice(0, 400),
            attempt,
          })
        );

        if (lastStatus === 401 || lastStatus === 403) {
          return { ok: false, status: lastStatus, errorText: lastText };
        }

        if (lastStatus === 400 && !droppedThinking) {
          droppedThinking = true;
          delete bodyPayload.generationConfig.thinkingConfig;
          attempt -= 1;
          continue;
        }

        if (isGeminiBusy(lastStatus, lastText) && attempt < GEMINI_BUSY_RETRIES) {
          continue;
        }

        if (isGeminiBusy(lastStatus, lastText) || isGeminiModelUnavailable(lastStatus, lastText) || lastStatus === 400) {
          break;
        }

        return { ok: false, status: lastStatus, errorText: lastText };
      } catch (error) {
        lastStatus = 0;
        lastText = String(error?.message || error);
        console.error(
          JSON.stringify({
            event: 'ai-chat.gemini_fetch_error',
            model,
            excerpt: lastText.slice(0, 400),
            ms: Date.now() - started,
            attempt,
          })
        );

        if (attempt < GEMINI_BUSY_RETRIES) {
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }

  return { ok: false, status: lastStatus, errorText: lastText };
};

const handlePost = async (request, env) => {
  let auth;

  try {
    auth = await authenticateAiLeadership(request, env);
  } catch (error) {
    console.error('auth error', error);
    const detail = String(error?.message ?? error);

    if (detail.includes('missing_env:')) {
      return jsonResponse(
        {
          error:
            'Serviço de IA não configurado no servidor. Defina GEMINI_API_KEY no Cloudflare Pages (Production) e faça um novo deploy.',
        },
        503
      );
    }

    if (detail.includes('network')) {
      return jsonResponse(
        {
          error:
            'Não foi possível validar a sessão no servidor. Confira SUPABASE_URL no Cloudflare Pages.',
        },
        503
      );
    }

    if (detail.includes('resolve_profile_session_token')) {
      return jsonResponse(
        { error: 'Sessão inválida. Saia e entre novamente no aplicativo.' },
        401
      );
    }

    if (detail.includes('profile_is_leadership')) {
      return jsonResponse(
        { error: 'Não foi possível confirmar o papel de liderança. Tente sair e entrar novamente.' },
        503
      );
    }

    return jsonResponse(
      { error: 'Não foi possível autenticar o assistente. Saia e entre novamente.' },
      401
    );
  }

  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Corpo da requisição inválido.' }, 400);
  }

  const question = clipText(String(body?.question ?? ''), MAX_QUESTION_CHARS);

  if (!question) {
    return jsonResponse({ error: 'Informe uma pergunta.' }, 400);
  }

  console.log(
    JSON.stringify({
      event: 'ai-chat.start',
      profileId: auth.profileId,
      questionChars: question.length,
    })
  );

  let geminiApiKey;

  try {
    geminiApiKey = await resolveGeminiApiKey(env, auth);
  } catch (error) {
    console.error('resolveGeminiApiKey', error);
    const message = String(error?.message ?? error);

    if (message.includes('Chave Gemini não configurada')) {
      return jsonResponse({ error: message }, 503);
    }

    return jsonResponse({ error: 'Serviço de IA indisponível.' }, 503);
  }

  if (!geminiApiKey) {
    return jsonResponse(
      {
        error:
          'Chave Gemini não configurada. Defina GEMINI_API_KEY no Cloudflare Pages (Production) ou execute scripts/configurar-gemini-api-key.sql no Supabase.',
      },
      503
    );
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const instanceContext = await fetchInstanceContext(env, auth);
  const systemPrompt = buildSystemPrompt(instanceContext);
  const contents = buildGeminiContents(question, history);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = '';

      const pushEvent = (payload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        pushEvent({ status: 'consultando' });

        let turn = await fetchGeminiTurn(geminiApiKey, contents, systemPrompt, true);
        let rounds = 0;

        while (turn.ok && turn.functionCalls.length && rounds < MAX_TOOL_ROUNDS) {
          rounds += 1;
          pushEvent({ status: 'consultando_cadastros' });

          const uniqueCalls = turn.functionCalls.slice(0, MAX_TOOL_CALLS_PER_ROUND);

          contents.push({
            role: 'model',
            parts: uniqueCalls.map((call) => ({
              functionCall: { name: call.name, args: call.args },
            })),
          });

          const toolParts = [];

          for (const call of uniqueCalls) {
            const result = await executeAiTool(env, auth, call);
            toolParts.push({
              functionResponse: {
                name: call.name,
                response: result,
              },
            });
          }

          contents.push({
            role: 'user',
            parts: toolParts,
          });

          turn = await fetchGeminiTurn(geminiApiKey, contents, systemPrompt, rounds < MAX_TOOL_ROUNDS);
        }

        if (!turn.ok) {
          pushEvent({ error: describeGeminiError(turn.status, turn.errorText) });
          return;
        }

        if (!String(turn.text || '').trim()) {
          pushEvent({
            error:
              'O modelo de IA não devolveu resposta. Reformule a pergunta de forma mais objetiva e tente de novo.',
          });
          return;
        }

        fullResponse = turn.text;
        pushEvent({ text: turn.text });

        const auditResponse = fullResponse.trim() || '(resposta vazia)';

        try {
          await supabaseRpc(
            env,
            'registrar_auditoria_ia_actor',
            {
              p_actor_profile_id: auth.profileId,
              p_question: question,
              p_ai_response: auditResponse,
            },
            request
          );
        } catch (auditError) {
          console.error(JSON.stringify({ event: 'ai-chat.audit_error', error: String(auditError) }));
        }

        pushEvent({ done: true });
      } catch (error) {
        console.error(JSON.stringify({ event: 'ai-chat.stream_error', error: String(error) }));
        pushEvent({ error: 'Erro interno ao processar a consulta. Tente de novo em instantes.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
};

export const onRequestOptions = async () =>
  new Response('ok', { headers: CORS_HEADERS });

export const onRequestPost = async (context) => {
  try {
    return await handlePost(context.request, context.env);
  } catch (error) {
    console.error('ai-chat handler error', error);
    return jsonResponse({ error: 'Erro interno.' }, 500);
  }
};
