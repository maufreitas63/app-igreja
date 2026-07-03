import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const MINISTERIAL_PROFILE_QUESTIONNAIRE_SQL_HINT =
  'Execute no Supabase: scripts/ministerial-profile-questionnaire.sql e scripts/ministerial-profile-questionnaire-seed.sql';

export const MINISTERIAL_QUESTIONS_TOTAL = 50;
export const MINISTERIAL_QUESTIONS_PER_STEP = 5;
export const MINISTERIAL_TOTAL_STEPS = MINISTERIAL_QUESTIONS_TOTAL / MINISTERIAL_QUESTIONS_PER_STEP;

export type MinisterialProfileCode =
  | 'PREGACAO'
  | 'LOUVOR'
  | 'PASTORAL'
  | 'EVANGELISMO'
  | 'DISCIPULADO'
  | 'LIDERANCA';

export const MINISTERIAL_PROFILE_LABELS: Record<MinisterialProfileCode, string> = {
  PREGACAO: 'Pregação',
  LOUVOR: 'Louvor',
  PASTORAL: 'Pastoral',
  EVANGELISMO: 'Evangelismo',
  DISCIPULADO: 'Discipulado',
  LIDERANCA: 'Liderança',
};

export type MinisterialQuestionOption = {
  id: string;
  texto: string;
  ordem: number;
};

export type MinisterialQuestion = {
  id: string;
  texto: string;
  bloco_tema: string;
  ordem: number;
  opcoes: MinisterialQuestionOption[];
};

const parseRpcObject = (data: unknown): Record<string, unknown> | null => {
  let payload: unknown = data;

  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  return payload as Record<string, unknown>;
};

const formatRpcError = (error: unknown, rpcName: string) => {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Não foi possível concluir a operação.';

  if (isSupabaseRpcMissingError({ message }, rpcName)) {
    return MINISTERIAL_PROFILE_QUESTIONNAIRE_SQL_HINT;
  }

  return message;
};

const parseQuestions = (payload: Record<string, unknown> | null): MinisterialQuestion[] => {
  const raw = payload?.perguntas;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const question = entry as Record<string, unknown>;
      const opcoesRaw = question.opcoes;

      const opcoes = Array.isArray(opcoesRaw)
        ? opcoesRaw
            .map((option) => {
              if (!option || typeof option !== 'object') {
                return null;
              }

              const row = option as Record<string, unknown>;
              const id = typeof row.id === 'string' ? row.id.trim() : '';
              const texto = typeof row.texto === 'string' ? row.texto.trim() : '';

              if (!id || !texto) {
                return null;
              }

              return {
                id,
                texto,
                ordem: typeof row.ordem === 'number' ? row.ordem : 0,
              } satisfies MinisterialQuestionOption;
            })
            .filter((option): option is MinisterialQuestionOption => option !== null)
            .sort((left, right) => left.ordem - right.ordem)
        : [];

      const id = typeof question.id === 'string' ? question.id.trim() : '';
      const texto = typeof question.texto === 'string' ? question.texto.trim() : '';

      if (!id || !texto) {
        return null;
      }

      return {
        id,
        texto,
        bloco_tema: typeof question.bloco_tema === 'string' ? question.bloco_tema.trim() : '',
        ordem: typeof question.ordem === 'number' ? question.ordem : 0,
        opcoes,
      } satisfies MinisterialQuestion;
    })
    .filter((question): question is MinisterialQuestion => question !== null)
    .sort((left, right) => left.ordem - right.ordem);
};

export async function fetchMinisterialQuestionnaire(): Promise<
  | { success: true; questions: MinisterialQuestion[] }
  | { success: false; message: string }
