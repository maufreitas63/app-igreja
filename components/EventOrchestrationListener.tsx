import { EventOrchestrationGuidanceOverlay } from '@/components/EventOrchestrationGuidanceOverlay';
import { showAppToast } from '@/lib/appToast';
import { fetchEventControlState } from '@/lib/eventOrchestrationApi';
import {
  registerOrchestrationUserGestureListeners,
  triggerOrchestrationHapticFeedback,
} from '@/lib/eventOrchestrationHaptics';
import {
  buildEventOrchestrationPathSignature,
  resolveEventOrchestrationTarget,
} from '@/lib/eventOrchestrationRoutes';
import { supabase } from '@/lib/supabase';
import { getStoredUserPhone } from '@/lib/userSession';
import { useLocalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, StyleSheet } from 'react-native';

const GUIDANCE_DELAY_MS = 1500;
const SCREEN_FADE_MS = 320;
const ORCHESTRATION_POLL_MS = 3_000;

/** Telas públicas — sem escuta de orquestração. */
const ORCHESTRATION_PUBLIC_PATHS = new Set([
  '/',
  '/index',
  '/register',
  '/totem-checkin',
  '/sessao-encerrada',
]);

const normalizePathname = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

export const shouldListenForEventOrchestration = (pathname: string, segments: string[]) => {
  if (segments[0] === 'admin') {
    return false;
  }

  if (segments[0] === '(tabs)') {
    return true;
  }

  const normalized = normalizePathname(pathname);

  if (ORCHESTRATION_PUBLIC_PATHS.has(normalized)) {
    return false;
  }

  return normalized !== '/admin/orquestrador';
};

export function EventOrchestrationListener() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const searchParams = useLocalSearchParams();
  const screenOpacity = useRef(new Animated.Value(0)).current;

  const [guidanceVisible, setGuidanceVisible] = useState(false);
  const [guidanceMessage, setGuidanceMessage] = useState('');
  const [scrimVisible, setScrimVisible] = useState(false);
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
    && shouldListenForEventOrchestration(pathname, segments);

  const shouldListenRef = useRef(shouldListen);
  shouldListenRef.current = shouldListen;

  const currentPathSignature = buildEventOrchestrationPathSignature(
    pathname,
    searchParams as Record<string, string | string[] | undefined>
  );

  const currentPathSignatureRef = useRef(currentPathSignature);
  currentPathSignatureRef.current = currentPathSignature;

  useEffect(() => {
    return registerOrchestrationUserGestureListeners();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveSession = async () => {
      const phone = await getStoredUserPhone();
      if (!cancelled) {
        setHasMemberSession(Boolean(phone?.trim()));
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

  const fadeScreen = useCallback(
    (toValue: number) =>
      new Promise<void>((resolve) => {
        if (toValue > 0) {
          setScrimVisible(true);
        }

        Animated.timing(screenOpacity, {
          toValue,
          duration: SCREEN_FADE_MS,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (toValue === 0) {
            setScrimVisible(false);
          }

          if (finished) {
            resolve();
          }
        });
      }),
    [screenOpacity]
  );

  const runGuidedNavigation = useCallback(
    async (activeRoute: string, updatedAt: string) => {
      if (!shouldListenRef.current) {
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
        searchParamsRef.current as Record<string, string | string[] | undefined>
      );

      if (pathSignature === target.pathSignature) {
        lastProcessedUpdatedAtRef.current = updatedAt;
        return;
      }

      transitionInProgressRef.current = true;
      lastProcessedUpdatedAtRef.current = updatedAt;

      const message = `Estamos te guiando para ${target.label}...`;
      setGuidanceMessage(message);
      setGuidanceVisible(true);

      showAppToast({
        type: 'info',
        text1: 'Orquestração',
        text2: message,
        visibilityTime: GUIDANCE_DELAY_MS + 800,
      });

      void triggerOrchestrationHapticFeedback();

      await new Promise((resolve) => setTimeout(resolve, GUIDANCE_DELAY_MS));

      await fadeScreen(0.38);

      void triggerOrchestrationHapticFeedback();

      if (target.pathSignature === '/(tabs)') {
        router.replace(target.href);
      } else {
        router.push(target.href);
      }

      appliedPathSignatureRef.current = target.pathSignature;
      manualNavigationRef.current = false;

      await new Promise((resolve) => setTimeout(resolve, 80));
      await fadeScreen(0);

      setGuidanceVisible(false);
      transitionInProgressRef.current = false;
    },
    [fadeScreen, router]
  );

  const runGuidedNavigationRef = useRef(runGuidedNavigation);
  runGuidedNavigationRef.current = runGuidedNavigation;

  const dispatchOrchestrationSignal = useCallback((activeRoute: string, updatedAt: string) => {
    if (!activeRoute || !updatedAt) {
      return;
    }

    void runGuidedNavigationRef.current(activeRoute, updatedAt);
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
          event: 'UPDATE',
          schema: 'public',
          table: 'event_control',
          filter: 'id=eq.1',
        },
        (payload) => {
          const record = (payload.new ?? {}) as Record<string, unknown>;
          dispatchOrchestrationSignal(
            String(record.active_route ?? '').trim(),
            String(record.updated_at ?? '').trim()
          );
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

  if (!shouldListen) {
    return null;
  }

  return (
    <>
      {scrimVisible ? (
        <Animated.View style={[styles.screenFade, { opacity: screenOpacity }]} pointerEvents="none" />
      ) : null}
      <EventOrchestrationGuidanceOverlay
        visible={guidanceVisible}
        message={guidanceMessage}
        onHidden={() => setGuidanceMessage('')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screenFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#020617',
    zIndex: 9997,
  },
});
