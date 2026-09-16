import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  authenticateAiLeadershipRequest,
  createServiceSupabaseClient,
} from '../_shared/sessionAuth.ts';

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

type ChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatRequestBody = {
  question?: string;
  history?: ChatHistoryItem[];
};

type GeminiPart = Record<string, unknown>;

type GeminiFunctionCall = {
  name: string;
  args: Record<string, unknown>;
};

type GeminiTurn =
  | { ok: true; text: string; functionCalls: GeminiFunctionCall[]; model: string }
  | { ok: false; status: number; errorText: string; model: string };

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const compactBootstrap = (snapshot: Record<string, unknown> | null) => {
  if (!snapshot) {
    return null;
  }

  const igreja =
    snapshot.igreja && typeof snapshot.igreja === 'object' && !Array.isArray(snapshot.igreja)
      ? (snapshot.igreja as Record<string, unknown>)
      : null;

  return {
    igreja: igreja
      ? { nome: igreja.nome ?? igreja.name, codigo: igreja.codigo ?? igreja.code }
      : undefined,
    operador: snapshot.operador,
    pessoas: snapshot.pessoas,
    eventos: snapshot.eventos,
  };
};

const clipText = (value: string, maxChars: number) => {
  const trimmed = value.trim();
  return trimmed.length <= maxChars ? trimmed : `${trimmed.slice(0, maxChars)}…`;
};

const buildSystemPrompt = (snapshot: Record<string, unknown> | null) => {
  const parts = [BASE_SYSTEM_PROMPT, ISOLATION_PROMPT];
  const compact = compactBootstrap(snapshot);

  if (compact) {
    parts.push(`contexto:\n${JSON.stringify(compact)}`);
  } else {
    parts.push('Sem resumo da instância. Use as ferramentas; não invente dados.');
  }

  return parts.join('\n\n');
};

const buildGeminiContents = (question: string, history: ChatHistoryItem[]) => {
  const contents = history
    .filter((item) => item.content?.trim())
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: clipText(item.content, MAX_HISTORY_CHARS) }] as GeminiPart[],
    }));

  contents.push({
    role: 'user',
    parts: [{ text: clipText(question, MAX_QUESTION_CHARS) }],
  });

  return contents;
};

const extractGeminiText = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as Record<string, unknown>;
  const candidates = record.candidates;

  if (!Array.isArray(candidates) || !candidates.length) {
    return '';
  }

  const first = candidates[0] as Record<string, unknown>;
  const content = first.content as Record<string, unknown> | undefined;
  const parts = content?.parts;

  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .map((part) => {
      if (!part || typeof part !== 'object') {
        return '';
      }

      const record = part as Record<string, unknown>;

      if (record.thought === true) {
        return '';
      }

      return String(record.text ?? '');
    })
    .join('');
};

const extractGeminiFunctionCalls = (payload: unknown): GeminiFunctionCall[] => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const candidates = (payload as Record<string, unknown>).candidates;

  if (!Array.isArray(candidates) || !candidates.length) {
    return [];
  }

  const first = candidates[0] as Record<string, unknown>;
  const content = first.content as Record<string, unknown> | undefined;
  const parts = content?.parts;

  if (!Array.isArray(parts)) {
    return [];
  }

  const calls: GeminiFunctionCall[] = [];

  for (const part of parts) {
    if (!part || typeof part !== 'object') {
      continue;
    }

    const record = part as Record<string, unknown>;
    const raw = (record.functionCall ?? record.function_call) as Record<string, unknown> | undefined;

    if (!raw || typeof raw !== 'object') {
      continue;
    }

    const name = String(raw.name ?? '').trim();

    if (!name) {
      continue;
    }

    const args =
      raw.args && typeof raw.args === 'object' && !Array.isArray(raw.args)
        ? (raw.args as Record<string, unknown>)
        : {};

    calls.push({ name, args });
  }

  return calls;
};

const isGeminiModelUnavailable = (status: number, errorText: string) => {
  const text = errorText.toLowerCase();
  return status === 404 || text.includes('not found') || text.includes('is not found for api version');
};

