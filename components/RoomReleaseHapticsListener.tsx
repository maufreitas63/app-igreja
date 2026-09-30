import { triggerOrchestrationHapticFeedback } from '@/lib/eventOrchestrationHaptics';
import { getEffectiveUserPhone } from '@/lib/loadSessionProfile';
import { supabase } from '@/lib/supabase';
import { getStoredTenantId } from '@/lib/tenantSession';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

const normalizePhoneDigits = (value: string | null | undefined) =>
  (value ?? '').replace(/\D/g, '');

/**
 * Escuta sinais de finalização de sala e vibra (duplo/curto) quando o celular
 * efetivo do usuário está na lista notificada.
 */
export function RoomReleaseHapticsListener() {
  const lastSignalIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const maybeVibrateForSignal = async (record: Record<string, unknown>) => {
      const signalId = typeof record.id === 'string' ? record.id : null;
      if (!signalId || signalId === lastSignalIdRef.current) {
        return;
      }

      const rowTenant = typeof record.tenant_id === 'string' ? record.tenant_id.trim() : '';
      if (rowTenant) {
        const activeTenant = await getStoredTenantId();
        if (activeTenant && rowTenant !== activeTenant) {
          return;
        }
      }

      const phonesRaw = record.phones;
      const phones = Array.isArray(phonesRaw)
        ? phonesRaw.map((phone) => normalizePhoneDigits(String(phone ?? '')))
        : [];
      const effectivePhone = normalizePhoneDigits(await getEffectiveUserPhone());

      if (!effectivePhone || effectivePhone.length < 10) {
        return;
      }

      const matched = phones.some((phone) => {
        if (!phone || phone.length < 10) {
          return false;
        }
        return phone === effectivePhone || phone.endsWith(effectivePhone) || effectivePhone.endsWith(phone);
      });

      if (!matched || cancelled) {
        return;
      }

      lastSignalIdRef.current = signalId;
      await triggerOrchestrationHapticFeedback({ fromUserGesture: false });
      // segundo toque curto (vibração dupla)
      setTimeout(() => {
        void triggerOrchestrationHapticFeedback({ fromUserGesture: false });
      }, 220);
    };

    const channel = supabase
      .channel(`room-release-haptics-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_release_signals',
        },
        (payload) => {
          void maybeVibrateForSignal((payload.new ?? {}) as Record<string, unknown>);
        }
      )
      .subscribe();

    const appStateSubscription = AppState.addEventListener('change', () => undefined);

    return () => {
      cancelled = true;
      appStateSubscription.remove();
      void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
