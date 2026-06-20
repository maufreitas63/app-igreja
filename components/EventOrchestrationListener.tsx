import { EventOrchestrationGuidanceOverlay } from '@/components/EventOrchestrationGuidanceOverlay';
import { showAppToast } from '@/lib/appToast';
import { triggerOrchestrationHapticFeedback } from '@/lib/eventOrchestrationHaptics';
import {
  buildEventOrchestrationPathSignature,
  resolveEventOrchestrationTarget,
} from '@/lib/eventOrchestrationRoutes';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

const GUIDANCE_DELAY_MS = 1500;
const SCREEN_FADE_MS = 320;

const ORCHESTRATION_EXCLUDED_PATHS = new Set([
  '/',
  '/index',
  '/register',
  '/totem-checkin',
  '/sessao-encerrada',
  '/admin/orquestrador',
]);

const normalizePathname = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

const shouldListenOnRoute = (pathname: string, segments: string[]) => {
  if (segments[0] === 'admin') {
    return false;
  }

  const normalized = normalizePathname(pathname);
  return !ORCHESTRATION_EXCLUDED_PATHS.has(normalized);
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

  const lastProcessedUpdatedAtRef = useRef<string | null>(null);
  const manualNavigationRef = useRef(false);
  const appliedPathSignatureRef = useRef<string | null>(null);
  const transitionInProgressRef = useRef(false);

  const currentPathSignature = buildEventOrchestrationPathSignature(
    pathname,
    searchParams as Record<string, string | string[] | undefined>
  );

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

      if (currentPathSignature === target.pathSignature) {
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

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(200);
      } else {
        triggerOrchestrationHapticFeedback();
      }

      await new Promise((resolve) => setTimeout(resolve, GUIDANCE_DELAY_MS));

      await fadeScreen(0.38);

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
    [currentPathSignature, fadeScreen, router]
  );

  useEffect(() => {
    if (!shouldListenOnRoute(pathname, segments)) {
      return undefined;
    }

    const channel = supabase
      .channel('event-control-orchestration')
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
          const activeRoute = String(record.active_route ?? '').trim();
          const updatedAt = String(record.updated_at ?? '').trim();

          if (!activeRoute || !updatedAt) {
            return;
          }

          void runGuidedNavigation(activeRoute, updatedAt);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pathname, runGuidedNavigation, segments]);

  if (!shouldListenOnRoute(pathname, segments)) {
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
