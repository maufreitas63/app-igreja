import { getEventCalendarDate, getTodayCalendarDateInAppTimezone } from '@/lib/eventDate';

/** Normaliza valor de parâmetro (minúsculas, sem acentos). */
export const normalizeAppParameterValue = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const isAppParameterNo = (value: string | null | undefined) =>
  normalizeAppParameterValue(value) === 'nao';

export const APP_PARAMETER = {
  QR_CODE_ATIVO: 'QRCode_Ativo',
  CHECK_IN_AUTOMATICO: 'check_In_Automatico',
} as const;

export type CheckInVisibilityEvent = {
  event_date: string | null | undefined;
  totem_ativo?: boolean | null;
  requer_quorum?: boolean | null;
};

export const isQuorumCheckInEvent = (event: CheckInVisibilityEvent | null | undefined) =>
  event?.requer_quorum === true;

/** Quórum: QR/atalho totem entre cadastro na audiência e check-in confirmado no totem. */
export const resolveQuorumQrTotemFlowVisible = (options: {
  hasFamilyPreCheckin?: boolean;
  hasFamilyTotemCheckin?: boolean;
}) =>
  options.hasFamilyPreCheckin === true && options.hasFamilyTotemCheckin !== true;

/** Evento ocorre no dia de hoje (calendário America/Sao_Paulo). */
export const isEventCalendarToday = (eventDate: string | null | undefined) => {
  const eventDay = getEventCalendarDate(eventDate);
  if (!eventDay) {
    return false;
  }

  return eventDay === getTodayCalendarDateInAppTimezone();
};

/**
 * Evento exige check-in via QR no app:
 * - Totem ativo: confirmação no leitor QR.
 * - Sem totem: somente se check-in manual global (check_In_Automatico = nao) e QRCode_Ativo ligado.
 */
export const eventRequiresQrCheckIn = (options: {
  totemAtivo: boolean;
  qrCodeAtivoEnabled: boolean;
  checkInManualMode: boolean;
  requerQuorum?: boolean;
}) => {
  if (options.requerQuorum) {
    return true;
  }

  if (options.totemAtivo) {
    return true;
  }

  return options.checkInManualMode && options.qrCodeAtivoEnabled;
};

/** Check-in automático: audiência no card Agenda já registra presença (sem card QR). */
export const eventUsesAutomaticAudienceCheckIn = (options: {
  totemAtivo: boolean;
  qrCodeAtivoEnabled: boolean;
  checkInManualMode: boolean;
}) => !eventRequiresQrCheckIn(options);

/**
 * Card QR no dashboard: somente no dia do evento selecionado e quando o fluxo exige QR.
 */
export const resolveQrCheckInCardVisible = (options: {
  event: CheckInVisibilityEvent | null | undefined;
  qrCodeAtivoEnabled: boolean;
  checkInManualMode: boolean;
  /** Totem: só libera o card após marcar a audiência (pré-check-in). */
  hasFamilyPreCheckin?: boolean;
  /** Quórum: check-in confirmado no totem — oculta card QR. */
  hasFamilyTotemCheckin?: boolean;
}) => {
  if (!options.event?.event_date?.trim()) {
    return false;
  }

  if (!isEventCalendarToday(options.event.event_date)) {
    return false;
  }

  const requiresQr = eventRequiresQrCheckIn({
    totemAtivo: options.event.totem_ativo === true,
    qrCodeAtivoEnabled: options.qrCodeAtivoEnabled,
    checkInManualMode: options.checkInManualMode,
    requerQuorum: isQuorumCheckInEvent(options.event),
  });

  if (isQuorumCheckInEvent(options.event)) {
    return resolveQuorumQrTotemFlowVisible(options);
  }

  if (!requiresQr) {
    return false;
  }

  const requiresPreCheckin =
    options.event.totem_ativo === true || options.event.requer_quorum === true;

  if (requiresPreCheckin && options.hasFamilyPreCheckin !== true) {
    return false;
  }

  return true;
};

/**
 * Atalho «QR Code — Check-in Totem» no índice: quórum = após audiência e antes do totem;
 * demais eventos = após pré-check-in (regra padrão do card QR).
 */
export const resolveQrTotemIndexShortcutVisible = (options: {
  event: CheckInVisibilityEvent | null | undefined;
  qrCodeAtivoEnabled: boolean;
  checkInManualMode: boolean;
  hasFamilyPreCheckin?: boolean;
  hasFamilyTotemCheckin?: boolean;
}) => {
  if (!options.event?.event_date?.trim()) {
    return false;
  }

  if (!isEventCalendarToday(options.event.event_date)) {
    return false;
  }

  if (isQuorumCheckInEvent(options.event)) {
    return resolveQuorumQrTotemFlowVisible(options);
  }

  return resolveQrCheckInCardVisible(options);
};

/** @deprecated Use resolveQrCheckInCardVisible com data do evento. */
export const resolveCheckInCardVisible = (options: {
  totemAtivo: boolean;
  qrCodeAtivoEnabled: boolean;
  checkInManualMode: boolean;
  eventDate?: string | null;
}) => {
  if (options.eventDate !== undefined && !isEventCalendarToday(options.eventDate)) {
    return false;
  }

  return eventRequiresQrCheckIn({
    totemAtivo: options.totemAtivo,
    qrCodeAtivoEnabled: options.qrCodeAtivoEnabled,
    checkInManualMode: options.checkInManualMode,
  });
};

/** @deprecated Use resolveQrCheckInCardVisible no evento selecionado. */
export const resolveTotemQrCardVisible = (options: {
  hasAvailableEvents: boolean;
  hasTotemEvent: boolean;
  event?: CheckInVisibilityEvent | null;
  qrCodeAtivoEnabled?: boolean;
  checkInManualMode?: boolean;
}) => {
  if (!options.hasAvailableEvents) {
    return false;
  }

  if (
    options.event &&
    options.qrCodeAtivoEnabled !== undefined &&
    options.checkInManualMode !== undefined
  ) {
    return resolveQrCheckInCardVisible({
      event: options.event,
      qrCodeAtivoEnabled: options.qrCodeAtivoEnabled,
      checkInManualMode: options.checkInManualMode,
    });
  }

  return options.hasTotemEvent;
};

export const hasActiveTotemEvent = (
  events: ReadonlyArray<{ totem_ativo?: boolean | null }>
) => events.some((event) => event.totem_ativo === true);
