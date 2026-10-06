/**
 * Evento com sala ativa: a inscrição de quem pertence a uma sala fica na sala.
 * Atribuição explícita só vale se essa sala está habilitada no evento.
 * Faixa Infantil/Jovens vale quando o evento abriu qualquer sala.
 */
export function resolveEventInscriptionRoomLabel(input: {
  enabledRoomKeys?: readonly string[] | null;
  assignedRoomKey?: string | null;
  assignedRoomLabel?: string | null;
  ageStatus?: 'KIDS' | 'TEENS' | null;
  kidsLabel: string;
  teensLabel: string;
}): string | null {
  const enabled = new Set(
    (input.enabledRoomKeys ?? [])
      .map((key) => key.trim().toUpperCase())
      .filter(Boolean)
  );

  if (!enabled.size) {
    return null;
  }

  const assignedKey = input.assignedRoomKey?.trim().toUpperCase() ?? '';
  const assignedLabel = input.assignedRoomLabel?.trim() ?? '';

  if (assignedKey && assignedLabel && enabled.has(assignedKey)) {
    return assignedLabel;
  }

  if (input.ageStatus === 'KIDS') {
    return input.kidsLabel.trim() || 'Infantil';
  }

  if (input.ageStatus === 'TEENS') {
    return input.teensLabel.trim() || 'Jovens';
  }

  return null;
}
