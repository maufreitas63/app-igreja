import {
  clearGhostModeState,
  getGhostModeState,
  setGhostModeState,
  subscribeGhostMode,
  type GhostModeState,
} from '@/lib/ghostMode';
import {
  registerGhostModeAuditEvent,
} from '@/lib/ghostModeApi';
import { invalidateSessionProfileCache } from '@/lib/sessionProfile';
import { useRouter } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

type GhostModeContextValue = {
  state: GhostModeState | null;
  isActive: boolean;
  startGhostMode: (input: {
    targetProfileId: string;
    targetFullName: string;
  }) => Promise<{ success: boolean; message: string }>;
  endGhostMode: () => Promise<void>;
};

const GhostModeContext = createContext<GhostModeContextValue | null>(null);

export function GhostModeProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const [state, setState] = useState<GhostModeState | null>(() => getGhostModeState());

  useEffect(() => subscribeGhostMode(() => {
    setState(getGhostModeState());
  }), []);

  const startGhostMode = useCallback(
    async (input: { targetProfileId: string; targetFullName: string }) => {
      const { resolveRealSessionProfileId } = await import('@/lib/sessionProfile');
      const realProfileId = await resolveRealSessionProfileId({ forceRefresh: true });

      if (!realProfileId) {
        return { success: false, message: 'Sessão inválida. Saia e entre novamente.' };
      }

      if (realProfileId === input.targetProfileId) {
        return { success: false, message: 'Selecione um usuário diferente do operador atual.' };
      }

      const audit = await registerGhostModeAuditEvent('started', {
        targetProfileId: input.targetProfileId,
        targetFullName: input.targetFullName,
      });

      if (!audit.success) {
        return { success: false, message: audit.message };
      }

      setGhostModeState({
        targetProfileId: input.targetProfileId,
        targetFullName: input.targetFullName,
        realProfileId,
        startedAt: new Date().toISOString(),
      });

      invalidateSessionProfileCache();
      router.replace('/(tabs)/dashboard');

      return { success: true, message: `Modo Ghost ativo: ${input.targetFullName}` };
    },
    [router]
  );

  const endGhostMode = useCallback(async () => {
    const current = getGhostModeState();

    if (!current) {
      return;
    }

    await registerGhostModeAuditEvent('ended', {
      targetProfileId: current.targetProfileId,
      targetFullName: current.targetFullName,
    });

    clearGhostModeState();
    invalidateSessionProfileCache();
    router.replace('/(tabs)/dashboard');
  }, [router]);

  const value = useMemo<GhostModeContextValue>(
    () => ({
      state,
      isActive: state !== null,
      startGhostMode,
      endGhostMode,
    }),
    [endGhostMode, startGhostMode, state]
  );

  return <GhostModeContext.Provider value={value}>{children}</GhostModeContext.Provider>;
}

export function useGhostMode() {
  const context = useContext(GhostModeContext);

  if (!context) {
    throw new Error('useGhostMode deve ser usado dentro de GhostModeProvider.');
  }

  return context;
}
