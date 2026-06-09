import { isQuorumCheckInEvent } from '@/lib/checkInVisibility';
import {
  eventRequiresPreCheckinBeforeQr,
  fetchFamilyHasPreCheckin,
  fetchFamilyHasTotemCheckinConfirmed,
  type PreCheckinGateEvent,
} from '@/lib/familyPreCheckin';
import { useCallback, useEffect, useState } from 'react';

export function useFamilyPreCheckin(
  eventId: string | undefined,
  familyId: string | undefined,
  event: PreCheckinGateEvent | null | undefined
) {
  const gateRequired = eventRequiresPreCheckinBeforeQr(event);
  const quorumEvent = isQuorumCheckInEvent(event);
  const totemEvent = event?.totem_ativo === true;
  const [hasPreCheckin, setHasPreCheckin] = useState(!gateRequired);
  const [hasTotemCheckinConfirmed, setHasTotemCheckinConfirmed] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;

    if (!gateRequired) {
      setHasPreCheckin(true);
      setHasTotemCheckinConfirmed(false);
      setGateError(null);
      setLoading(false);
      return;
    }

    if (!eventId || !familyId) {
      setHasPreCheckin(false);
      setHasTotemCheckinConfirmed(false);
      setGateError(null);
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setGateError(null);

    try {
      const preCheckinResult = await fetchFamilyHasPreCheckin(eventId, familyId, event);
      setHasPreCheckin(preCheckinResult.hasPreCheckin);

      if (preCheckinResult.errorMessage) {
        setGateError(preCheckinResult.errorMessage);
        setHasTotemCheckinConfirmed(false);
        return;
      }

      if (quorumEvent || totemEvent) {
        const confirmedResult = await fetchFamilyHasTotemCheckinConfirmed(eventId, familyId);
        setHasTotemCheckinConfirmed(confirmedResult.isConfirmed);
        if (quorumEvent) {
          setGateError(confirmedResult.errorMessage);
        }
        return;
      }

      setHasTotemCheckinConfirmed(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível verificar o pré-check-in da família.';
      setGateError(message);
      setHasPreCheckin(false);
      setHasTotemCheckinConfirmed(false);
    } finally {
      setLoading(false);
    }
  }, [event, eventId, familyId, gateRequired, quorumEvent, totemEvent]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    hasPreCheckin,
    hasTotemCheckinConfirmed,
    gateRequired,
    gateError,
    loading,
    refetch,
  };
}
