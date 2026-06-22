const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-session-token, x-profile-id',
};

const UNAUTHORIZED = 'nao autorizado para esta funçao';

const SYSTEM_PROMPT = [
  'Você é o Assistente de Gestão da Igreja.',
  'Tom: profissional, acolhedor e focado na gestão eclesiástica.',
  'Ajude com planejamento, comunicação, organização de eventos, cuidado pastoral (sem substituir aconselhamento profissional), finanças em nível conceitual e boas práticas de liderança.',
  'Não invente dados internos da igreja; se faltar contexto, peça esclarecimentos.',
  'Responda em português do Brasil, de forma clara e objetiva.',
].join('\n');

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

const getSupabaseUrl = (env) => env.SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;

const getSupabaseAnonKey = (env) =>
  env.SUPABASE_ANON_KEY?.trim() ||
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  DEFAULT_SUPABASE_ANON_KEY;

const supabaseRpc = async (env, functionName, payload) => {
  const supabaseUrl = getSupabaseUrl(env);
  const anonKey = getSupabaseAnonKey(env);

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
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

const authenticateAiCurator = async (request, env) => {
  const sessionToken =
    request.headers.get('x-session-token')?.trim() ||
    request.headers.get('X-Session-Token')?.trim() ||
    '';
  const legacyProfileId =
    request.headers.get('x-profile-id')?.trim() ||
    request.headers.get('X-Profile-Id')?.trim() ||
    '';

  let profileId = null;

  if (sessionToken) {
    profileId = await supabaseRpc(env, 'resolve_profile_session_token', {
      p_token: sessionToken,
    });
  } else if (legacyProfileId) {
    profileId = legacyProfileId;
  }

  if (!profileId || typeof profileId !== 'string') {
    return { ok: false, error: UNAUTHORIZED, status: 401 };
  }

  const isCurator = await supabaseRpc(env, 'profile_is_ai_curator', {
    p_profile_id: profileId,
  });

  if (isCurator !== true) {
    return { ok: false, error: UNAUTHORIZED, status: 403 };
  }

  let roleAtTime = 'Curador IA';

  try {
    const roleNames = await supabaseRpc(env, 'profile_role_names_csv', {
      p_profile_id: profileId,
    });

    if (typeof roleNames === 'string' && roleNames.trim()) {
      roleAtTime = roleNames.trim();
    }
  } catch (error) {
    console.error('profile_role_names_csv', error);
  }

  return { ok: true, profileId, roleAtTime };
};

const resolveGeminiApiKey = async (env, auth) => {
  const fromEnv = env.GEMINI_API_KEY?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  const fromDatabase = await supabaseRpc(env, 'obter_chave_gemini_ia_curador', {
    p_actor_profile_id: auth.profileId,
  });

  if (typeof fromDatabase === 'string' && fromDatabase.trim()) {
    return fromDatabase.trim();
  }

  return null;
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

const handlePost = async (request, env) => {
  let auth;

  try {
    auth = await authenticateAiCurator(request, env);
  } catch (error) {
    console.error('auth error', error);

    if (String(error).includes('missing_env:')) {
      return jsonResponse(
        {
          error:
            'Serviço de IA não configurado no servidor. Defina GEMINI_API_KEY no Cloudflare Pages (Production) e faça um novo deploy.',
        },
        503
      );
    }

    return jsonResponse({ error: 'Erro de autenticação do assistente.' }, 500);
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
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${geminiApiKey}`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = '';

      const pushEvent = (payload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: buildGeminiContents(question, history),
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 2048,
            },
          }),
        });

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error('Gemini API error:', geminiResponse.status, errorText);
          pushEvent({ error: 'Falha ao consultar o modelo de IA.' });
          controller.close();
          return;
        }

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
          await supabaseRpc(env, 'registrar_auditoria_ia_actor', {
            p_actor_profile_id: auth.profileId,
            p_question: question,
            p_ai_response: auditResponse,
          });
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
