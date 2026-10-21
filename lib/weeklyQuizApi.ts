import { getSupabaseAnonKey } from '@/lib/supabaseConfig';
import { supabase } from '@/lib/supabase';
import { supabaseSessionFetch } from '@/lib/supabaseSessionFetch';
import { resolveAiChatEndpoint } from '@/lib/aiChatApi';
import { Platform } from 'react-native';

export const WEEKLY_QUIZ_SQL_HINT =
  'O quiz semanal ainda não está disponível neste ambiente.';

export type WeeklyQuizDraftQuestion = {
  id: string;
  position: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  bibleReference: string;
};

export type WeeklyQuizDraft = {
  id: string;
  title: string;
  videoId: string;
  sermonPublishedAt: string;
  questions: WeeklyQuizDraftQuestion[];
};

export type WeeklyQuizRankingRow = {
  name: string;
  points: number;
};

export type WeeklyQuizPublished = {
  id: string;
  title: string;
  videoId: string;
  sermonPublishedAt: string;
  participantCount: number;
  contextSummary: string;
};

export type WeeklyQuizArchivedSermon = {
  videoId: string;
  title: string;
  sermonPublishedAt: string;
  contextSummary: string;
};

export type WeeklyQuizAdminSnapshot = {
  youtubeUrl: string | null;
  draft: WeeklyQuizDraft | null;
  published: WeeklyQuizPublished[];
  archives: WeeklyQuizArchivedSermon[];
  ranking: WeeklyQuizRankingRow[];
};

export type WeeklyQuizMemberQuestion = {
  id: string;
  position: number;
  prompt: string;
  options: string[];
  answered: boolean;
  selectedIndex: number | null;
  isCorrect: boolean | null;
  bibleReference: string | null;
  correctOption: string | null;
};

export type WeeklyQuizMemberQuiz = {
  id: string;
  title: string;
  videoId: string;
  sermonPublishedAt: string;
  contextSummary: string;
  completed: boolean;
  weekScore: number;
  answeredCount: number;
  questions: WeeklyQuizMemberQuestion[];
};

export type WeeklyQuizMemberState = {
  quiz: WeeklyQuizMemberQuiz | null;
  totalScore: number;
};

export type WeeklyQuizAnswerResult = {
  isCorrect: boolean;
  bibleReference: string;
  correctOption: string;
  weekScore: number;
  totalScore: number;
  completed: boolean;
  answeredCount: number;
};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asOptions = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : [];

const rpcErrorMessage = (error: { message?: string } | null, fallback: string) =>
  error?.message?.trim() || fallback;

export const formatSermonDateLabel = (value: string | null | undefined) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
};

const parseDraft = (value: unknown): WeeklyQuizDraft | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = asText(row.id);

  if (!id) {
    return null;
  }

  const questions = Array.isArray(row.questions)
    ? row.questions.map((item) => {
        const question = item as Record<string, unknown>;
        return {
          id: asText(question.id),
          position: asNumber(question.position),
          prompt: asText(question.prompt),
          options: asOptions(question.options),
          correctIndex: asNumber(question.correctIndex, -1),
          bibleReference: asText(question.bibleReference),
        };
      })
    : [];

  return {
    id,
    title: asText(row.title),
    videoId: asText(row.videoId),
    sermonPublishedAt: asText(row.sermonPublishedAt),
    questions,
  };
};

const parsePublishedQuiz = (value: unknown): WeeklyQuizPublished | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = asText(row.id);

  if (!id) {
    return null;
  }

  return {
    id,
    title: asText(row.title) || 'Pregação',
    videoId: asText(row.videoId),
    sermonPublishedAt: asText(row.sermonPublishedAt),
    participantCount: asNumber(row.participantCount),
    contextSummary: asText(row.contextSummary),
  };
};

const parseArchivedSermon = (value: unknown): WeeklyQuizArchivedSermon | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const videoId = asText(row.videoId);

  if (!videoId) {
    return null;
  }

  return {
    videoId,
    title: asText(row.title) || 'Pregação',
    sermonPublishedAt: asText(row.sermonPublishedAt),
    contextSummary: asText(row.contextSummary),
  };
};

