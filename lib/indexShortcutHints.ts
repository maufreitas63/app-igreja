import {
  eventRequiresQrCheckIn,
  isEventCalendarToday,
  isQuorumCheckInEvent,
  type CheckInVisibilityEvent,
} from '@/lib/checkInVisibility';

export type IndexShortcutHintContext = {
  selectedEvent: CheckInVisibilityEvent | null | undefined;
  hasAvailableEvents: boolean;
  qrCodeAtivoEnabled: boolean;
  checkInManualMode: boolean;
  hasPreCheckin: boolean;
  hasTotemCheckinConfirmed: boolean;
};

export const resolveIndexShortcutDisabledHint = (
  shortcutId: string,
  context: IndexShortcutHintContext
): string | null => {
  if (shortcutId === 'salas' && !context.hasAvailableEvents) {
    return 'Sem eventos ativos no momento';
  }

  if (shortcutId !== 'qr-totem') {
    return null;
  }

  const event = context.selectedEvent;

  if (!event?.event_date?.trim()) {
    return 'Disponível quando houver evento no painel';
  }

  if (!isEventCalendarToday(event.event_date)) {
    return 'Disponível apenas no dia do evento';
  }

  if (isQuorumCheckInEvent(event)) {
    if (!context.hasPreCheckin) {
      return 'Marque a audiência da família antes';
    }

    if (context.hasTotemCheckinConfirmed) {
      return 'Check-in no totem já confirmado';
    }

    return null;
  }

  const requiresQr = eventRequiresQrCheckIn({
    totemAtivo: event.totem_ativo === true,
    qrCodeAtivoEnabled: context.qrCodeAtivoEnabled,
    checkInManualMode: context.checkInManualMode,
    requerQuorum: false,
  });

  if (!requiresQr) {
    return 'Check-in automático — QR não necessário hoje';
  }

  const requiresPreCheckin = event.totem_ativo === true || event.requer_quorum === true;

  if (requiresPreCheckin && !context.hasPreCheckin) {
    return 'Marque a audiência da família antes';
  }

  return null;
};

export type IndexShortcutId =
  | 'agenda'
  | 'salas'
  | 'qr-totem'
  | 'ofertas'
  | 'pastoral'
  | 'membros'
  | 'aniversariantes'
  | 'financeiro'
  | 'escalas'
  | 'menu';

export type IndexShortcutIconName =
  | 'calendar'
  | 'building'
  | 'qrcode'
  | 'money'
  | 'heart'
  | 'users'
  | 'birthday-cake'
  | 'line-chart'
  | 'clipboard'
  | 'id-card';

export const INDEX_SHORTCUT_ICONS: Record<IndexShortcutId, IndexShortcutIconName> = {
  agenda: 'calendar',
  salas: 'building',
  'qr-totem': 'qrcode',
  ofertas: 'money',
  pastoral: 'heart',
  membros: 'users',
  aniversariantes: 'birthday-cake',
  financeiro: 'line-chart',
  escalas: 'clipboard',
  menu: 'id-card',
};

/** Cor do ícone alinhada ao tema de cada card do dashboard. */
export const INDEX_SHORTCUT_ICON_COLORS: Record<IndexShortcutId, string> = {
  agenda: '#6EE7B7',
  salas: '#67E8F9',
  'qr-totem': '#34D399',
  ofertas: '#FBBF24',
  pastoral: '#F472B6',
  membros: '#FB7185',
  aniversariantes: '#FACC15',
  financeiro: '#34D399',
  escalas: '#818CF8',
  menu: '#A78BFA',
};

export const INDEX_SHORTCUT_ICON_DISABLED_COLOR = '#64748B';

export const resolveIndexShortcutIconColor = (shortcutId: string, disabled = false) => {
  if (disabled) {
    return INDEX_SHORTCUT_ICON_DISABLED_COLOR;
  }

  return INDEX_SHORTCUT_ICON_COLORS[shortcutId as IndexShortcutId] ?? '#6EE7B7';
};
