import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabaseConfig';
import { supabaseSessionFetch } from '@/lib/supabaseSessionFetch';
import { Platform } from 'react-native';

const isLocalWebDevHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

const resolveEndpoint = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && !isLocalWebDevHost(window.location.hostname)) {
    return `${window.location.origin}/api/class-lesson-family`;
  }

  return `${getSupabaseUrl()}/functions/v1/class-lesson-family`;
};

export async function suggestClassLessonFamily(input: {
  eventId: string;
  roomKey: 'KIDS' | 'TEENS';
  roomLabel: string;
  title: string;
  biblePassage: string;
  mainObjective: string;
}): Promise<string> {
  const response = await supabaseSessionFetch(resolveEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getSupabaseAnonKey()}`,
      apikey: getSupabaseAnonKey(),
    },
    body: JSON.stringify({
      eventId: input.eventId,
      roomKey: input.roomKey,
      roomLabel: input.roomLabel,
      title: input.title,
      biblePassage: input.biblePassage,
      mainObjective: input.mainObjective,
    }),
    timeoutMs: 60_000,
  });

  let payload: { text?: string; error?: string } = {};

  try {
    payload = (await response.json()) as { text?: string; error?: string };
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error?.trim() || 'Não foi possível sugerir a conversa em família.');
  }

  const text = String(payload.text ?? '').trim();

  if (!text) {
    throw new Error('A sugestão veio vazia. Tente de novo.');
  }

  return text;
}
