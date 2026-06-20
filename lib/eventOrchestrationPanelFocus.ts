/** Orquestrador com o card event_orchestration em foco — não recebe redirect automático. */
let orchestrationPanelFocused = false;

export function setEventOrchestrationPanelFocused(focused: boolean) {
  orchestrationPanelFocused = focused;
}

export function isEventOrchestrationPanelFocused() {
  return orchestrationPanelFocused;
}
