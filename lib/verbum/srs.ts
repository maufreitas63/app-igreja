/** Repetição espaçada do Verbum (SM-2 adaptado). O banco aplica a mesma conta. */

export type SrsState = {
  consecutiveSuccess: number;
  repetitionInterval: number;
  stabilityFactor: number;
};

export type SrsResult = SrsState & {
  nextReviewDue: Date;
};

const MIN_STABILITY = 1.3;

export function reviewWord(current: SrsState, correct: boolean, now = new Date()): SrsResult {
  if (!correct) {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    return {
      consecutiveSuccess: 0,
      repetitionInterval: 1,
      stabilityFactor: Math.max(MIN_STABILITY, current.stabilityFactor - 0.2),
      nextReviewDue: next,
    };
  }

  const interval =
    current.repetitionInterval === 0
      ? 1
      : current.repetitionInterval === 1
        ? 6
        : Math.round(current.repetitionInterval * current.stabilityFactor);
  const next = new Date(now);
  next.setDate(next.getDate() + interval);

  return {
    consecutiveSuccess: current.consecutiveSuccess + 1,
    repetitionInterval: interval,
    stabilityFactor: Math.max(MIN_STABILITY, current.stabilityFactor + 0.1),
    nextReviewDue: next,
  };
}
