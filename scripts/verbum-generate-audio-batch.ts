/**
 * Gera o áudio dos exercícios do Verbum que ainda não têm audio_url.
 * Usa OpenAI TTS (voz alloy) e grava em public/audio-lessons/exercises/{id}.mp3.
 *
 * Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
 * Não imprime chaves. Executar só quando essas variáveis já estiverem no ambiente.
 */
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'audio-lessons';
const DELAY_MS = 200;

type ExerciseRow = {
  id: number;
  verse_target_en: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variável ${name} ausente.`);
  }
  return value;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function synthesize(text: string, apiKey: string): Promise<ArrayBuffer> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
      response_format: 'mp3',
    }),
  });
  if (!response.ok) {
    throw new Error(`TTS recusou o versículo (${response.status}).`);
  }
  return response.arrayBuffer();
}

async function main(): Promise<void> {
  const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  const openaiKey = requiredEnv('OPENAI_API_KEY');

  const { error: bucketError } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    throw new Error(bucketError.message);
  }

  const { data, error } = await supabase
    .from('verbum_exercises')
    .select('id, verse_target_en')
    .is('audio_url', null);
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ExerciseRow[];
  for (const row of rows) {
    const audio = await synthesize(row.verse_target_en, openaiKey);
    const path = `exercises/${row.id}.mp3`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, audio, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    if (uploadError) {
      throw new Error(uploadError.message);
    }
    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error: updateError } = await supabase
      .from('verbum_exercises')
      .update({ audio_url: publicUrl.publicUrl })
      .eq('id', row.id);
    if (updateError) {
      throw new Error(updateError.message);
    }
    await sleep(DELAY_MS);
  }

  console.log(`Áudios gerados: ${rows.length}.`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha ao gerar áudios.';
  console.error(message);
  process.exitCode = 1;
});
