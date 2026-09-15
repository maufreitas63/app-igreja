import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  authenticateAiLeadershipRequest,
  createServiceSupabaseClient,
} from '../_shared/sessionAuth.ts';

const BASE_SYSTEM_PROMPT = [
  'Você é o Assistente de Gestão da Igreja.',
  'Tom: profissional, acolhedor e focado na gestão eclesiástica.',
  'Ajude com planejamento, comunicação, organização de eventos, cuidado pastoral (sem substituir aconselhamento profissional), finanças da instância (quando o JSON trouxer) e boas práticas de liderança.',
  'Responda em português do Brasil, de forma clara e objetiva.',
].join('\n');

const ISOLATION_PROMPT = [
  'ISOLAMENTO OBRIGATÓRIO (não negociável):',
  '- Use o JSON contexto_da_instancia. Ele já está limitado à igreja da sessão atual.',
  '- É proibido usar, inferir, comparar ou pedir dados de outra igreja, tenant ou instância.',
  '- É proibido inventar números, nomes, totais ou eventos que não estejam no JSON.',
  '- É proibido instruir exportação, cópia, e-mail, planilha ou envio desses dados para fora do aplicativo.',
  '- Não revele IDs internos, tokens, chaves de API, PINs, senhas, chaves PIX ou senha de totem.',
  '- Cuidado pastoral: apenas totais, se existirem; nunca conteúdo, motivo, telefone ou identidade.',
  '- Resultado histórico da tela Financeiro = financas.resultado_historico. O valor pedido é saldo_atual. Informe também período, receitas e despesas ordinárias e extraordinárias.',
  '- Eventos: use eventos.recentes (já realizados) e eventos.proximos. totais.na_instancia é o total da instância. Lista vazia significa zero naquele recorte, não que o sistema não tenha cadastro.',
  '- Se o JSON tiver a seção (pessoas, eventos, financas), responda com esses números mesmo que sejam zero. Só diga que não está disponível quando a seção não existir no JSON.',
  '- Responda a pergunta por completo, em português do Brasil.',
].join('\n');

const MAX_CONTEXT_CHARS = 14_000;

const compactInstanceSnapshot = (snapshot: Record<string, unknown>) => {
  const payload: Record<string, unknown> = {
    isolamento: snapshot.isolamento,
    igreja: snapshot.igreja,
    operador: snapshot.operador,
    pessoas: snapshot.pessoas,
    financas: snapshot.financas,
    relatorios_despesa: snapshot.relatorios_despesa,
    eventos: snapshot.eventos,
    proximos_eventos: snapshot.proximos_eventos,
    pequenos_grupos: snapshot.pequenos_grupos,
    cuidado_pastoral: snapshot.cuidado_pastoral,
  };

  if (JSON.stringify(payload).length <= MAX_CONTEXT_CHARS) {
    return payload;
  }

  delete payload.pequenos_grupos;

  const finance = payload.financas;
  if (finance && typeof finance === 'object' && !Array.isArray(finance)) {
    const nextFinance = { ...(finance as Record<string, unknown>) };
    delete nextFinance.meses_realizado;
    payload.financas = nextFinance;
  }

  if (JSON.stringify(payload).length <= MAX_CONTEXT_CHARS) {
    return payload;
  }

  return {
    isolamento: snapshot.isolamento,
    igreja: snapshot.igreja,
    pessoas: snapshot.pessoas,
    financas: payload.financas,
    eventos: snapshot.eventos,
    cuidado_pastoral: snapshot.cuidado_pastoral,
  };
};

const buildSystemPrompt = (snapshot: Record<string, unknown> | null) => {
  const parts = [BASE_SYSTEM_PROMPT, ISOLATION_PROMPT];

  if (snapshot) {
    const compact = compactInstanceSnapshot(snapshot);
    parts.push(`contexto_da_instancia (confidencial, só esta igreja):\n${JSON.stringify(compact)}`);
  } else {
    parts.push(
      'Não há snapshot da instância disponível nesta consulta. Não invente dados internos da igreja.'
    );
  }

  return parts.join('\n\n');
};

const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.6-flash',
];

type ChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatRequestBody = {
  question?: string;
  history?: ChatHistoryItem[];
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const buildGeminiContents = (question: string, history: ChatHistoryItem[]) => {
  const contents = history
    .filter((item) => item.content?.trim())
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

const isGeminiModelUnavailable = (status: number, errorText: string) => {
  const text = errorText.toLowerCase();
  return status === 404 || text.includes('not found') || text.includes('is not found for api version');
};

const describeGeminiError = (status: number, errorText: string) => {
  const text = errorText.toLowerCase();

  if (status === 401 || status === 403 || text.includes('api key not valid') || text.includes('api_key_invalid')) {
    return 'Chave Gemini inválida ou sem permissão. O Super Administrador deve cadastrar uma chave válida em Assistente IA → Chave API.';
  }

  if (status === 429 || text.includes('quota') || text.includes('resource_exhausted')) {
    return 'A cota da API Gemini foi excedida. Tente novamente mais tarde.';
  }

  if (isGeminiModelUnavailable(status, errorText)) {
    return 'O modelo de IA não está disponível para esta chave. Tente novamente após a atualização do aplicativo.';
  }

  if (errorText.toLowerCase().includes('abort')) {
    return 'O modelo de IA demorou demais para responder. Tente de novo em instantes.';
  }

  return 'Falha ao consultar o modelo de IA.';
};

const fetchGeminiText = async (
  apiKey: string,
  question: string,
  history: ChatHistoryItem[],
  systemPrompt: string
) => {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt || BASE_SYSTEM_PROMPT }] },
    contents: buildGeminiContents(question, history),
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      thinkingConfig: {
        thinkingBudget: 0,
        thinkingLevel: 'MINIMAL',
      },
    },
  });

  let lastStatus = 0;
  let lastText = '';

  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18_000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body,
          signal: controller.signal,
        }
      );

      lastStatus = response.status;
      lastText = await response.text();

      if (response.ok) {
        let payload: unknown = null;
        try {
          payload = JSON.parse(lastText);
        } catch {
          continue;
        }

        const text = extractGeminiText(payload).trim();

        if (text) {
          return { ok: true as const, text };
        }

        lastText = 'empty_candidates';
        continue;
      }

      console.error('Gemini API error:', model, lastStatus, lastText);

      if (!isGeminiModelUnavailable(lastStatus, lastText) && lastStatus !== 400) {
        break;
      }
    } catch (error) {
      lastStatus = 0;
      lastText = error instanceof Error ? error.message : String(error);
      console.error('Gemini fetch error:', model, lastText);
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false as const, status: lastStatus, errorText: lastText };
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

    const question = body.question?.trim() ?? '';

    if (!question) {
      return jsonResponse({ error: 'Informe uma pergunta.' }, 400);
    }

    let geminiApiKey = '';

    const { data: configRow, error: configError } = await supabase
      .from('ai_server_config')
      .select('config_value')
      .eq('config_key', 'gemini_api_key')
      .maybeSingle();

    if (configError) {
      console.error('ai_server_config:', configError.message);
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
      const { data: snapshot, error: snapshotError } = await supabase.rpc(
        'obter_contexto_ia_lideranca',
        { p_actor_profile_id: auth.profileId }
      );

      if (snapshotError) {
        console.error('obter_contexto_ia_lideranca:', snapshotError.message);
      } else if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
        instanceContext = snapshot as Record<string, unknown>;
      }
    } catch (error) {
      console.error('obter_contexto_ia_lideranca:', error);
    }

    const systemPrompt = buildSystemPrompt(instanceContext);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullResponse = '';

        const pushEvent = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          const gemini = await fetchGeminiText(geminiApiKey, question, history, systemPrompt);

          if (!gemini.ok) {
            pushEvent({ error: describeGeminiError(gemini.status, gemini.errorText) });
            controller.close();
            return;
          }

          fullResponse = gemini.text;
          pushEvent({ text: gemini.text });

          const auditResponse = fullResponse.trim() || '(resposta vazia)';

          const { error: auditError } = await supabase.rpc('insert_ai_audit_log', {
            p_user_id: auth.profileId,
            p_question: question,
            p_ai_response: auditResponse,
            p_role_at_time: auth.roleAtTime,
          });

          if (auditError) {
            console.error('insert_ai_audit_log:', auditError.message);
          }

          pushEvent({ done: true });
        } catch (error) {
          console.error('ai-chat stream error:', error);
          pushEvent({ error: 'Erro interno ao processar a consulta.' });
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
    console.error('ai-chat handler error:', error);
    return jsonResponse({ error: 'Erro interno.' }, 500);
  }
});
