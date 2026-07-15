export const PTT_OPEN_CONVERSATION_EVENT = 'ptt-open-conversation';

export type PttOpenConversationDetail = {
  conversationId: string;
};

/** Abre o painel de diálogo PTT (ouvido pelo PttInboxListener). */
export function requestOpenPttConversation(conversationId: string) {
  const id = conversationId?.trim();
  if (!id || typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<PttOpenConversationDetail>(PTT_OPEN_CONVERSATION_EVENT, {
      detail: { conversationId: id },
    })
  );
}