export const parseWeeklyQuizAdminSnapshot = (value: unknown): WeeklyQuizAdminSnapshot => {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    youtubeUrl: asText(row.youtubeUrl) || null,
    draft: parseDraft(row.draft),
    published: Array.isArray(row.published)
      ? row.published
          .map(parsePublishedQuiz)
          .filter((item): item is WeeklyQuizPublished => item !== null)
      : [],
    archives: Array.isArray(row.archives)
      ? row.archives
          .map(parseArchivedSermon)
          .filter((item): item is WeeklyQuizArchivedSermon => item !== null)
      : [],
    ranking: Array.isArray(row.ranking)
      ? row.ranking.map((item) => {
          const rank = item as Record<string, unknown>;
          return { name: asText(rank.name) || 'Sem nome', points: asNumber(rank.points) };
        })
      : [],
  };
};

const parseMemberQuestion = (value: unknown): WeeklyQuizMemberQuestion | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = asText(row.id);

  if (!id) {
    return null;
  }

  return {
    id,
    position: asNumber(row.position),
    prompt: asText(row.prompt),
    options: asOptions(row.options),
    answered: row.answered === true,
    selectedIndex: row.selectedIndex == null ? null : asNumber(row.selectedIndex, -1),
    isCorrect: row.isCorrect == null ? null : row.isCorrect === true,
    bibleReference: asText(row.bibleReference) || null,
    correctOption: asText(row.correctOption) || null,
  };
};

export const parseWeeklyQuizMemberState = (value: unknown): WeeklyQuizMemberState => {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const quizRow = row.quiz && typeof row.quiz === 'object' ? (row.quiz as Record<string, unknown>) : null;

  if (!quizRow || !asText(quizRow.id)) {
    return { quiz: null, totalScore: asNumber(row.totalScore) };
  }

  return {
    totalScore: asNumber(row.totalScore),
    quiz: {
      id: asText(quizRow.id),
      title: asText(quizRow.title),
      videoId: asText(quizRow.videoId),
      sermonPublishedAt: asText(quizRow.sermonPublishedAt),
      contextSummary: asText(quizRow.contextSummary),
      completed: quizRow.completed === true,
      weekScore: asNumber(quizRow.weekScore),
      answeredCount: asNumber(quizRow.answeredCount),
      questions: Array.isArray(quizRow.questions)
        ? quizRow.questions
            .map(parseMemberQuestion)
            .filter((item): item is WeeklyQuizMemberQuestion => item !== null)
        : [],
    },
  };
};

export const fetchWeeklyQuizAdminSnapshot = async () => {
  const { data, error } = await supabase.rpc('weekly_quiz_admin_snapshot');

  if (error) {
    throw new Error(rpcErrorMessage(error, 'Não foi possível carregar o quiz semanal.'));
  }

  return parseWeeklyQuizAdminSnapshot(data);
};

export const publishWeeklyQuiz = async (quizId: string, questionIds: string[]) => {
  const { data, error } = await supabase.rpc('weekly_quiz_publish', {
    p_quiz_id: quizId,
    p_question_ids: questionIds,
  });

  if (error) {
    throw new Error(rpcErrorMessage(error, 'Não foi possível publicar o quiz.'));
  }

  return parseWeeklyQuizAdminSnapshot(data);
};

export const deletePublishedWeeklyQuiz = async (quizId: string) => {
  const { data, error } = await supabase.rpc('weekly_quiz_delete_published', { p_quiz_id: quizId });

  if (error) {
    throw new Error(rpcErrorMessage(error, 'Não foi possível excluir o quiz desta data.'));
  }

  return parseWeeklyQuizAdminSnapshot(data);
};

