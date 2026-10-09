import { AiAssistantChatPanel } from '@/components/AiAssistantChatPanel';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { useSessionCanUseAiAssistant } from '@/hooks/useSessionIsLeadership';
import {
  isAbigailFabRouteAllowed,
  isPreAuthScreenFocused,
  subscribePreAuthScreenFocused,
} from '@/lib/abigailFabVisibility';
import { ABIGAIL_NAME } from '@/lib/abigailPersona';
import { sessionCanUseAiAssistant } from '@/lib/aiLeadershipAccess';
import { boxShadowStyle } from '@/lib/boxShadow';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, usePathname, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FAB_SIZE = 48;
const FAB_MARGIN = 16;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function readVisualViewport() {
  const layoutH = window.innerHeight;
  const layoutW = window.innerWidth;
  const visual = window.visualViewport;
  const offsetTop = visual?.offsetTop ?? 0;
  const offsetLeft = visual?.offsetLeft ?? 0;
  const height = visual?.height ?? layoutH;
  const width = visual?.width ?? layoutW;

  return {
    offsetTop,
    offsetLeft,
    height,
    width,
    /** Faixa coberta pela barra do navegador ou pelo gesto do celular. */
    below: Math.max(0, Math.round(layoutH - offsetTop - height)),
  };
}

function measureFloatingBottom(safeBottom: number): number {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return FAB_MARGIN + safeBottom;
  }

  const view = readVisualViewport();
  const zoneLeft = view.offsetLeft + view.width - FAB_MARGIN - FAB_SIZE - 12;
  let lift = FAB_MARGIN + safeBottom;

  const consider = (rect: DOMRect) => {
    if (rect.width < 24 || rect.height < 24) {
      return;
    }

    const top = rect.top - view.offsetTop;
    const bottomEdge = rect.bottom - view.offsetTop;
    const left = rect.left - view.offsetLeft;
    const right = rect.right - view.offsetLeft;

    if (bottomEdge < view.height * 0.35 || top >= view.height - 4) {
      return;
    }

    if (right < zoneLeft - view.offsetLeft || left > view.width - 4) {
      return;
    }

    const clearance = Math.round(view.height - top + FAB_MARGIN);

    if (clearance > lift) {
      lift = clearance;
    }
  };

  document.querySelectorAll('[data-abigail-obstacle]').forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    consider(node.getBoundingClientRect());
  });

  document.querySelectorAll('button, [role="button"]').forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.closest('[data-abigail-fab]')) {
      return;
    }

    const style = window.getComputedStyle(node);
    const floating = style.position === 'fixed' || style.position === 'absolute';

    if (!floating || style.visibility === 'hidden' || style.display === 'none') {
      return;
    }

    const rect = node.getBoundingClientRect();
    const compact = rect.width <= 72 && rect.height <= 72 && rect.width >= 32 && rect.height >= 32;
    const visualRight = rect.right - view.offsetLeft;
    const visualBottom = rect.bottom - view.offsetTop;
    const dockedToCorner =
      visualRight >= view.width - 20 && visualBottom >= view.height - 120;

    if (!compact || !dockedToCorner) {
      return;
    }

    consider(rect);
  });

  const maxLift = Math.max(FAB_MARGIN + safeBottom, view.height - FAB_SIZE - FAB_MARGIN);
  return Math.min(lift, maxLift) + view.below;
}

export function LeadershipAiFab() {
  const pathname = usePathname();
  const segments = useSegments();
  const [preAuthFocused, setPreAuthFocused] = useState(() => isPreAuthScreenFocused());
  const routeAllowed = !preAuthFocused && isAbigailFabRouteAllowed(pathname, segments);
  const { allowed, refresh } = useSessionCanUseAiAssistant(routeAllowed);
  const [open, setOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [bottom, setBottom] = useState(FAB_MARGIN);

  useEffect(() => {
    setPreAuthFocused(isPreAuthScreenFocused());
    return subscribePreAuthScreenFocused(() => {
      setPreAuthFocused(isPreAuthScreenFocused());
    });
  }, []);

  useEffect(() => {
    if (!routeAllowed) {
      setOpen(false);
    }
  }, [routeAllowed]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const handleOpen = async () => {
    const canOpen = await sessionCanUseAiAssistant();

    if (!canOpen) {
      setOpen(false);
      void refresh();
      return;
    }

    setChatKey((current) => current + 1);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !allowed || !routeAllowed) {
      return;
    }

    let frame = 0;
    const probe = document.createElement('div');
    probe.setAttribute('data-abigail-fab', 'probe');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;height:0;width:0;padding-bottom:env(safe-area-inset-bottom);';
    document.body.appendChild(probe);

    const readSafeBottom = () =>
      Number.parseFloat(window.getComputedStyle(probe).paddingBottom) || 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = measureFloatingBottom(readSafeBottom());
        setBottom((current) => {
          if (current === next) {
            return current;
          }

          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          return next;
        });
      });
    };

    measure();

    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(document.body);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
      probe.remove();
    };
  }, [allowed, routeAllowed]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !open || typeof document === 'undefined') {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    window.scrollTo(0, 0);

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [open]);

  if (!allowed || !routeAllowed) {
    return null;
  }

  const fabButton = open ? null : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${ABIGAIL_NAME}`}
      dataSet={{ abigailFab: '1' }}
      onPress={() => void handleOpen()}
      style={({ pressed }) => [
        styles.fab,
        { bottom },
        pressed && styles.fabPressed,
      ]}
    >
      <MaterialIcons name="auto-awesome" size={22} color="#FFFFFF" />
    </Pressable>
  );

  const fab =
    Platform.OS === 'web' && typeof document !== 'undefined' && fabButton
      ? createPortal(fabButton, document.body)
      : fabButton;

  return (
    <>
      {fab}

      <Modal animationType="slide" visible={open} onRequestClose={handleClose}>
        <SafeAreaView style={styles.modalSafe} edges={['top', 'left', 'right']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{ABIGAIL_NAME}</Text>
            <Text style={styles.modalHint}>Assistente da liderança</Text>
          </View>
          <View style={styles.modalBody}>
            {open ? <AiAssistantChatPanel key={chatKey} /> : null}
          </View>
          <CloseFooterBar onPress={handleClose} accessibilityLabel={`Fechar ${ABIGAIL_NAME}`} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    right: FAB_MARGIN,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: MINIMAL_UI.blueDark,
    ...(Platform.OS === 'web'
      ? ({
          transitionProperty: 'bottom',
          transitionDuration: '250ms',
          transitionTimingFunction: 'ease-in-out',
        } as object)
      : null),
    alignItems: 'center',
    justifyContent: 'center',
    ...boxShadowStyle({
      color: '#00008B',
      offsetY: 3,
      blurRadius: 8,
      opacity: 0.28,
      elevation: 6,
    }),
    zIndex: 1000,
  },
  fabPressed: {
    opacity: 0.85,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    gap: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: MINIMAL_UI.text,
  },
  modalHint: {
    fontSize: 12,
    color: MINIMAL_UI.textMuted,
  },
  modalBody: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