const isGeminiBusy = (status: number, errorText: string) => {
  const text = errorText.toLowerCase();
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

const describeGeminiError = (status: number, errorText: string) => {
  const text = errorText.toLowerCase();

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
      excerpt: errorText.slice(0, 400),
    })
  );

  return 'Não foi possível concluir a consulta à IA agora. Tente de novo em instantes.';
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const clampToolResult = (value: unknown) => {
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

const fetchGeminiTurn = async (
  apiKey: string,
  contents: Array<{ role: string; parts: GeminiPart[] }>,
  systemPrompt: string,
  allowTools: boolean
): Promise<GeminiTurn> => {
  const bodyPayload: Record<string, unknown> = {
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
  let lastModel = GEMINI_MODELS[0];
  let droppedThinking = false;

  for (const model of GEMINI_MODELS) {
    lastModel = model;

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
          let payload: unknown = null;

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
          return { ok: false, status: lastStatus, errorText: lastText, model };
        }

        if (lastStatus === 400 && !droppedThinking) {
          droppedThinking = true;
          delete (bodyPayload.generationConfig as Record<string, unknown>).thinkingConfig;
          attempt -= 1;
          continue;
        }

        if (isGeminiBusy(lastStatus, lastText) && attempt < GEMINI_BUSY_RETRIES) {
          continue;
        }

        if (isGeminiBusy(lastStatus, lastText) || isGeminiModelUnavailable(lastStatus, lastText) || lastStatus === 400) {
          break;
        }

        return { ok: false, status: lastStatus, errorText: lastText, model };
      } catch (error) {
        lastStatus = 0;
        lastText = error instanceof Error ? error.message : String(error);
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

  return { ok: false, status: lastStatus, errorText: lastText, model: lastModel };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405);
  }

  try {
    const supabase = createServiceSupabaseClient(req);
    const auth = await authenticateAiLeadershipRequest(req, supabase);

    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status);
    }

    let body: ChatRequestBody;

    try {
      body = (await req.json()) as ChatRequestBody;
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido.' }, 400);
    }

    const question = clipText(body.question?.trim() ?? '', MAX_QUESTION_CHARS);

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

    let geminiApiKey = '';

    const { data: configRow, error: configError } = await supabase
      .from('ai_server_config')
      .select('config_value')
      .eq('config_key', 'gemini_api_key')
      .maybeSingle();

    if (configError) {
      console.error(JSON.stringify({ event: 'ai-chat.config_error', message: configError.message }));
    }

    geminiApiKey = String(configRow?.config_value ?? '').trim();

    if (!geminiApiKey.startsWith('AIza')) {
      geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim() || '';
    }

    if (!geminiApiKey) {
      return jsonResponse({ error: 'Serviço de IA indisponível.' }, 503);
    }

    const history = Array.isArray(body.history) ? body.history : [];

    let instanceContext: Record<string, unknown> | null = null;

    try {
      const started = Date.now();
      const { data: snapshot, error: snapshotError } = await supabase.rpc(
        'consultar_ferramenta_ia_lideranca',
        {
          p_actor_profile_id: auth.profileId,
          p_ferramenta: 'resumo_instancia',
          p_parametros: {},
        }
      );

      if (snapshotError) {
        console.error(
          JSON.stringify({
            event: 'ai-chat.resumo_error',
            message: snapshotError.message,
            ms: Date.now() - started,
          })
        );
      } else if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
        instanceContext = snapshot as Record<string, unknown>;
        console.log(
          JSON.stringify({
            event: 'ai-chat.resumo_ok',
            ms: Date.now() - started,
          })
        );
      }
    } catch (error) {
      console.error(JSON.stringify({ event: 'ai-chat.resumo_exception', error: String(error) }));
    }

    const systemPrompt = buildSystemPrompt(instanceContext);
    const contents = buildGeminiContents(question, history);

    const executeTool = async (call: GeminiFunctionCall) => {
      const name = call.name.trim();
      const started = Date.now();

      if (!ALLOWED_TOOLS.has(name)) {
        console.error(JSON.stringify({ event: 'ai-chat.tool_blocked', name }));
        return { ok: false, erro: 'ferramenta_nao_permitida' };
      }

      try {
        const { data, error } = await supabase.rpc('consultar_ferramenta_ia_lideranca', {
          p_actor_profile_id: auth.profileId,
          p_ferramenta: name,
          p_parametros: call.args,
        });

        if (error) {
          console.error(
            JSON.stringify({
              event: 'ai-chat.tool_error',
              name,
              message: error.message,
              ms: Date.now() - started,
            })
          );
          return { ok: false, erro: 'consulta_indisponivel' };
        }

        console.log(
          JSON.stringify({
            event: 'ai-chat.tool_ok',
            name,
            ms: Date.now() - started,
          })
        );

        return clampToolResult(data);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: 'ai-chat.tool_exception',
            name,
            error: String(error),
            ms: Date.now() - started,
          })
        );
        return { ok: false, erro: 'consulta_indisponivel' };
      }
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullResponse = '';

        const pushEvent = (payload: Record<string, unknown>) => {
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

            const toolParts: GeminiPart[] = [];

            for (const call of uniqueCalls) {
              const result = await executeTool(call);
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

            const allowMoreTools = rounds < MAX_TOOL_ROUNDS;
            turn = await fetchGeminiTurn(geminiApiKey, contents, systemPrompt, allowMoreTools);
          }

          if (!turn.ok) {
            pushEvent({ error: describeGeminiError(turn.status, turn.errorText) });
            return;
          }

          if (!turn.text.trim()) {
            pushEvent({
              error: 'O modelo de IA não devolveu resposta. Reformule a pergunta de forma mais objetiva e tente de novo.',
            });
            return;
          }

          fullResponse = turn.text;
          pushEvent({ text: turn.text });

          const auditResponse = fullResponse.trim() || '(resposta vazia)';

          const { error: auditError } = await supabase.rpc('insert_ai_audit_log', {
            p_user_id: auth.profileId,
            p_question: question,
            p_ai_response: auditResponse,
            p_role_at_time: auth.roleAtTime,
          });

          if (auditError) {
            console.error(JSON.stringify({ event: 'ai-chat.audit_error', message: auditError.message }));
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
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'ai-chat.handler_error', error: String(error) }));
    return jsonResponse({ error: 'Erro interno.' }, 500);
  }
});
