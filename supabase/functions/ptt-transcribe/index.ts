import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Body = {
  audio_url?: string;
  audio_base64?: string;
  mime_type?: string;
  language?: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!openaiKey) {
      return new Response(JSON.stringify({ text: '', error: 'OPENAI_API_KEY não configurada' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = request.headers.get('Authorization') ?? '';

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    // auth opcional: app também autentica por sessão phone/profile
    void userData;

    const body = (await request.json()) as Body;
    const language = body.language?.trim() || 'pt';

    let audioBytes: Uint8Array | null = null;
    let mimeType = body.mime_type?.trim() || 'audio/webm';

    if (body.audio_base64?.trim()) {
      const binary = atob(body.audio_base64.trim());
      audioBytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    } else if (body.audio_url?.trim()) {
      const audioRes = await fetch(body.audio_url.trim());
      if (!audioRes.ok) {
        throw new Error(`Falha ao baixar áudio (${audioRes.status})`);
      }
      audioBytes = new Uint8Array(await audioRes.arrayBuffer());
      mimeType = audioRes.headers.get('content-type') || mimeType;
    }

    if (!audioBytes?.length) {
      return new Response(JSON.stringify({ text: '', error: 'Áudio ausente' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const form = new FormData();
    form.append(
      'file',
      new Blob([audioBytes], { type: mimeType }),
      mimeType.includes('mp4') ? 'audio.m4a' : 'audio.webm'
    );
    form.append('model', 'whisper-1');
    form.append('language', language);

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      throw new Error(`Whisper ${whisperRes.status}: ${errText.slice(0, 300)}`);
    }

    const json = (await whisperRes.json()) as { text?: string };
    return new Response(JSON.stringify({ text: (json.text ?? '').trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro na transcrição';
    return new Response(JSON.stringify({ text: '', error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