export const clearWeeklyQuizScores = async (quizId: string) => {
  const { data, error } = await supabase.rpc('weekly_quiz_clear_scores', { p_quiz_id: quizId });

  if (error) {
    throw new Error(rpcErrorMessage(error, 'Não foi possível excluir a pontuação deste quiz.'));
  }

  return parseWeeklyQuizAdminSnapshot(data);
};

export const discardWeeklyQuizDraft = async (quizId: string) => {
  const { data, error } = await supabase.rpc('weekly_quiz_discard_draft', { p_quiz_id: quizId });

  if (error) {
    throw new Error(rpcErrorMessage(error, 'Não foi possível descartar a prévia.'));
  }

  return parseWeeklyQuizAdminSnapshot(data);
};

export const fetchWeeklyQuizSermonTranscript = async (videoId: string) => {
  const { data, error } = await supabase.rpc('weekly_quiz_sermon_archive', { p_video_id: videoId });

  if (error) {
    throw new Error(rpcErrorMessage(error, 'Não foi possível abrir a transcrição.'));
  }

  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  return asText(row?.transcript);
};

export type WeeklyQuizRankRow = {
  position: number;
  name: string;
  points: number;
  isMe?: boolean;
};

export type WeeklyQuizProfileRanking = {
  hasCompleted: boolean;
  totalPoints: number;
  position: number;
  inTopFive: boolean;
  top: WeeklyQuizRankRow[];
  me: WeeklyQuizRankRow | null;
};

export const fetchWeeklyQuizProfileRanking = async () => {
  const { data, error } = await supabase.rpc('weekly_quiz_profile_ranking');

  if (error) {
    throw new Error(rpcErrorMessage(error, 'Não foi possível carregar o ranking.'));
  }

  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const me = row.me && typeof row.me === 'object' ? (row.me as Record<string, unknown>) : null;

  return {
    hasCompleted: row.hasCompleted === true,
    totalPoints: asNumber(row.totalPoints),
    position: asNumber(row.position),
    inTopFive: row.inTopFive === true,
    top: Array.isArray(row.top)
      ? row.top.map((item) => {
          const rank = item as Record<string, unknown>;
          return {
            position: asNumber(rank.position),
            name: asText(rank.name) || 'Sem nome',
            points: asNumber(rank.points),
            isMe: rank.isMe === true,
          };
        })
      : [],
    me: me
      ? {
          position: asNumber(me.position),
          name: asText(me.name) || 'Sem nome',
          points: asNumber(me.points),
          isMe: true,
        }
      : null,
  } satisfies WeeklyQuizProfileRanking;
};

export const fetchMemberWeeklyQuiz = async () => {
  const { data, error } = await supabase.rpc('weekly_quiz_for_member');

  if (error) {
    throw new Error(rpcErrorMessage(error, 'Não foi possível carregar o quiz.'));
  }

  return parseWeeklyQuizMemberState(data);
};

export const submitWeeklyQuizAnswer = async (questionId: string, selectedIndex: number) => {
  const { data, error } = await supabase.rpc('weekly_quiz_submit_answer', {
    p_question_id: questionId,
    p_selected_index: selectedIndex,
  });

  if (error) {
    throw new Error(rpcErrorMessage(error, 'Não foi possível registrar a resposta.'));
  }

  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  return {
    isCorrect: row.isCorrect === true,
    bibleReference: asText(row.bibleReference),
    correctOption: asText(row.correctOption),
    weekScore: asNumber(row.weekScore),
    totalScore: asNumber(row.totalScore),
    completed: row.completed === true,
    answeredCount: asNumber(row.answeredCount),
  } satisfies WeeklyQuizAnswerResult;
};

