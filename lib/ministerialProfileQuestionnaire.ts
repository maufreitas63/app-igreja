import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const MINISTERIAL_PROFILE_QUESTIONNAIRE_SQL_HINT =
  'Execute no Supabase: scripts/ministerial-profile-questionnaire.sql e scripts/ministerial-profile-questionnaire-seed.sql';

export const MINISTERIAL_PROFILE_SESSION_SQL_HINT =
  'Execute no Supabase: scripts/ministerial-profile-questionnaire-session-fix.sql. Depois: Settings → API → Reload schema.';

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

export type MinisterialProfileResultCopy = {
  heading: string;
  body: string;
};

export const MINISTERIAL_PROFILE_RESULT_COPY: Record<MinisterialProfileCode, MinisterialProfileResultCopy> = {
  PREGACAO: {
    heading: 'Perfil PREGAÇÃO (A Voz da Verdade)',
    body:
      'Minha convicção é de que o mundo não precisa de novas ideias, mas da Palavra eterna. Sinto um ardor sagrado quando abro as Escrituras, pois entendo que a pregação não é sobre a minha eloquência, mas sobre a autoridade de Deus. Meu ministério é ser um canal onde o texto bíblico é exposto de forma clara e profunda, para que a igreja seja ancorada na sã doutrina e protegida contra os ventos das heresias.',
  },
  DISCIPULADO: {
    heading: 'Perfil DISCIPULADO (O Construtor de Vidas)',
    body:
      'Acredito que o evangelho é vivido na estrada, caminhando ao lado de outros. Meu chamado não se encerra no púlpito; ele se manifesta na mesa de café, no estudo bíblico em casa e no acompanhamento paciente de alguém que busca crescer. Enxergo cada membro da igreja como uma semente que precisa ser regada pela Palavra, até que Cristo seja formado neles. Meu ministério é a multiplicação de vidas que refletem a verdade.',
  },
  PASTORAL: {
    heading: 'Perfil PASTORAL (O Coração da Misericórdia)',
    body:
      'Aprendi que a teologia mais bonita é aquela que se traduz em consolo no dia da dor. Sinto o chamado para ser a presença tangível de Cristo para quem sofre, chora ou se sente invisível. Onde a maioria vê problemas, vejo pessoas precisando de acolhimento e escuta. Meu ministério é cuidar, curar feridas e garantir que nenhum membro do corpo caminhe sozinho em suas crises, pois o amor de Deus deve ser sentido na prática.',
  },
  EVANGELISMO: {
    heading: 'Perfil EVANGELISMO (O Arauto da Esperança)',
    body:
      'Não consigo silenciar sobre o que vi e ouvi. Meu coração bate no compasso da Grande Comissão; sou impulsionado pela urgência de alcançar aqueles que ainda não experimentaram a graça transformadora. Meu ministério é transpor muros, atravessar fronteiras e falar com ousadia para que o perdido encontre o Caminho. Vivo para ver o momento em que a luz do evangelho rompe a escuridão do coração daqueles que não conhecem Jesus.',
  },
  LIDERANCA: {
    heading: 'Perfil LIDERANÇA (O Guardião da Ordem)',
    body:
      'Entendo que a igreja é um corpo glorioso que precisa de organização para que a missão flua com excelência. Meu chamado é coordenar os talentos, mediar conflitos, estruturar ministérios e garantir que a autonomia da congregação seja usada para a glória de Deus e não para o caos. Meu ministério é servir através da visão estratégica, preparando o caminho para que cada membro possa servir com propósito, unidade e ordem.',
  },
  LOUVOR: {
    heading: 'Perfil LOUVOR (O Condutor da Adoração)',
    body:
      'A música que entoamos é a liturgia do coração; por isso, zelo para que nosso louvor seja bíblico, reverente e profundamente conectado à verdade. Meu chamado é conduzir a congregação a uma experiência autêntica com a majestade de Deus, transformando cada cântico em uma oportunidade de ensino e entrega. Meu ministério é criar um ambiente onde a beleza da santidade seja sentida, levando a igreja a adorar em espírito e em verdade.',
  },
};

const isMinisterialProfileCode = (value: string): value is MinisterialProfileCode =>
  value in MINISTERIAL_PROFILE_RESULT_COPY;

export const resolveMinisterialProfileResultCopy = (
  perfilCode?: string | null,
  perfilLabel?: string | null
): MinisterialProfileResultCopy | null => {
  const code = String(perfilCode ?? '').trim().toUpperCase();

  if (code && isMinisterialProfileCode(code)) {
    return MINISTERIAL_PROFILE_RESULT_COPY[code];
  }

  const label = String(perfilLabel ?? '').trim().toLowerCase();

  const match = (Object.entries(MINISTERIAL_PROFILE_LABELS) as [MinisterialProfileCode, string][]).find(
    ([, profileLabel]) => profileLabel.toLowerCase() === label
  );

  if (match) {
    return MINISTERIAL_PROFILE_RESULT_COPY[match[0]];
  }

  return null;
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

const isMinisterialSessionSetupError = (message: string) => {
  const normalized = message.toLowerCase();

  return (
    (normalized.includes('assert_session_profile_matches')
      || normalized.includes('ministerial_require_session_profile'))
    && (normalized.includes('does not exist') || normalized.includes('could not find'))
  );
};

const formatRpcError = (error: unknown, rpcName: string) => {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Não foi possível concluir a operação.';

  if (isMinisterialSessionSetupError(message)) {
    return MINISTERIAL_PROFILE_SESSION_SQL_HINT;
  }

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
