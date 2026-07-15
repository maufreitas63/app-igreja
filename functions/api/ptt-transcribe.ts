/**
 * Cloudflare Pages Function — Whisper (Workers AI)
 * POST /api/ptt-transcribe
 * body: { audio_base64: string, language?: string }
 */

type AiRunResult = {
  text?: string;
};

type Env = {
  AI?: {
    run: (model: string, input: Record<string, unknown>) => Promise<AiRunResult>;
  };
};

type PagesContext = {
  request: Request;
  env: Env;
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
};

export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost = async (context: PagesContext) => {
  try {
    if (!context.env.AI) {
      return Response.json(
        { text: '', error: 'Workers AI não configurada neste projeto Cloudflare.' },
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await context.request.json()) as {
      audio_base64?: string;
      language?: string;
    };

    const audioBase64 = body.audio_base64?.trim();
    if (!audioBase64) {
      return Response.json(
        { text: '', error: 'Áudio ausente' },
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (audioBase64.length > 8_000_000) {
      return Response.json(
        { text: '', error: 'Áudio muito longo para transcrição.' },
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const language = body.language?.trim() || 'pt';

    let result: AiRunResult;
    try {
      result = await context.env.AI.run('@cf/openai/whisper-large-v3-turbo', {
        audio: audioBase64,
        task: 'transcribe',
        language,
      });
    } catch {
      const binary = atob(audioBase64);
      const bytes = Array.from(binary, (c) => c.charCodeAt(0));
      result = await context.env.AI.run('@cf/openai/whisper', {
        audio: bytes,
      });
    }

    const text = String(result?.text ?? '').trim();
    return Response.json(
      { text },
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro na transcrição';
    return Response.json(
      { text: '', error: message },
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};
