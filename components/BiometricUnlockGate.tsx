import { FontAwesome } from '@expo/vector-icons';
import { usePathname, useRouter, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import {
  getBiometricAvailability,
  isBiometricProcessUnlocked,
  isBiometricUnlockEnabled,
  markBiometricProcessUnlocked,
  unlockWithBiometrics,
  clearBiometricProcessUnlock,
} from '@/lib/biometricAuth';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import { hasStoredMemberSession } from '@/lib/memberSession';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { SIGN_OUT_QUERY_PARAM, getStoredUserPhone } from '@/lib/userSession';

type Props = {
  children: React.ReactNode;
};

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

/** Rotas públicas — sem gate biométrico. */
const isPublicRoute = (pathname: string, segments: string[]) => {
  if (segments[0] === '(tabs)') {
    return false;
  }

  const normalized = normalizePathname(pathname);
  return (
    normalized === '/'
    || normalized === '/index'
    || normalized === '/register'
    || normalized === '/totem-checkin'
    || normalized === '/forgot-password'
    || normalized === '/sessao-encerrada'
    || normalized === '/selecionar-igreja'
    || normalized === '/lgpd'
  );
};

/**
 * Em builds nativos, exige biometria (ou fallback para PIN no login) antes de
 * liberar telas autenticadas quando o acesso rápido está ativo neste aparelho.
 */
export function BiometricUnlockGate({ children }: Props) {
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('Biometria');
  const [hint, setHint] = useState('');
  const [phonePreview, setPhonePreview] = useState('');
  const promptedRef = useRef(false);

  const publicRoute = isPublicRoute(pathname, segments);

  const evaluateLock = useCallback(async () => {
    if (Platform.OS === 'web' || publicRoute) {
      setLocked(false);
      setChecking(false);
      return;
    }

    if (isBiometricProcessUnlocked()) {
      setLocked(false);
      setChecking(false);
      return;
    }

    try {
      const [hasSession, biometricOn, availability, storedPhone] = await Promise.all([
        hasStoredMemberSession(),
        isBiometricUnlockEnabled(),
        getBiometricAvailability(),
        getStoredUserPhone(),
      ]);

      setLabel(availability.label);
      if (storedPhone?.trim()) {
        setPhonePreview(formatBrazilPhoneInput(storedPhone));
      }

      if (!hasSession || !biometricOn) {
        if (hasSession && !biometricOn) {
          markBiometricProcessUnlocked();
        }
        setLocked(false);
        setChecking(false);
        return;
      }

      setLocked(true);
      setChecking(false);
    } catch (error) {
      console.warn('BiometricUnlockGate.evaluateLock:', error);
      setLocked(false);
      setChecking(false);
    }
  }, [publicRoute]);

  useEffect(() => {
    void evaluateLock();
  }, [evaluateLock, pathname]);

  const runBiometricUnlock = useCallback(async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    setHint('');

    try {
      const phone = await getStoredUserPhone();
      const result = await unlockWithBiometrics(phone);

      if (result.ok) {
        markBiometricProcessUnlocked();
        setLocked(false);
        setHint('');
        return;
      }

      if (!result.cancelled) {
        setHint(result.message);
      }

      if (result.unavailable) {
        // Sem biometria utilizável: libera a sessão já existente; PIN fica no próximo login.
        markBiometricProcessUnlocked();
        setLocked(false);
      }
    } finally {
      setBusy(false);
    }
  }, [busy]);

  useEffect(() => {
    if (!locked || publicRoute || promptedRef.current) {
      return;
    }

    promptedRef.current = true;
    void runBiometricUnlock();
  }, [locked, publicRoute, runBiometricUnlock]);

  const usePinFallback = useCallback(async () => {
    clearBiometricProcessUnlock();
    const phone = await getStoredUserPhone();
    const digits = phone?.replace(/\D/g, '') ?? '';

    router.replace({
      pathname: '/',
      params: {
        [SIGN_OUT_QUERY_PARAM]: '1',
        ...(digits ? { phone: digits } : {}),
      },
    });
  }, [router]);

  if (Platform.OS === 'web' || publicRoute || (!checking && !locked)) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.lockScreen}>
      <FontAwesome name="lock" size={42} color={VIGILANCE_SCALES_UI.accent} />
      <Text style={styles.title}>App bloqueado</Text>
      <Text style={styles.subtitle}>
        Use {label} para continuar, ou digite a senha de 4 dígitos.
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Desbloquear com ${label}`}
        activeOpacity={0.85}
        disabled={busy}
        onPress={() => {
          promptedRef.current = true;
          void runBiometricUnlock();
        }}
        style={[styles.primaryButton, busy && styles.buttonDisabled]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <FontAwesome name="user-circle" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Desbloquear com {label}</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Usar senha de 4 dígitos"
        activeOpacity={0.85}
        disabled={busy}
        onPress={() => void usePinFallback()}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Usar senha de 4 dígitos</Text>
      </TouchableOpacity>

      {phonePreview ? <Text style={styles.phoneMeta}>Conta: {phonePreview}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.background,
  },
  lockScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
    backgroundColor: MINIMAL_UI.background,
  },
  title: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '700',
    color: MINIMAL_UI.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: '#B91C1C',
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 18,
    backgroundColor: '#3A96DD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  secondaryButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  phoneMeta: {
    marginTop: 16,
    fontSize: 13,
    color: MINIMAL_UI.textMuted,
  },
});
