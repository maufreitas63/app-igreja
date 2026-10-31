export type SpokenWord = {
  text: string;
  status: 'pending' | 'hit' | 'miss';
};

export type SpeakingGrade = {
  words: SpokenWord[];
  accuracy: number;
  passed: boolean;
};

const PASS_MARK = 0.8;

export function gradeSpeaking(phrase: string, transcript: string): SpeakingGrade {
  const shown = phrase.match(/[A-Za-z0-9']+/g) ?? [];
  const heard = transcript.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  let cursor = 0;
  let hits = 0;
  const words = shown.map((text) => {
    const at = heard.indexOf(text.toLowerCase(), cursor);
    if (at < 0) {
      return { text, status: 'miss' as const };
    }
    cursor = at + 1;
    hits += 1;
    return { text, status: 'hit' as const };
  });
  const accuracy = shown.length === 0 ? 0 : hits / shown.length;
  return {
    words,
    accuracy,
    passed: shown.length > 0 && accuracy >= PASS_MARK,
  };
}