const resolveWeeklyQuizEndpoint = () => {
  const aiEndpoint = resolveAiChatEndpoint();

  if (aiEndpoint.endsWith('/api/ai-chat')) {
    return aiEndpoint.replace(/\/api\/ai-chat$/, '/api/weekly-quiz');
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/api/weekly-quiz`;
  }

  return aiEndpoint.replace(/\/functions\/v1\/ai-chat$/, '/functions/v1/weekly-quiz');
};

type WeeklyQuizPostBody = {
  action: 'preview' | 'transcribe' | 'compose' | 'recompose';
  videoId?: string;
};

type WeeklyQuizPostPayload = {
  snapshot?: unknown;
  error?: string;
  videoId?: string;
  done?: boolean;
  coveredUntil?: string;
  title?: string;
  theme?: string;
  preacher?: string;
  celebrationDate?: string;
};

const postWeeklyQuiz = async (body: WeeklyQuizPostBody, timeoutMs = 90_000) => {
  let response: Response;

  try {
    response = await supabaseSessionFetch(resolveWeeklyQuizEndpoint(), {
      method: 'POST',
      timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getSupabaseAnonKey()}`,
        apikey: getSupabaseAnonKey(),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    const timedOut = body.action === 'compose' || body.action === 'recompose'
      ? 'A geração das perguntas passou do tempo limite. Toque de novo para tentar outra vez.'
      : 'A transcrição passou do tempo limite. Toque de novo para continuar de onde parou.';
    throw new Error(aborted ? timedOut : 'Não foi possível buscar a pregação e gerar o quiz.');
  }

  const raw = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(raw) as WeeklyQuizPostPayload;
    } catch {
      return null;
    }
  })();

  if (!response.ok) {
    const timedOut = body.action === 'compose' || body.action === 'recompose'
      ? 'A geração das perguntas passou do tempo limite. Toque de novo para tentar outra vez.'
      : 'A transcrição passou do tempo limite. Toque de novo para continuar de onde parou.';
    throw new Error(payload?.error || (response.status === 524 ? timedOut : 'Não foi possível buscar a pregação e gerar o quiz.'));
  }

  return payload;
};

export type WeeklySermonPreview = {
  videoId: string;
  title: string;
  theme: string;
  preacher: string;
  celebrationDate: string;
};

export const previewWeeklySermon = async () => {
  const payload = await postWeeklyQuiz({ action: 'preview' }, 30_000);
  const videoId = asText(payload?.videoId);
  const theme = asText(payload?.theme);
  const preacher = asText(payload?.preacher);
  const celebrationDate = asText(payload?.celebrationDate);

  if (!videoId || !theme || !preacher || !celebrationDate) {
    throw new Error('Não foi possível ler o tema, o pregador e a data desta celebração.');
  }

  return {
    videoId,
    title: asText(payload?.title) || theme,
    theme,
    preacher,
    celebrationDate,
  } satisfies WeeklySermonPreview;
};

export const generateWeeklyQuizDraft = async (
  videoId?: string,
  onProgress?: (message: string) => void,
) => {
  let currentVideoId = videoId || '';
  let retries = 0;
  let coveredUntil = '';

  for (let part = 0; part < 80; part += 1) {
    onProgress?.(
      coveredUntil
        ? `Transcrevendo a pregação… até ${coveredUntil}`
        : 'Transcrevendo a pregação…'
    );

    try {
      const step = await postWeeklyQuiz({
        action: 'transcribe',
        videoId: currentVideoId || undefined,
      });
      retries = 0;
      currentVideoId = step?.videoId || currentVideoId;
      coveredUntil = step?.coveredUntil || coveredUntil;

      if (step?.done) {
        break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('tempo limite') && retries < 1) {
        retries += 1;
        part -= 1;
        continue;
      }
      throw error;
    }

    if (part === 79) {
      throw new Error('A transcrição ainda não chegou ao fim da pregação. Toque de novo para continuar.');
    }
  }

  onProgress?.('Gerando as 15 perguntas…');
  const payload = await postWeeklyQuiz({ action: 'compose', videoId: currentVideoId }, 110_000);
  return parseWeeklyQuizAdminSnapshot(payload?.snapshot);
};

export const regenerateWeeklyQuizQuestions = async (videoId: string) => {
  const payload = await postWeeklyQuiz({ action: 'recompose', videoId });
  return parseWeeklyQuizAdminSnapshot(payload?.snapshot);
};
