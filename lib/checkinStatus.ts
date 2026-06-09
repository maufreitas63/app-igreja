/** Estados do check-in vinculado à inscrição na audiência do evento. */
export const CHECKIN_STATUS = {
  PRE_CHECKIN: 'pre_checkin',
  CONFIRMADO: 'confirmado',
} as const;

export type CheckinStatus = (typeof CHECKIN_STATUS)[keyof typeof CHECKIN_STATUS];

/** Mensagem exibida no totem quando o check-in já foi confirmado. */
export const TOTEM_CHECKIN_ALREADY_CONFIRMED_MESSAGE = 'Check-in já confirmado';

export type TotemCheckinLookupCode =
  | 'EVENT_NOT_FOUND'
  | 'TOTEM_INACTIVE'
  | 'ALREADY_CONFIRMED'
  | 'PROCESSING'
  | 'NOT_FOUND'
  | 'CONFIRMED';

export type TotemCheckinLookupResult = {
  success: boolean;
  code?: TotemCheckinLookupCode;
  message?: string;
  pre_checkin_count?: number;
  confirmed_count?: number;
  can_confirm?: boolean;
  already_confirmed?: boolean;
  updated_count?: number;
};
