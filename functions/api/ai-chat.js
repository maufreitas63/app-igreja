const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-session-token, x-profile-id, x-ghost-profile-id, x-tenant-id',
};

const UNAUTHORIZED = 'nao autorizado para esta funçao';

const SYSTEM_PROMPT = [
  'Você é o Assistente de Gestão da Igreja.',
  'Tom: profissional, acolhedor e focado na gestão eclesiástica.',
  'Ajude com planejamento, comunicação, organização de eventos, cuidado pastoral (sem substituir aconselhamento profissional), finanças em nível conceitual e boas práticas de liderança.',
  'Não invente dados internos da igreja; se faltar contexto, peça esclarecimentos.',
  'Responda em português do Brasil, de forma clara e objetiva.',
].join('\n');

const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

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
    .slice(-8)
    .map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content.trim() }],
    }));

  contents.push({
    role: 'user',
    parts: [{ text: question.trim() }],
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

  return parts.map((part) => String(part?.text ?? '')).join('');
};

const isGeminiModelUnavailable = (status, errorText) => {
  const text = String(errorText || '').toLowerCase();
  return status === 404 || text.includes('not found') || text.includes('is not found for api version');
};

const describeGeminiError = (status, errorText) => {
  const text = String(errorText || '').toLowerCase();

  if (status === 401 || status === 403 || text.includes('api key not valid') || text.includes('api_key_invalid')) {
    return 'Chave Gemini inválida ou sem permissão. O Super Administrador deve cadastrar uma chave válida em Assistente IA → Chave API.';
  }

  if (status === 429 || text.includes('quota') || text.includes('resource_exhausted')) {
    return 'A cota da API Gemini foi excedida. Tente novamente mais tarde.';
  }

  if (isGeminiModelUnavailable(status, errorText)) {
    return 'O modelo de IA não está disponível para esta chave. Tente novamente após a atualização do aplicativo.';
  }

  return 'Falha ao consultar o modelo de IA.';
};

const fetchGeminiStream = async (apiKey, question, history) => {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: buildGeminiContents(question, history),
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 2048,
    },
  });

  let lastStatus = 0;
  let lastText = '';

  for (const model of GEMINI_MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body,
      }
    );

    if (response.ok) {
      return { ok: true, response };
    }

    lastStatus = response.status;
    lastText = await response.text();
    console.error('Gemini API error:', model, lastStatus, lastText);

    if (!isGeminiModelUnavailable(lastStatus, lastText)) {
      break;
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

  const question = String(body?.question ?? '').trim();

  if (!question) {
    return jsonResponse({ error: 'Informe uma pergunta.' }, 400);
  }

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

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = '';

      const pushEvent = (payload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        const gemini = await fetchGeminiStream(geminiApiKey, question, history);

        if (!gemini.ok) {
          pushEvent({ error: describeGeminiError(gemini.status, gemini.errorText) });
          controller.close();
          return;
        }

        const geminiResponse = gemini.response;

        if (!geminiResponse.body) {
          pushEvent({ error: 'Resposta vazia do modelo de IA.' });
          controller.close();
          return;
        }

        const reader = geminiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed.startsWith('data:')) {
              continue;
            }

            const payloadText = trimmed.slice(5).trim();

            if (!payloadText || payloadText === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(payloadText);
              const chunk = extractGeminiText(parsed);

              if (chunk) {
                fullResponse += chunk;
                pushEvent({ text: chunk });
              }
            } catch {
              // Ignora linhas SSE malformadas.
            }
          }
        }

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
          console.error('registrar_auditoria_ia_actor', auditError);
        }

        pushEvent({ done: true });
      } catch (error) {
        console.error('ai-chat stream error', error);
        pushEvent({ error: 'Erro interno ao processar a consulta.' });
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