> {
  const { data, error } = await supabase.rpc('listar_questionario_ministerial');

  if (error) {
    return { success: false, message: formatRpcError(error, 'listar_questionario_ministerial') };
  }

  const payload = parseRpcObject(data);

  if (!payload?.success) {
    return { success: false, message: 'Não foi possível carregar o questionário.' };
  }

  const questions = parseQuestions(payload);

  if (!questions.length) {
    return {
      success: false,
      message: `${MINISTERIAL_PROFILE_QUESTIONNAIRE_SQL_HINT} (seed das perguntas).`,
    };
  }

  return { success: true, questions };
}

export type MinisterialProfileResult = {
  perfil_vencedor: MinisterialProfileCode;
  perfil_label: string;
  completed_at?: string;
};

export async function fetchMinisterialProfileResult(
  profileId: string
): Promise<
  | { success: true; hasResult: false }
  | { success: true; hasResult: true; result: MinisterialProfileResult }
  | { success: false; message: string }
> {
  const { data, error } = await supabase.rpc('obter_resultado_questionario_ministerial', {
    p_profile_id: profileId,
  });

  if (error) {
    return {
      success: false,
      message: formatRpcError(error, 'obter_resultado_questionario_ministerial'),
    };
  }

  const payload = parseRpcObject(data);

  if (!payload?.success) {
    return { success: false, message: 'Não foi possível consultar o resultado.' };
  }

  if (!payload.has_result) {
    return { success: true, hasResult: false };
  }

  const code = typeof payload.perfil_vencedor === 'string' ? payload.perfil_vencedor.trim() : '';
  const label =
    typeof payload.perfil_label === 'string' && payload.perfil_label.trim()
      ? payload.perfil_label.trim()
      : MINISTERIAL_PROFILE_LABELS[code as MinisterialProfileCode] ?? code;

  if (!code) {
    return { success: false, message: 'Resultado inválido.' };
  }

  return {
    success: true,
    hasResult: true,
    result: {
      perfil_vencedor: code as MinisterialProfileCode,
      perfil_label: label,
      completed_at:
        typeof payload.completed_at === 'string' ? payload.completed_at : undefined,
    },
  };
}

export type MinisterialAnswerInput = {
  pergunta_id: string;
  opcao_id: string;
};

export async function submitMinisterialQuestionnaire(
  profileId: string,
  answers: MinisterialAnswerInput[]
): Promise<
  | { success: true; perfil_label: string; perfil_vencedor: MinisterialProfileCode }
  | { success: false; message: string }
> {
  const { data, error } = await supabase.rpc('submeter_questionario_ministerial', {
    p_profile_id: profileId,
    p_respostas: answers,
  });

  if (error) {
    return { success: false, message: formatRpcError(error, 'submeter_questionario_ministerial') };
  }

  const payload = parseRpcObject(data);

  if (!payload?.success) {
    return {
      success: false,
      message:
        typeof payload?.message === 'string'
          ? payload.message
          : 'Não foi possível enviar o questionário.',
    };
  }

  const code = typeof payload.perfil_vencedor === 'string' ? payload.perfil_vencedor.trim() : '';
  const label =
    typeof payload.perfil_label === 'string' && payload.perfil_label.trim()
      ? payload.perfil_label.trim()
      : MINISTERIAL_PROFILE_LABELS[code as MinisterialProfileCode] ?? code;

  if (!code || !label) {
    return { success: false, message: 'Resposta do servidor incompleta.' };
  }

  return {
    success: true,
    perfil_vencedor: code as MinisterialProfileCode,
    perfil_label: label,
  };
}

export function getMinisterialStepQuestions(
  questions: MinisterialQuestion[],
  stepIndex: number
): MinisterialQuestion[] {
  const start = stepIndex * MINISTERIAL_QUESTIONS_PER_STEP;
  return questions.slice(start, start + MINISTERIAL_QUESTIONS_PER_STEP);
}

export function computeMinisterialProgress(
  answeredCount: number,
  total: number = MINISTERIAL_QUESTIONS_TOTAL
) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((answeredCount / total) * 100));
}
