/**
 * Regra de negócio: consultas à tabela `members` consideram apenas membros
 * reconhecidos (`accepted = true`), exceto em Gerenciar Família (manage-members),
 * onde todos os registros são listados para aprovação.
 */
export const MEMBER_ACCEPTED_VALUE = true;

/** Use em cadeias Supabase: `.eq('accepted', MEMBER_ACCEPTED_VALUE)` */
export const isMemberAccepted = (accepted: boolean | null | undefined) => accepted === true;
