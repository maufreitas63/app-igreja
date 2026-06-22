import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  authenticateAiCuratorRequest,
  createServiceSupabaseClient,
} from '../_shared/sessionAuth.ts';

const SYSTEM_PROMPT = [
  'Você é o Assistente de Gestão da Igreja.',
  'Tom: profissional, acolhedor e focado na gestão eclesiástica.',
  'Ajude com planejamento, comunicação, organização de eventos, cuidado pastoral (sem substituir aconselhamento profissional), finanças em nível conceitual e boas práticas de liderança.',
  'Não invente dados internos da igreja; se faltar contexto, peça esclarecimentos.',
  'Responda em português do Brasil, de forma clara e objetiva.',
].join('\n');

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

      return String((part as Record<string, unknown>).text ?? '');
    })
    .join('');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405);
  }

  try {
    const supabase = createServiceSupabaseClient();
    const auth = await authenticateAiCuratorRequest(req, supabase);

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

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim();

    if (!geminiApiKey) {
      return jsonResponse({ error: 'Serviço de IA indisponível.' }, 503);
    }

    const history = Array.isArray(body.history) ? body.history : [];
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${geminiApiKey}`;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullResponse = '';

        const pushEvent = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: SYSTEM_PROMPT }],
              },
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
                const parsed = JSON.parse(payloadText) as unknown;
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
