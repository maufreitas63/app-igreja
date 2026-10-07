import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createServiceSupabaseClient } from '../_shared/sessionAuth.ts';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest'];
const GEMINI_TIMEOUT_MS = 45_000;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const clip = (value: unknown, max: number) => {
  const text = String(value ?? '').trim();
  return text.length <= max ? text : text.slice(0, max);
};

const extractGeminiText = (payload: { candidates?: Array<{ content?: { parts?: Array<{ thought?: boolean; text?: string }> } }> }) => {
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

const cleanSuggestion = (value: string) =>
  value.replace(/^["“”']+|["“”']+$/g, '').replace(/\*\*/g, '').trim();

const suggestFamilyExtension = async (apiKey: string, prompt: string) => {
  const bodyPayload: {
    systemInstruction: { parts: Array<{ text: string }> };
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig: {
      temperature: number;
      maxOutputTokens: number;
      thinkingConfig?: { thinkingBudget: number };
    };
  } = {
    systemInstruction: {
      parts: [
        {
          text: [
            'Redija a conversa em família de uma aula da sala infantil ou de jovens.',
            'Use somente o título, a passagem bíblica e o objetivo informados. Não troque a passagem e não invente outro tema.',
            'Escreva em português do Brasil, de 2 a 4 frases, para os pais aplicarem em casa durante a semana: uma pergunta simples e um desafio curto.',
            'Devolva só o texto, sem título, sem aspas e sem markdown.',
          ].join('\n'),
        },
      ],
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405);
  }

  const sessionToken = req.headers.get('x-session-token')?.trim() || req.headers.get('X-Session-Token')?.trim() || '';

  if (!sessionToken) {
    return jsonResponse({ error: 'Sessão inválida. Saia e entre novamente.' }, 401);
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Pedido inválido.' }, 400);
  }

  const eventId = String(body.eventId ?? '').trim();
  const roomKey = String(body.roomKey ?? '').trim().toUpperCase();
  const title = clip(body.title, 240);
  const biblePassage = clip(body.biblePassage, 240);
  const mainObjective = clip(body.mainObjective, 800);
  const roomLabel = clip(body.roomLabel, 80);

  if (!eventId || (roomKey !== 'KIDS' && roomKey !== 'TEENS')) {
    return jsonResponse({ error: 'Sala inválida.' }, 400);
  }

  if (title.length < 2 || biblePassage.length < 1 || mainObjective.length < 1) {
    return jsonResponse({ error: 'Preencha o título, a passagem e o objetivo para sugerir a conversa.' }, 400);
  }

  const supabase = createServiceSupabaseClient(req);
  const { data: gate, error: gateError } = await supabase.rpc('get_class_lesson', {
    p_event_id: eventId,
    p_room_key: roomKey,
  });

  if (gateError) {
    console.error('class-lesson-family.gate', gateError.message);
    return jsonResponse({ error: 'Não foi possível confirmar o planejamento desta sala.' }, 503);
  }

  const gateRecord = gate && typeof gate === 'object' ? (gate as { success?: boolean; message?: string }) : null;

  if (!gateRecord || gateRecord.success !== true) {
    return jsonResponse({ error: gateRecord?.message || 'Sem permissão para o planejamento desta sala.' }, 403);
  }

  const { data: keyRow } = await supabase
    .from('ai_server_config')
    .select('config_value')
    .eq('config_key', 'gemini_api_key')
    .maybeSingle();

  const fromTable = String(keyRow?.config_value ?? '').trim();
  const fromEnv = Deno.env.get('GEMINI_API_KEY')?.trim() ?? '';
  const apiKey = fromTable.startsWith('AIza') ? fromTable : fromEnv.startsWith('AIza') ? fromEnv : '';

  if (!apiKey) {
    return jsonResponse({ error: 'A sugestão da conversa em família ainda não está disponível neste ambiente.' }, 503);
  }

  const prompt = [
    `Sala: ${roomLabel || (roomKey === 'TEENS' ? 'Jovens' : 'Infantil')}`,
    `Título: ${title}`,
    `Passagem: ${biblePassage}`,
    `Objetivo: ${mainObjective}`,
  ].join('\n');

  try {
    const text = await suggestFamilyExtension(apiKey, prompt);
    return jsonResponse({ text });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Não foi possível sugerir a conversa.' },
      502
    );
  }
});
