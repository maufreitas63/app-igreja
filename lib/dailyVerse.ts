export type DailyVerseDetails = {
  text: string;
  reference: string;
  version: string;
  verseurl: string;
};

type DailyVerseApiResponse = {
  verse?: {
    details?: DailyVerseDetails;
    notice?: string;
  };
};

const DAILY_VERSE_API_URL =
  'https://beta.ourmanna.com/api/v1/get?format=json&order=daily';

let cachedVerse: { dateKey: string; details: DailyVerseDetails } | null = null;

function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchDailyVerse(): Promise<DailyVerseDetails> {
  const todayKey = getTodayDateKey();

  if (cachedVerse?.dateKey === todayKey) {
    return cachedVerse.details;
  }

  const response = await fetch(DAILY_VERSE_API_URL);

  if (!response.ok) {
    throw new Error('Não foi possível carregar o versículo do dia.');
  }

  const data = (await response.json()) as DailyVerseApiResponse;
  const details = data.verse?.details;

  if (!details?.text?.trim()) {
    throw new Error('Versículo do dia indisponível no momento.');
  }

  const normalized: DailyVerseDetails = {
    text: details.text.trim(),
    reference: details.reference?.trim() || '',
    version: details.version?.trim() || '',
    verseurl: details.verseurl?.trim() || '',
  };

  cachedVerse = { dateKey: todayKey, details: normalized };
  return normalized;
}
