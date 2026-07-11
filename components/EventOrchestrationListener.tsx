import { fetchEventControlState } from '@/lib/eventOrchestrationApi';
import { registerOrchestrationUserGestureListeners } from '@/lib/eventOrchestrationHaptics';
import {
  buildEventOrchestrationPathSignature,
  resolveEventOrchestrationTarget,
} from '@/lib/eventOrchestrationRoutes';
import { isEventOrchestrationPanelFocused } from '@/lib/eventOrchestrationPanelFocus';
import { hasStoredMemberSession } from '@/lib/memberSession';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

const ORCHESTRATION_POLL_MS = 3_000;

export const shouldListenForEventOrchestration = (
  _pathname: string,
  segments: string[],
  _searchParams?: Record<string, string | string[] | undefined>
) => {
  if (segments[0] === 'admin') {
    return false;
  }

  // Orquestração só atua no índice/dashboard — não interrompe telas filhas (perfil, pastoral, etc.).
  return segments[0] === '(tabs)';
};

export function EventOrchestrationListener() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const searchParams = useLocalSearchParams();

  const [hasMemberSession, setHasMemberSession] = useState<boolean | null>(null);

  const lastProcessedUpdatedAtRef = useRef<string | null>(null);
  const manualNavigationRef = useRef(false);
  const appliedPathSignatureRef = useRef<string | null>(null);
  const transitionInProgressRef = useRef(false);
  const pollInFlightRef = useRef(false);

  const pathnameRef = useRef(pathname);
  const segmentsRef = useRef(segments);
  const searchParamsRef = useRef(searchParams);

  pathnameRef.current = pathname;
  segmentsRef.current = segments;
  searchParamsRef.current = searchParams;

  const shouldListen =
    hasMemberSession === true
    && shouldListenForEventOrchestration(
      pathname,
      segments,
      searchParams as Record<string, string | string[] | undefined>
    )
    && !isEventOrchestrationPanelFocused();

  const shouldListenRef = useRef(shouldListen);
  shouldListenRef.current = shouldListen;

  const currentPathSignature = buildEventOrchestrationPathSignature(
    pathname,
    searchParams as Record<string, string | string[] | undefined>,
    segments
  );

  const currentPathSignatureRef = useRef(currentPathSignature);
  currentPathSignatureRef.current = currentPathSignature;

  useEffect(() => {
    return registerOrchestrationUserGestureListeners();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveSession = async () => {
      const hasSession = await hasStoredMemberSession();
      if (!cancelled) {
        setHasMemberSession(hasSession);
      }
    };

    void resolveSession();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (transitionInProgressRef.current || !appliedPathSignatureRef.current) {
      return;
    }

    if (currentPathSignature !== appliedPathSignatureRef.current) {
      manualNavigationRef.current = true;
    }
  }, [currentPathSignature]);

  const runSilentNavigation = useCallback(
    (activeRoute: string, updatedAt: string) => {
      if (!shouldListenRef.current || isEventOrchestrationPanelFocused()) {
        return;
      }

      if (transitionInProgressRef.current) {
        return;
      }

      const target = resolveEventOrchestrationTarget(activeRoute);

      if (!target) {
        return;
      }

      if (lastProcessedUpdatedAtRef.current === updatedAt) {
        return;
      }

      if (manualNavigationRef.current) {
        if (lastProcessedUpdatedAtRef.current && lastProcessedUpdatedAtRef.current !== updatedAt) {
          manualNavigationRef.current = false;
        } else {
          return;
        }
      }

      const pathSignature = buildEventOrchestrationPathSignature(
        pathnameRef.current,
        searchParamsRef.current as Record<string, string | string[] | undefined>,
        segmentsRef.current
      );

      if (pathSignature === target.pathSignature) {
        lastProcessedUpdatedAtRef.current = updatedAt;
        appliedPathSignatureRef.current = target.pathSignature;
        return;
      }

      transitionInProgressRef.current = true;
      lastProcessedUpdatedAtRef.current = updatedAt;

      if (target.pathSignature === '/(tabs)') {
        router.replace(target.href);
      } else {
        router.push(target.href);
      }

      appliedPathSignatureRef.current = target.pathSignature;
      manualNavigationRef.current = false;
      transitionInProgressRef.current = false;
    },
    [router]
  );

  const runSilentNavigationRef = useRef(runSilentNavigation);
  runSilentNavigationRef.current = runSilentNavigation;

  const dispatchOrchestrationSignal = useCallback((activeRoute: string, updatedAt: string) => {
    if (!activeRoute || !updatedAt || isEventOrchestrationPanelFocused()) {
      return;
    }

    runSilentNavigationRef.current(activeRoute, updatedAt);
  }, []);

  const syncEventControlFromServer = useCallback(async () => {
    if (!shouldListenRef.current || pollInFlightRef.current) {
      return;
    }

    pollInFlightRef.current = true;

    try {
      const state = await fetchEventControlState();

      if (!state) {
        return;
      }

      dispatchOrchestrationSignal(state.activeRoute, state.updatedAt);
    } catch {
      // polling silencioso — Realtime continua como canal principal
    } finally {
      pollInFlightRef.current = false;
    }
  }, [dispatchOrchestrationSignal]);

  useEffect(() => {
    if (hasMemberSession !== true) {
      return undefined;
    }

    const channelName = `event-control-orchestration-${Math.random().toString(36).slice(2, 10)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_control',
        },
        (payload) => {
          void (async () => {
            const record = (payload.new ?? {}) as Record<string, unknown>;
            const rowTenant =
              typeof record.tenant_id === 'string' ? record.tenant_id.trim() : '';
            if (rowTenant) {
              const { getStoredTenantId } = await import('@/lib/tenantSession');
              const activeTenant = await getStoredTenantId();
              if (activeTenant && rowTenant !== activeTenant) {
                return;
              }
            }

            dispatchOrchestrationSignal(
              String(record.active_route ?? '').trim(),
              String(record.updated_at ?? '').trim()
            );
          })();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void syncEventControlFromServer();
        }
      });

    void syncEventControlFromServer();

    const pollTimer = setInterval(() => {
      void syncEventControlFromServer();
    }, ORCHESTRATION_POLL_MS);

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncEventControlFromServer();
      }
    });

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void syncEventControlFromServer();
      }
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(pollTimer);
      appStateSubscription.remove();

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }

      void supabase.removeChannel(channel);
    };
  }, [dispatchOrchestrationSignal, hasMemberSession, syncEventControlFromServer]);

  return null;
}
