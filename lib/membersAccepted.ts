/**
 * Regra de negócio: consultas gerais à tabela `members` consideram apenas membros
 * reconhecidos (`accepted = true`), exceto:
 * - Gerenciar Família (manage-members): todos os registros para aprovação;
 * - Audiência do evento: integrantes da família com `accepted` true ou null (pendente).
 */
export const MEMBER_ACCEPTED_VALUE = true;

/** Integrante visível na audiência do evento (não foi rejeitado pela família). */
export const isFamilyAudienceMember = (accepted: boolean | null | undefined) => accepted !== false;
