import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { showAppToast } from '@/lib/appToast';
import { useLoginInstanceCode } from '@/hooks/useLoginInstanceCode';
import { FontAwesome } from '@expo/vector-icons';
import {
  ACCESS_PIN_LENGTH,
  isValidAccessPin,
  profileHasAccessPin,
} from '@/lib/accessPin';
import {
  AUTH_PIN_EMAIL_SQL_HINT,
  dispatchAuthAccessPinEmail,
  getAuthPinDeliveryState,
} from '@/lib/authNotificationService';
import { isBrazilianMobilePhoneComplete, isBrazilianPhoneComplete } from '@/lib/phoneValidation';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import { verificarLogin } from '@/lib/verificarLogin';
import {
  buildManageProfileChangeAccessPinAfterRecoveryRoute,
  resolveRegisteredUserSessionRoute,
} from '@/lib/profileOnboarding';
import { isLgpdAtivoEnabled } from '@/lib/appParameters';
import { notifyAppActiveSessionEstablished } from '@/lib/appActiveStatus';
import {
  getStoredUserPhone,
  persistUserPhone,
  persistUserSession,
  resolveProfileId,
  SIGN_OUT_QUERY_PARAM,
} from '@/lib/userSession';
import {
  isTotemDevicePhone,
  isValidTotemAccessPin,
  listCelTotemPhones,
  normalizePhoneDigits,
  persistTotemDeviceSession,
  phoneDigitsMatch,
} from '@/lib/totemDevice';
import {
  getBiometricAvailability,
  isBiometricUnlockEnabled,
  maybeOfferBiometricEnrollment,
  unlockSessionWithBiometrics,
} from '@/lib/biometricAuth';

const LOGIN_SURFACE = '#FFFFFF';
const LOGIN_ACCENT = VIGILANCE_SCALES_UI.accent;
const LOGIN_ICON = '#1B4F8A';
const LOGIN_INPUT_BORDER = 'rgba(28, 79, 138, 0.35)';
const LOGIN_SOFT_BORDER = 'rgba(52, 211, 153, 0.35)';
const LOGIN_SUBMIT_BG = '#3A96DD';
const LOGIN_SUBMIT_TEXT = '#FFFFFF';
const LOGIN_PLACEHOLDER = 'rgba(58, 150, 221, 0.55)';

function ReadOnlyText({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text selectable={false} style={[style, styles.nonSelectableText]}>
      {children}
    </Text>
  );
}

export default function IndexScreen() {
  const {
    [SIGN_OUT_QUERY_PARAM]: signedOutParam,
    phone: phoneParam,
    recovered: recoveredParam,
    email: emailParam,
    igreja: igrejaParam,
    codigo: codigoParam,
  } = useLocalSearchParams<{
      [SIGN_OUT_QUERY_PARAM]?: string | string[];
      phone?: string | string[];
      recovered?: string | string[];
      email?: string | string[];
      igreja?: string | string[];
      codigo?: string | string[];
    }>();
  const skipSessionRestore =
    signedOutParam === '1' || (Array.isArray(signedOutParam) && signedOutParam.includes('1'));
  const recoveryPhoneParam =
    typeof phoneParam === 'string'
      ? phoneParam
      : Array.isArray(phoneParam)
        ? phoneParam[0] ?? ''
        : '';
  const isPasswordRecovered =
    recoveredParam === '1' || (Array.isArray(recoveredParam) && recoveredParam.includes('1'));
  const recoveryEmailMaskedParam =
    typeof emailParam === 'string'
      ? emailParam
      : Array.isArray(emailParam)
        ? emailParam[0] ?? ''
        : '';
  const [phone, setPhone] = useState('');
  const [accessPin, setAccessPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingPin, setIsSendingPin] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(() => !skipSessionRestore);
  const [celTotemPhones, setCelTotemPhones] = useState<string[]>([]);
  const [hasStoredAccessPin, setHasStoredAccessPin] = useState<boolean | null>(null);
  const [pinDeliveryUnlocked, setPinDeliveryUnlocked] = useState(false);
  const [loginStep, setLoginStep] = useState<1 | 2>(1);
  const [pinCodeSent, setPinCodeSent] = useState(false);
  const [showForgotPasswordHelp, setShowForgotPasswordHelp] = useState(false);
  const [passwordRecoveredBanner, setPasswordRecoveredBanner] = useState(false);
  const [recoveryEmailMasked, setRecoveryEmailMasked] = useState('');
  const [firstAccessNeedsEmail, setFirstAccessNeedsEmail] = useState(false);
  const [firstAccessIncomplete, setFirstAccessIncomplete] = useState(false);
  const [firstAccessEmail, setFirstAccessEmail] = useState('');
  const [firstAccessEmailConfirm, setFirstAccessEmailConfirm] = useState('');
  const [firstAccessEmailMasked, setFirstAccessEmailMasked] = useState('');
  const [pinEmailFeedback, setPinEmailFeedback] = useState<{
    kind: 'error' | 'success';
    title: string;
    message: string;
  } | null>(null);
  const [phoneInstanceError, setPhoneInstanceError] = useState<string | null>(null);
  const [phoneTransferAvailable, setPhoneTransferAvailable] = useState(false);
  const [phoneBelongsToInstance, setPhoneBelongsToInstance] = useState(false);
  const [isCheckingPhoneInstance, setIsCheckingPhoneInstance] = useState(false);
  const [isRequestingPhoneTransfer, setIsRequestingPhoneTransfer] = useState(false);
  const [biometricLoginAvailable, setBiometricLoginAvailable] = useState(false);
  const [biometricLoginLabel, setBiometricLoginLabel] = useState('Biometria');
  const [isBiometricUnlocking, setIsBiometricUnlocking] = useState(false);
  const isTotemLoginMode = celTotemPhones.some((totem) => phoneDigitsMatch(phone, totem));
  const phoneDigits = normalizePhoneDigits(phone);
  const needsEmailBeforePin =
    !isTotemLoginMode
    && !pinDeliveryUnlocked
    && (hasStoredAccessPin === false || firstAccessNeedsEmail || firstAccessIncomplete);
  const isCheckingStoredPin =
    loginStep === 2 && !isTotemLoginMode && isBrazilianPhoneComplete(phone) && hasStoredAccessPin === null;
  const showEmailPinDelivery =
    !isTotemLoginMode && needsEmailBeforePin && !isCheckingStoredPin && !showForgotPasswordHelp;
  const showForgotPasswordLink =
    !isTotemLoginMode && loginStep === 2 && !isCheckingStoredPin && !needsEmailBeforePin;
  const canAttemptMemberPinLogin =
    isTotemLoginMode || (isBrazilianPhoneComplete(phone) && !needsEmailBeforePin);
  const isPinInputEditable =
    loginStep === 2
    && (isTotemLoginMode
      || (hasStoredAccessPin !== null && (!needsEmailBeforePin || pinDeliveryUnlocked)));
  const isEmailPinButtonDisabled = isSendingPin;
  const isVerifyingPinRef = useRef(false);
  const autoSendEmailKeyRef = useRef('');
  const pinInputRef = useRef<TextInput>(null);
  const router = useRouter();
  const {
    instanceCode,
    instanceName,
    isInstanceValid,
    isValidating,
    instanceError,
    hasStoredInstance,
    instanceInputRef,
    handleInstanceCodeChange,
    handleInstanceBlur,
    validateInstance,
    beginChangeInstance,
  } = useLoginInstanceCode({
    igrejaParam,
    codigoParam,
  });

  const focusPinInput = useCallback(() => {
    requestAnimationFrame(() => {
      pinInputRef.current?.focus();
    });
  }, []);

  const goBackToPhoneStep = useCallback(() => {
    setPhone('');
    setLoginStep(1);
    setAccessPin('');
    setPinCodeSent(false);
    setShowForgotPasswordHelp(false);
    setPasswordRecoveredBanner(false);
    setRecoveryEmailMasked('');
    setFirstAccessNeedsEmail(false);
    setFirstAccessIncomplete(false);
    setFirstAccessEmail('');
    setFirstAccessEmailConfirm('');
    setFirstAccessEmailMasked('');
    setPinEmailFeedback(null);
    setPhoneInstanceError(null);
    setPhoneTransferAvailable(false);
    setPhoneBelongsToInstance(false);
    setPinDeliveryUnlocked(false);
    setHasStoredAccessPin(null);
    autoSendEmailKeyRef.current = '';
  }, []);

  const requestMemberTransfer = useCallback(async () => {
    if (isRequestingPhoneTransfer) {
      return;
    }

    setIsRequestingPhoneTransfer(true);
    try {
      const instanceOk = isInstanceValid || (await validateInstance(instanceCode));
      if (!instanceOk) {
        throw new Error('Informe o código da instância da igreja de destino para continuar.');
      }

      const [{ solicitarTransferenciaMembroLogin }, { getStoredTenantId }] = await Promise.all([
        import('@/lib/igrejaTransferenciaApi'),
        import('@/lib/tenantSession'),
      ]);
      const destinationTenantId = await getStoredTenantId();
      const result = await solicitarTransferenciaMembroLogin(phone, { destinationTenantId });
      setPhoneInstanceError(result.message);
      setPhoneTransferAvailable(false);
      showAppToast({
        type: 'success',
        text1: result.alreadyPending ? 'Pedido já enviado' : 'Pedido enviado',
        text2: result.message,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível solicitar a transferência.';
      setPhoneInstanceError(message);
      showAppToast({ type: 'error', text1: 'Transferência', text2: message });
    } finally {
      setIsRequestingPhoneTransfer(false);
    }
  }, [
    instanceCode,
    isInstanceValid,
    isRequestingPhoneTransfer,
    phone,
    validateInstance,
  ]);

  const advanceToPinStep = useCallback(() => {
    void (async () => {
      const instanceOk = isInstanceValid || (await validateInstance(instanceCode));
      if (!instanceOk) {
        Alert.alert(
          'Código da instância',
          instanceCode.trim()
            ? 'Código de instância não encontrado. Verifique com a administração.'
            : 'Informe o código da instância da sua igreja para continuar.'
        );
        return;
      }

      if (!isBrazilianMobilePhoneComplete(phone)) {
        Alert.alert('Atenção', 'Digite o celular completo com 11 dígitos.');
        return;
      }

      if (isTotemLoginMode) {
        void persistUserPhone(phone);
        setPhoneBelongsToInstance(true);
        setPhoneInstanceError(null);
        setLoginStep(2);
        focusPinInput();
        return;
      }

      setIsCheckingPhoneInstance(true);
      setPhoneInstanceError(null);
      try {
        const { lookupLoginPhoneForInstance } = await import('@/lib/tenantSession');
        const lookup = await lookupLoginPhoneForInstance(phone);

        if (!lookup.ok) {
          setPhoneBelongsToInstance(false);
          setPhoneInstanceError(lookup.message);
          showAppToast({ type: 'error', text1: 'Celular', text2: lookup.message });
          return;
        }

        if (!lookup.inInstance && lookup.existsElsewhere) {
          setPhoneBelongsToInstance(false);
          setPhoneTransferAvailable(lookup.canRequestTransfer);
          const originLabel = lookup.originName || lookup.originCode || 'outra igreja';
          const destLabel = lookup.destinationName || lookup.destinationCode || 'esta igreja';
          const conflictMessage = lookup.pendingRequestId
            ? `Este celular já está cadastrado em ${originLabel}. Já existe um pedido de transferência para ${destLabel} aguardando a origem.`
            : `Este celular já está cadastrado em ${originLabel}. Para ingressar em ${destLabel}, solicite a transferência.`;
          setPhoneInstanceError(conflictMessage);
          return;
        }

        setPhoneTransferAvailable(false);
        setPhoneBelongsToInstance(lookup.inInstance);
        void persistUserPhone(phone);
        setLoginStep(2);
      } finally {
        setIsCheckingPhoneInstance(false);
      }
    })();
  }, [
    focusPinInput,
    instanceCode,
    isInstanceValid,
    isTotemLoginMode,
    phone,
    validateInstance,
  ]);

  const handlePhoneChange = (text: string) => {
    setPhone(formatBrazilPhoneInput(text));
    setLoginStep(1);
    setAccessPin('');
    setPinCodeSent(false);
    setShowForgotPasswordHelp(false);
    setPasswordRecoveredBanner(false);
    setRecoveryEmailMasked('');
    setFirstAccessNeedsEmail(false);
    setFirstAccessIncomplete(false);
    setFirstAccessEmail('');
    setFirstAccessEmailConfirm('');
    setFirstAccessEmailMasked('');
    setPinEmailFeedback(null);
    setPhoneInstanceError(null);
    setPhoneTransferAvailable(false);
    setPhoneBelongsToInstance(false);
    setPinDeliveryUnlocked(false);
    setHasStoredAccessPin(null);
    autoSendEmailKeyRef.current = '';
  };

  const handlePinChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, ACCESS_PIN_LENGTH);
    setAccessPin(digits);
  };

  const continueWithExistingProfile = useCallback(
    async (
      profile: Record<string, unknown>,
      phoneForSession: string,
      sessionToken?: string | null,
      options?: {
        afterPasswordRecovery?: boolean;
        recoveryPin?: string;
        skipBiometricOffer?: boolean;
      }
    ) => {
      await persistUserSession(profile, phoneForSession, sessionToken);
      try {
        const { ensureSessionReady } = await import('@/lib/ensureSessionReady');
        await ensureSessionReady();
      } catch {
        // best-effort — login segue mesmo se renovar token falhar offline
      }
      await notifyAppActiveSessionEstablished();

      if (
        options?.afterPasswordRecovery
        && options.recoveryPin
        && isValidAccessPin(options.recoveryPin)
      ) {
        router.replace(
          buildManageProfileChangeAccessPinAfterRecoveryRoute(
            phoneForSession,
            options.recoveryPin
          )
        );
        return true;
      }

      // Atalho nativo: oferece biometria sem substituir telefone+PIN.
      if (!options?.skipBiometricOffer) {
        const profileId = resolveProfileId(profile);
        if (profileId) {
          await maybeOfferBiometricEnrollment({
            phone: phoneForSession,
            profileId,
          });
        }
      }

      const lgpdAtivo = await isLgpdAtivoEnabled();
      let route = resolveRegisteredUserSessionRoute(profile, phoneForSession, lgpdAtivo) as Href | null;

      if (!route) {
        return false;
      }

      // Após LGPD/cadastro ok: se há mais de uma igreja, escolher instância
      if (
        typeof route === 'object'
        && 'pathname' in route
        && (route.pathname === '/(tabs)' || route.pathname === '/(tabs)/dashboard')
      ) {
        try {
          const {
            shouldPromptTenantSelection,
            buildSelecionarIgrejaRoute,
            getStoredTenantId,
            getPreferredIgrejaCode,
            listSessionIgrejas,
            activateSessionTenant,
            clearTenantId,
          } = await import('@/lib/tenantSession');
          const storedTenant = await getStoredTenantId();
          const preferredCode = await getPreferredIgrejaCode();
          const churches = await listSessionIgrejas();
          const storedMatch = storedTenant
            ? churches.find((church) => church.id === storedTenant)
            : null;
          const preferredMatch = preferredCode
            ? churches.find(
                (church) => church.code.trim().toUpperCase() === preferredCode
              )
            : null;
          const primaryMatch = churches.find((church) => church.is_primary) ?? null;

          // Prioridade: última instância ativa → deep link (?igreja=) → primary no banco → única / escolha.
          // preferred_igreja_code NÃO pode sobrescrever um tenant já salvo (ex.: IBN após QR IBEP).
          const applyTenant = async (
            church: NonNullable<typeof storedMatch>
          ) => {
            const activated = await activateSessionTenant(church.id, church);
            if (!activated.success) {
              const { persistActiveIgrejaBranding } = await import('@/lib/tenantSession');
              await persistActiveIgrejaBranding(church);
            }
          };

          if (storedMatch) {
            await applyTenant(storedMatch);
          } else if (storedTenant && !storedMatch) {
            // Tenant bloqueado/removido: limpa storage e força escolha válida.
            await clearTenantId();
            if (preferredMatch) {
              await applyTenant(preferredMatch);
            } else if (primaryMatch) {
              await applyTenant(primaryMatch);
            } else if (churches.length === 1 && churches[0]) {
              await applyTenant(churches[0]);
            } else if (churches.length > 1) {
              route = buildSelecionarIgrejaRoute(phoneForSession) as Href;
            }
          } else if (preferredMatch) {
            await applyTenant(preferredMatch);
          } else if (primaryMatch) {
            await applyTenant(primaryMatch);
          } else if (churches.length === 1 && churches[0]) {
            await applyTenant(churches[0]);
          } else if (await shouldPromptTenantSelection()) {
            route = buildSelecionarIgrejaRoute(phoneForSession) as Href;
          }
        } catch (error) {
          console.warn('tenant selection:', error);
        }
      }

      router.replace(route);
      return true;
    },
    [router]
  );

  useEffect(() => {
    if (!recoveryPhoneParam || isRestoringSession) {
      return;
    }

    const formattedPhone = formatBrazilPhoneInput(recoveryPhoneParam);

    if (!isBrazilianMobilePhoneComplete(formattedPhone)) {
      return;
    }

    setPhone(formattedPhone);
    setLoginStep(2);
    setAccessPin('');
    setPinCodeSent(false);
    setShowForgotPasswordHelp(false);
    setPinDeliveryUnlocked(true);
    setHasStoredAccessPin(true);
    setPasswordRecoveredBanner(isPasswordRecovered);
    setRecoveryEmailMasked(recoveryEmailMaskedParam.trim());
    focusPinInput();
  }, [focusPinInput, isPasswordRecovered, isRestoringSession, recoveryEmailMaskedParam, recoveryPhoneParam]);

  useEffect(() => {
    if (isTotemLoginMode || !isBrazilianPhoneComplete(phone)) {
      setHasStoredAccessPin(null);
      setFirstAccessNeedsEmail(false);
      setFirstAccessIncomplete(false);
      return;
    }

    let active = true;

    void (async () => {
      try {
        const [hasPin, deliveryState] = await Promise.all([
          profileHasAccessPin(phoneDigits),
          getAuthPinDeliveryState(phoneDigits),
        ]);

        if (!active) {
          return;
        }

        if (deliveryState.ok && deliveryState.isTotem) {
          setHasStoredAccessPin(true);
          setFirstAccessNeedsEmail(false);
          setFirstAccessIncomplete(false);
          setPinDeliveryUnlocked(true);
          setFirstAccessEmailMasked('');
          return;
        }

        if (hasPin === true) {
          setHasStoredAccessPin(true);

          const needsDelivery =
            deliveryState.ok
            && (deliveryState.needsEmail || deliveryState.needsFirstAccess);

          if (needsDelivery) {
            setPinDeliveryUnlocked(false);
            setFirstAccessNeedsEmail(deliveryState.needsEmail);
            setFirstAccessIncomplete(deliveryState.needsFirstAccess);
            setFirstAccessEmailMasked(deliveryState.emailMasked);
          } else {
            setPinDeliveryUnlocked(true);
            setFirstAccessNeedsEmail(false);
            setFirstAccessIncomplete(false);
            if (deliveryState.ok) {
              setFirstAccessEmailMasked(deliveryState.emailMasked);
            }
          }
          return;
        }

        if (hasPin === false) {
          setHasStoredAccessPin(false);
          setPinDeliveryUnlocked(false);

          if (deliveryState.ok) {
            setFirstAccessNeedsEmail(deliveryState.needsEmail);
            setFirstAccessIncomplete(deliveryState.needsFirstAccess);
            setFirstAccessEmailMasked(deliveryState.emailMasked);
          } else {
            setFirstAccessNeedsEmail(true);
            setFirstAccessIncomplete(true);
          }

          return;
        }

        setHasStoredAccessPin(null);
      } catch (error) {
        console.error('Erro ao verificar senha de acesso:', error);

        if (active) {
          setHasStoredAccessPin(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [isTotemLoginMode, phoneDigits, phone]);

  // Sempre preenche o celular salvo localmente (mesmo após "Sair do aplicativo").
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const storedPhone = await getStoredUserPhone();

        if (!active || !storedPhone?.trim()) {
          return;
        }

        setPhone((current) =>
          current.trim() ? current : formatBrazilPhoneInput(storedPhone)
        );
      } catch (error) {
        console.error('Erro ao carregar celular salvo:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [enabled, availability] = await Promise.all([
          isBiometricUnlockEnabled(),
          getBiometricAvailability(),
        ]);

        if (!active) {
          return;
        }

        setBiometricLoginLabel(availability.label);
        setBiometricLoginAvailable(enabled && availability.supported);
      } catch (error) {
        console.warn('biometric login option:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleBiometricLogin = useCallback(async () => {
    if (isBiometricUnlocking || isLoading || isVerifyingPinRef.current) {
      return;
    }

    const instanceOk = isInstanceValid || (await validateInstance(instanceCode));
    if (!instanceOk) {
      Alert.alert(
        'Código da instância',
        'Informe o código da instância da sua igreja para continuar.'
      );
      return;
    }

    setIsBiometricUnlocking(true);

    try {
      const unlock = await unlockSessionWithBiometrics();

      if (!unlock.ok || !unlock.profile || !unlock.phone) {
        if (unlock.message) {
          Alert.alert('Biometria', unlock.message);
        }

        setLoginStep(2);
        setPinDeliveryUnlocked(true);
        setHasStoredAccessPin(true);
        focusPinInput();
        return;
      }

      const continued = await continueWithExistingProfile(
        unlock.profile,
        unlock.phone,
        unlock.sessionToken,
        { skipBiometricOffer: true }
      );

      if (!continued) {
        Alert.alert('Erro de Acesso', 'Não foi possível continuar com a biometria. Use a senha.');
        setLoginStep(2);
        focusPinInput();
      }
    } catch (error) {
      console.error('Erro no login biométrico:', error);
      Alert.alert('Biometria', 'Não foi possível entrar. Digite a senha de 4 dígitos.');
      setLoginStep(2);
      focusPinInput();
    } finally {
      setIsBiometricUnlocking(false);
    }
  }, [
    continueWithExistingProfile,
    focusPinInput,
    instanceCode,
    isInstanceValid,
    isLoading,
    isBiometricUnlocking,
    validateInstance,
  ]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const phones = await listCelTotemPhones();

        if (!active) {
          return;
        }

        setCelTotemPhones(phones);
      } catch (error) {
        console.error('Erro ao carregar celular do totem:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (skipSessionRestore) {
      setIsRestoringSession(false);
      return;
    }

    let active = true;
    const restoreTimeout = setTimeout(() => {
      if (active) {
        setIsRestoringSession(false);
      }
    }, 6000);

    void (async () => {
      try {
        const storedPhone = await getStoredUserPhone();

        if (storedPhone && (await isTotemDevicePhone(storedPhone))) {
          if (!active) {
            return;
          }

          router.replace('/totem-checkin');
          return;
        }

        const biometricEnabled = await isBiometricUnlockEnabled();
        if (!active) {
          return;
        }

        if (biometricEnabled) {
          const availability = await getBiometricAvailability();
          if (!active) {
            return;
          }

          setBiometricLoginLabel(availability.label);
          setBiometricLoginAvailable(availability.supported);

          if (availability.supported) {
            const unlock = await unlockSessionWithBiometrics();
            if (!active) {
              return;
            }

            if (unlock.ok && unlock.profile && unlock.phone) {
              const continued = await continueWithExistingProfile(
                unlock.profile,
                unlock.phone,
                unlock.sessionToken,
                { skipBiometricOffer: true }
              );

              if (continued) {
                return;
              }
            }

            // Fallback: mantém telefone+PIN na tela.
            if (storedPhone?.trim()) {
              setPhone(formatBrazilPhoneInput(storedPhone));
              setLoginStep(2);
              setPinDeliveryUnlocked(true);
              setHasStoredAccessPin(true);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao restaurar sessão:', error);
      } finally {
        clearTimeout(restoreTimeout);
        if (active) {
          setIsRestoringSession(false);
        }
      }
    })();

    return () => {
      active = false;
      clearTimeout(restoreTimeout);
    };
  }, [continueWithExistingProfile, router, skipSessionRestore]);

  const handleEmailPinPress = useCallback((_options?: { silent?: boolean }) => {
    if (!isBrazilianPhoneComplete(phone)) {
      const message = 'Informe um número de celular válido antes de solicitar o código.';
      setPinEmailFeedback({ kind: 'error', title: 'Atenção', message });
      showAppToast({ type: 'error', text1: 'Atenção', text2: message });
      return;
    }

    const typedEmail = firstAccessEmail.trim();
    const typedConfirm = firstAccessEmailConfirm.trim();

    if (!typedEmail || !typedConfirm) {
      const message = 'Informe e confirme o e-mail para receber o código de acesso.';
      setPinEmailFeedback({ kind: 'error', title: 'Atenção', message });
      showAppToast({ type: 'error', text1: 'Atenção', text2: message });
      return;
    }

    if (typedEmail.toLowerCase() !== typedConfirm.toLowerCase()) {
      const message = 'Os e-mails informados não coincidem.';
      setPinEmailFeedback({ kind: 'error', title: 'Atenção', message });
      showAppToast({ type: 'error', text1: 'Atenção', text2: message });
      return;
    }

    void (async () => {
      setIsSendingPin(true);
      setPinEmailFeedback(null);

      try {
        const result = await dispatchAuthAccessPinEmail({
          phone,
          email: typedEmail,
          emailConfirm: typedConfirm,
          purpose: 'first_access',
        });

        if (!result.ok) {
          if (result.needsEmail) {
            setFirstAccessNeedsEmail(true);
          }

          const title = result.emailInUse ? 'E-mail já cadastrado' : 'Não foi possível enviar o código';
          const message = result.emailInUse
            ? result.message
            : result.message.includes('AUTH_CHANNEL_BLOCKED')
              ? 'O envio por WhatsApp foi desativado. Use apenas e-mail.'
              : result.message.includes('auth-pin-email-only')
                ? AUTH_PIN_EMAIL_SQL_HINT
                : result.message;

          setPinEmailFeedback({ kind: 'error', title, message });
          showAppToast({ type: 'error', text1: title, text2: message });
          return;
        }

        setFirstAccessNeedsEmail(false);
        setFirstAccessIncomplete(false);
        setFirstAccessEmailMasked(result.emailMasked);
        setPinDeliveryUnlocked(true);
        setHasStoredAccessPin(true);
        setPinCodeSent(true);
        setAccessPin('');
        focusPinInput();

        const title = 'Código enviado por e-mail';
        const message = [
          result.emailMasked
            ? `Enviamos o código de 4 dígitos para ${result.emailMasked}.`
            : 'Enviamos o código de 4 dígitos por e-mail.',
          'Confira a caixa de entrada e a pasta de spam.',
        ].join(' ');

        setPinEmailFeedback({ kind: 'success', title, message });
        showAppToast({ type: 'success', text1: title, text2: message });
      } catch (err: unknown) {
        console.error('Erro ao enviar código por e-mail:', err);
        const raw = err instanceof Error ? err.message : '';
        const message = raw.includes('AUTH_CHANNEL_BLOCKED')
          ? 'O envio por WhatsApp foi desativado. Use apenas e-mail.'
          : AUTH_PIN_EMAIL_SQL_HINT;
        setPinEmailFeedback({ kind: 'error', title: 'Erro', message });
        showAppToast({ type: 'error', text1: 'Erro', text2: message });
      } finally {
        setIsSendingPin(false);
      }
    })();
  }, [firstAccessEmail, firstAccessEmailConfirm, focusPinInput, phone]);

  useEffect(() => {
    if (
      !showEmailPinDelivery
      || isSendingPin
      || pinCodeSent
      || isCheckingStoredPin
      || loginStep !== 2
    ) {
      return;
    }

    const typedEmail = firstAccessEmail.trim().toLowerCase();
    const typedConfirm = firstAccessEmailConfirm.trim().toLowerCase();

    if (!typedEmail || typedEmail !== typedConfirm || !typedEmail.includes('@')) {
      return;
    }

    const key = `${phoneDigits}|${typedEmail}`;
    if (autoSendEmailKeyRef.current === key) {
      return;
    }

    const timer = setTimeout(() => {
      autoSendEmailKeyRef.current = key;
      handleEmailPinPress({ silent: true });
    }, 700);

    return () => clearTimeout(timer);
  }, [
    firstAccessEmail,
    firstAccessEmailConfirm,
    handleEmailPinPress,
    isCheckingStoredPin,
    isSendingPin,
    loginStep,
    phoneDigits,
    pinCodeSent,
    showEmailPinDelivery,
  ]);

  const submitAccess = useCallback(
    async (pin: string) => {
      if (isVerifyingPinRef.current) {
        return;
      }

      if (isTotemLoginMode) {
        if (!isValidAccessPin(pin)) {
          return;
        }
      } else {
        if (!isBrazilianPhoneComplete(phone)) {
          Alert.alert('Atenção', 'Por favor, digite um número de celular válido.');
          return;
        }

        const instanceOk = isInstanceValid || (await validateInstance(instanceCode));
        if (!instanceOk) {
          Alert.alert(
            'Código da instância',
            'Informe o código da instância da sua igreja para continuar.'
          );
          return;
        }

        if (!isValidAccessPin(pin)) {
          Alert.alert('Atenção', 'Digite a senha de acesso de 4 dígitos.');
          return;
        }

        if (!canAttemptMemberPinLogin) {
          setAccessPin('');
          Alert.alert(
            'Código necessário',
            'Na primeira entrada, toque em "Receber código por e-mail", confira a mensagem e digite os 4 dígitos aqui.'
          );
          return;
        }
      }

      isVerifyingPinRef.current = true;
      setIsLoading(true);

      try {
        if (isTotemLoginMode || (await isTotemDevicePhone(phone))) {
          if (!isValidTotemAccessPin(pin)) {
            setAccessPin('');
            Alert.alert('Senha incorreta', 'Senha do totem: 9999.');
            return;
          }

          const entered = await persistTotemDeviceSession(phone);

          if (!entered) {
            Alert.alert(
              'Totem não configurado',
              'Defina o parâmetro cel_totem no Supabase (scripts/app-parameter-cel-totem.sql).'
            );
            return;
          }

          router.replace('/totem-checkin');
          return;
        }

        const cleanPhone = phone.replace(/\D/g, '');
        const verification = await verificarLogin(cleanPhone, pin);

        if (!verification.ok) {
          setAccessPin('');

          if (verification.reason === 'rpc_error') {
            Alert.alert(
              'Validação indisponível',
              'Execute no Supabase o script scripts/verificar-login.sql e tente novamente.'
            );
            return;
          }

          setShowForgotPasswordHelp(true);
          Alert.alert(
            'Senha incorreta',
            'Toque em "Esqueci minha senha" para receber a nova senha por e-mail.'
          );
          return;
        }

        const continued = await continueWithExistingProfile(
          verification.profile,
          cleanPhone,
          verification.sessionToken,
          isPasswordRecovered
            ? { afterPasswordRecovery: true, recoveryPin: pin.trim() }
            : undefined
        );

        if (!continued) {
          Alert.alert('Erro de Acesso', 'Não foi possível continuar com este perfil.');
        }
      } catch (err) {
        console.error('ERRO COMPLETO:', err);
        setAccessPin('');
        Alert.alert('Erro de Acesso', 'Não foi possível conectar ao servidor.');
      } finally {
        setIsLoading(false);
        isVerifyingPinRef.current = false;
      }
    },
    [
      canAttemptMemberPinLogin,
      continueWithExistingProfile,
      instanceCode,
      isInstanceValid,
      isPasswordRecovered,
      isTotemLoginMode,
      phone,
      router,
      validateInstance,
    ]
  );

  useEffect(() => {
    if (loginStep !== 2 || isRestoringSession) {
      return;
    }

    if (isTotemLoginMode) {
      focusPinInput();
      return;
    }

    if (hasStoredAccessPin === true || pinDeliveryUnlocked) {
      focusPinInput();
    }
  }, [
    focusPinInput,
    hasStoredAccessPin,
    isRestoringSession,
    isTotemLoginMode,
    loginStep,
    pinDeliveryUnlocked,
  ]);

  useEffect(() => {
    if (isRestoringSession || isSendingPin || isLoading || loginStep !== 2) {
      return;
    }

    if (accessPin.length !== ACCESS_PIN_LENGTH) {
      return;
    }

    if (!isBrazilianPhoneComplete(phone)) {
      return;
    }

    if (!canAttemptMemberPinLogin) {
      return;
    }

    void submitAccess(accessPin);
  }, [
    accessPin,
    canAttemptMemberPinLogin,
    isTotemLoginMode,
    loginStep,
    phone,
    isSendingPin,
    isLoading,
    isRestoringSession,
    submitAccess,
  ]);

  const isLikelyFirstAccess =
    !isTotemLoginMode
    && loginStep === 2
    && (needsEmailBeforePin || hasStoredAccessPin === false);

  const getLoginTitle = () => {
    if (isTotemLoginMode && loginStep === 2) {
      return 'Totem — Check-in';
    }

    if (loginStep === 2 && isLikelyFirstAccess) {
      return 'Seu primeiro acesso';
    }

    if (loginStep === 1) {
      return 'Sua Igreja mais perto de você !';
    }

    return 'Boas-vindas';
  };

  const getLoginSubtitle = () => {
    if (loginStep === 1) {
      return 'Entre usando o numero de celular cadastrado e aproveite todos os recursos disponiveis';
    }

    if (isTotemLoginMode) {
      return 'Aparelho do totem. Digite a senha 9999.';
    }

    if (isCheckingStoredPin) {
      return 'Estamos verificando seu cadastro...';
    }

    if (passwordRecoveredBanner) {
      return recoveryEmailMasked
        ? `Verifique o e-mail ${recoveryEmailMasked} e digite a nova senha de 4 dígitos.`
        : 'Verifique seu e-mail e digite a nova senha de 4 dígitos.';
    }

    if (showForgotPasswordHelp) {
      return 'Esqueceu a senha? Confirme seu e-mail e receba a nova senha por e-mail.';
    }

    if (isLikelyFirstAccess) {
      return firstAccessNeedsEmail
        ? 'Informe seu e-mail e toque no botão para receber o código de acesso.'
        : 'Toque no botão abaixo para receber o código de acesso por e-mail.';
    }

    return 'Digite sua senha de 4 dígitos para continuar.';
  };

  const getMemberPinHint = () => {
    if (isCheckingStoredPin) {
      return 'Aguarde um instante...';
    }

    if (passwordRecoveredBanner) {
      return recoveryEmailMasked
        ? `Enviamos a nova senha para ${recoveryEmailMasked}. Confira também a pasta de spam.`
        : 'Enviamos a nova senha por e-mail. Confira também a pasta de spam.';
    }

    if (showForgotPasswordHelp) {
      return 'Use "Esqueci minha senha" para confirmar seu e-mail e receber o código por e-mail.';
    }

    if (needsEmailBeforePin) {
      return firstAccessNeedsEmail
        ? 'O código chega no e-mail informado (não usamos WhatsApp para autenticação).'
        : firstAccessEmailMasked
          ? `O código será enviado para ${firstAccessEmailMasked}.`
          : 'O código chega por e-mail com 4 números.';
    }

    if (!isPinInputEditable) {
      return 'Toque no botão acima para receber seu código por e-mail.';
    }

    // Texto padrão fica no subtítulo abaixo das caixas OTP (`getLoginSubtitle`).
    return null;
  };

  const showLoginSubtitleAbove =
    loginStep === 1
    || isTotemLoginMode
    || isCheckingStoredPin
    || passwordRecoveredBanner
    || showForgotPasswordHelp
    || isLikelyFirstAccess;

  const showDefaultPinSubtitleBelow =
    loginStep === 2
    && !isTotemLoginMode
    && !isCheckingStoredPin
    && !passwordRecoveredBanner
    && !showForgotPasswordHelp
    && !isLikelyFirstAccess
    && isPinInputEditable;

  const renderEmailPinDelivery = (marginBottom = 16) => (
    <View style={{ marginBottom, width: '100%', gap: 10 }}>
      <>
        {firstAccessEmailMasked && !firstAccessNeedsEmail ? (
          <ReadOnlyText style={styles.pinHint}>
            Se o código não chegou, confirme ou altere o e-mail abaixo (último cadastro:{' '}
            {firstAccessEmailMasked}).
          </ReadOnlyText>
        ) : null}
        <View style={styles.inputContainer}>
          <ReadOnlyText style={styles.label}>E-mail</ReadOnlyText>
          <TextInput
            style={[styles.input, styles.editableInput]}
            placeholder="seu@email.com"
            placeholderTextColor={LOGIN_PLACEHOLDER}
            value={firstAccessEmail}
            onChangeText={(text) => {
              setFirstAccessEmail(text);
              setPinEmailFeedback(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>
        <View style={styles.inputContainer}>
          <ReadOnlyText style={styles.label}>Confirmar e-mail</ReadOnlyText>
          <TextInput
            style={[styles.input, styles.editableInput]}
            placeholder="repita o e-mail"
            placeholderTextColor={LOGIN_PLACEHOLDER}
            value={firstAccessEmailConfirm}
            onChangeText={(text) => {
              setFirstAccessEmailConfirm(text);
              setPinEmailFeedback(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>
      </>

      <TouchableOpacity
        accessibilityLabel="Receber código por e-mail"
        accessibilityRole="button"
        activeOpacity={0.85}
        disabled={isEmailPinButtonDisabled}
        onPress={() => handleEmailPinPress()}
        style={[
          styles.emailPrimaryButton,
          isEmailPinButtonDisabled && styles.emailPrimaryButtonDisabled,
        ]}
      >
        {isSendingPin ? (
          <ActivityIndicator color={LOGIN_SUBMIT_TEXT} size="small" />
        ) : (
          <>
            <FontAwesome name="envelope" size={20} color={LOGIN_SUBMIT_TEXT} />
            <Text style={styles.emailPrimaryButtonText}>Receber código por e-mail</Text>
          </>
        )}
      </TouchableOpacity>
      {pinEmailFeedback ? (
        <View
          style={[
            styles.pinEmailFeedbackBox,
            pinEmailFeedback.kind === 'error'
              ? styles.pinEmailFeedbackError
              : styles.pinEmailFeedbackSuccess,
          ]}
        >
          <Text
            style={[
              styles.pinEmailFeedbackTitle,
              pinEmailFeedback.kind === 'error'
                ? styles.pinEmailFeedbackTitleError
                : styles.pinEmailFeedbackTitleSuccess,
            ]}
          >
            {pinEmailFeedback.title}
          </Text>
          <Text style={styles.pinEmailFeedbackText}>{pinEmailFeedback.message}</Text>
        </View>
      ) : null}
    </View>
  );

  if (isRestoringSession) {
    return (
      <View style={styles.container}>
        <View style={styles.restoreLoader}>
          <ActivityIndicator color={LOGIN_ACCENT} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.logoWrapper}>
            <View style={styles.logoSurface}>
              <Image
                source={require('../images/captura.png')}
                style={styles.logo}
                contentFit="contain"
                accessibilityLabel="Conecta"
              />
            </View>
          </View>
          <ReadOnlyText style={styles.title}>{getLoginTitle()}</ReadOnlyText>
          {showLoginSubtitleAbove ? (
            <ReadOnlyText style={styles.subtitle}>{getLoginSubtitle()}</ReadOnlyText>
          ) : null}

          {loginStep === 1 ? (
            <>
              <View {...({ importantForAutofill: 'noExcludeDescendants' } as object)} style={styles.inputContainer}>
                <ReadOnlyText style={styles.label}>Código da instância</ReadOnlyText>
                <View style={styles.inputRowWithAction}>
                  <TextInput
                    ref={instanceInputRef}
                    style={[styles.input, styles.editableInput, styles.inputWithTrailingAction]}
                    placeholder="Ex.: IXB"
                    placeholderTextColor={LOGIN_PLACEHOLDER}
                    value={instanceCode}
                    onChangeText={handleInstanceCodeChange}
                    onBlur={handleInstanceBlur}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoComplete="off"
                    importantForAutofill="no"
                    spellCheck={false}
                    textAlign="center"
                    textContentType="none"
                    editable={!isValidating}
                    accessibilityLabel="Código da instância"
                  />
                  {isValidating ? (
                    <View style={styles.trailingActionButton}>
                      <ActivityIndicator color={LOGIN_ACCENT} size="small" />
                    </View>
                  ) : instanceCode ? (
                    <TouchableOpacity
                      accessibilityLabel="Apagar código da instância"
                      accessibilityRole="button"
                      onPress={() => handleInstanceCodeChange('')}
                      style={styles.trailingActionButton}
                    >
                      <Text style={styles.clearButtonText}>X</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {instanceName && isInstanceValid ? (
                  <ReadOnlyText style={styles.instanceHint}>{instanceName}</ReadOnlyText>
                ) : null}
                {instanceError ? (
                  <Text style={styles.instanceErrorText}>{instanceError}</Text>
                ) : null}
                {hasStoredInstance && isInstanceValid ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Alterar instância"
                    onPress={beginChangeInstance}
                    style={styles.changeInstanceLink}
                  >
                    <ReadOnlyText style={styles.changeInstanceLinkText}>Alterar instância</ReadOnlyText>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View {...({ importantForAutofill: 'noExcludeDescendants' } as object)} style={styles.inputContainer}>
                <ReadOnlyText style={styles.label}>Seu celular</ReadOnlyText>
                <View style={styles.inputRowWithAction}>
                  <TextInput
                    style={[styles.input, styles.editableInput, styles.inputWithTrailingAction]}
                    placeholder="(00) 00000-0000"
                    placeholderTextColor={LOGIN_PLACEHOLDER}
                    value={phone}
                    onChangeText={handlePhoneChange}
                    blurOnSubmit={false}
                    onSubmitEditing={advanceToPinStep}
                    returnKeyType="next"
                    autoComplete="off"
                    autoCorrect={false}
                    importantForAutofill="no"
                    contextMenuHidden
                    disableFullscreenUI
                    keyboardType="number-pad"
                    maxLength={15}
                    spellCheck={false}
                    textAlign="center"
                    textContentType="none"
                  />
                  <TouchableOpacity
                    accessibilityLabel="Apagar número digitado"
                    accessibilityRole="button"
                    disabled={!phone}
                    onPress={() => handlePhoneChange('')}
                    style={[styles.trailingActionButton, !phone && styles.trailingActionButtonDisabled]}>
                    <Text style={styles.clearButtonText}>X</Text>
                  </TouchableOpacity>
                </View>
                {phoneInstanceError ? (
                  <Text style={styles.instanceErrorText}>{phoneInstanceError}</Text>
                ) : null}
                {phoneTransferAvailable ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Solicitar Transferência"
                    disabled={isRequestingPhoneTransfer}
                    onPress={() => {
                      void requestMemberTransfer();
                    }}
                    style={styles.btnBiometric}
                  >
                    {isRequestingPhoneTransfer ? (
                      <ActivityIndicator color={LOGIN_ACCENT} size="small" />
                    ) : (
                      <Text style={styles.btnBiometricText}>Solicitar Transferência</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  (!isBrazilianMobilePhoneComplete(phone) || !instanceCode.trim() || isCheckingPhoneInstance) &&
                    styles.btnPrimaryDisabled,
                ]}
                onPress={advanceToPinStep}
                disabled={
                  !isBrazilianMobilePhoneComplete(phone)
                  || !instanceCode.trim()
                  || isValidating
                  || isCheckingPhoneInstance
                }
              >
                {isCheckingPhoneInstance ? (
                  <ActivityIndicator color={LOGIN_SUBMIT_TEXT} />
                ) : (
                  <Text style={styles.btnText}>Continuar</Text>
                )}
              </TouchableOpacity>

              {biometricLoginAvailable ? (
                <TouchableOpacity
                  accessibilityLabel={`Entrar com ${biometricLoginLabel}`}
                  accessibilityRole="button"
                  disabled={isBiometricUnlocking || isLoading}
                  onPress={() => {
                    void handleBiometricLogin();
                  }}
                  style={[
                    styles.btnBiometric,
                    (isBiometricUnlocking || isLoading) && styles.btnPrimaryDisabled,
                  ]}
                >
                  {isBiometricUnlocking ? (
                    <ActivityIndicator color={LOGIN_ACCENT} />
                  ) : (
                    <>
                      <FontAwesome name="lock" size={18} color={LOGIN_ACCENT} />
                      <Text style={styles.btnBiometricText}>Entrar com {biometricLoginLabel}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}

              {!isTotemLoginMode ? (
                <ReadOnlyText style={styles.helpText}>
                  É sua primeira vez? O Ministério de Acolhimento da Igreja pode ajudar.
                </ReadOnlyText>
              ) : null}
            </>
          ) : (
            <>
              <TouchableOpacity
                accessibilityLabel="Voltar para informar outro celular"
                accessibilityRole="button"
                onPress={goBackToPhoneStep}
                style={styles.backLink}
              >
                <ReadOnlyText style={styles.backLinkText}>← Voltar</ReadOnlyText>
              </TouchableOpacity>

              {!isTotemLoginMode ? (
                <>
                  {instanceCode ? (
                    <View pointerEvents="none" style={styles.phoneConfirmedRow}>
                      <FontAwesome name="check-circle" size={18} color={LOGIN_ACCENT} />
                      <ReadOnlyText style={styles.phoneConfirmedText}>
                        Instância: {instanceName || instanceCode}
                      </ReadOnlyText>
                    </View>
                  ) : null}
                  <View pointerEvents="none" style={styles.phoneConfirmedRow}>
                    <FontAwesome name="check-circle" size={18} color={LOGIN_ACCENT} />
                    <ReadOnlyText style={styles.phoneConfirmedText}>
                      {phoneBelongsToInstance ? 'Celular confirmado' : 'Celular informado'}: {phone}
                    </ReadOnlyText>
                  </View>
                </>
              ) : null}

              {!isTotemLoginMode && isCheckingStoredPin ? (
                <View style={styles.checkingPinCard}>
                  <ActivityIndicator color={LOGIN_ACCENT} size="small" />
                  <ReadOnlyText style={styles.checkingPinText}>Verificando seu acesso...</ReadOnlyText>
                </View>
              ) : null}

              {showEmailPinDelivery ? renderEmailPinDelivery() : null}

              {!isTotemLoginMode && pinCodeSent ? (
                <View pointerEvents="none" style={styles.pinSentBanner}>
                  <ReadOnlyText style={styles.pinSentBannerText}>
                    {firstAccessEmailMasked
                      ? `Código enviado para ${firstAccessEmailMasked}. Digite os 4 dígitos abaixo.`
                      : 'Código enviado por e-mail. Digite os 4 dígitos abaixo.'}
                  </ReadOnlyText>
                </View>
              ) : null}

              {!isTotemLoginMode && passwordRecoveredBanner ? (
                <View pointerEvents="none" style={styles.pinSentBanner}>
                  <ReadOnlyText style={styles.pinSentBannerText}>
                    {recoveryEmailMasked
                      ? `Nova senha enviada para ${recoveryEmailMasked}. Verifique seu e-mail e digite os 4 dígitos abaixo.`
                      : 'Nova senha enviada por e-mail. Verifique sua caixa de entrada e digite os 4 dígitos abaixo.'}
                  </ReadOnlyText>
                </View>
              ) : null}

              <View {...({ importantForAutofill: 'noExcludeDescendants' } as object)} style={styles.inputContainer}>
                <ReadOnlyText style={styles.label}>
                  {isTotemLoginMode
                    ? 'Senha do totem'
                    : isLikelyFirstAccess
                      ? 'Código de acesso'
                      : 'Sua senha'}
                </ReadOnlyText>
                {isPinInputEditable ? (
                  <View style={styles.otpRow}>
                    {Array.from({ length: ACCESS_PIN_LENGTH }).map((_, index) => {
                      const isFilled = index < accessPin.length;
                      const isActive =
                        index === Math.min(accessPin.length, ACCESS_PIN_LENGTH - 1)
                        && accessPin.length < ACCESS_PIN_LENGTH;

                      return (
                        <View
                          key={index}
                          style={[
                            styles.otpBox,
                            isFilled && styles.otpBoxFilled,
                            isActive && styles.otpBoxActive,
                          ]}
                        >
                          <ReadOnlyText style={styles.otpDigit}>
                            {isFilled ? '•' : ''}
                          </ReadOnlyText>
                        </View>
                      );
                    })}
                    <TextInput
                      ref={pinInputRef}
                      accessibilityLabel="Senha de 4 dígitos"
                      style={styles.otpHiddenInput}
                      value={accessPin}
                      onChangeText={handlePinChange}
                      autoComplete="off"
                      autoCorrect={false}
                      importantForAutofill="no"
                      contextMenuHidden
                      disableFullscreenUI
                      caretHidden
                      keyboardType="number-pad"
                      maxLength={ACCESS_PIN_LENGTH}
                      secureTextEntry
                      spellCheck={false}
                      textContentType="none"
                    />
                  </View>
                ) : (
                  <View
                    accessibilityLabel="Senha bloqueada até receber o código por e-mail"
                    accessibilityRole="text"
                    pointerEvents="none"
                    style={[styles.pinInput, styles.pinInputFullWidth, styles.pinLockedPanel]}
                  >
                    <ReadOnlyText style={styles.readOnlyInputText}>Aguardando código</ReadOnlyText>
                  </View>
                )}
                {showDefaultPinSubtitleBelow ? (
                  <ReadOnlyText style={styles.pinHintBelowOtp}>
                    Digite sua senha de 4 dígitos para continuar.
                  </ReadOnlyText>
                ) : isTotemLoginMode ? (
                  <ReadOnlyText style={styles.pinHint}>
                    Este aparelho não usa cadastro de membro.
                  </ReadOnlyText>
                ) : getMemberPinHint() ? (
                  <ReadOnlyText style={styles.pinHint}>{getMemberPinHint()}</ReadOnlyText>
                ) : null}
                {!isTotemLoginMode && showForgotPasswordLink ? (
                  <TouchableOpacity
                    accessibilityLabel="Esqueci minha senha"
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    onPress={() =>
                      router.push(
                        `/forgot-password?phone=${encodeURIComponent(phone.replace(/\D/g, ''))}`
                      )
                    }
                    style={styles.forgotPasswordBox}
                  >
                    <Text style={styles.forgotPasswordBoxText}>Esqueci minha senha</Text>
                  </TouchableOpacity>
                ) : null}
                {!isTotemLoginMode && pinCodeSent ? (
                  <TouchableOpacity
                    accessibilityLabel="Reenviar código por e-mail"
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    disabled={isSendingPin}
                    onPress={() => handleEmailPinPress()}
                    style={styles.forgotPasswordBox}
                  >
                    {isSendingPin ? (
                      <ActivityIndicator color={LOGIN_ACCENT} size="small" />
                    ) : (
                      <Text style={styles.forgotPasswordBoxText}>Não recebi — reenviar código</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
                {isLoading ? (
                  <ActivityIndicator color={LOGIN_ACCENT} style={styles.loginLoader} />
                ) : null}
              </View>

              {!isTotemLoginMode && biometricLoginAvailable ? (
                <TouchableOpacity
                  accessibilityLabel={`Entrar com ${biometricLoginLabel}`}
                  accessibilityRole="button"
                  disabled={isBiometricUnlocking || isLoading}
                  onPress={() => {
                    void handleBiometricLogin();
                  }}
                  style={[
                    styles.btnBiometric,
                    (isBiometricUnlocking || isLoading) && styles.btnPrimaryDisabled,
                  ]}
                >
                  {isBiometricUnlocking ? (
                    <ActivityIndicator color={LOGIN_ACCENT} />
                  ) : (
                    <>
                      <FontAwesome name="lock" size={18} color={LOGIN_ACCENT} />
                      <Text style={styles.btnBiometricText}>Entrar com {biometricLoginLabel}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}

              {!isTotemLoginMode && isLikelyFirstAccess ? (
                <ReadOnlyText style={styles.helpText}>
                  Depois deste acesso, você poderá escolher uma senha pessoal em Dados Cadastrais.
                </ReadOnlyText>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LOGIN_SURFACE,
  },
  restoreLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LOGIN_SURFACE,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
    backgroundColor: LOGIN_SURFACE,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
    paddingVertical: 12,
  },
  logoSurface: {
    width: '100%',
    maxWidth: 360,
    height: 132,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: LOGIN_ACCENT,
    textAlign: 'center',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    color: LOGIN_ACCENT,
    marginBottom: 8,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  inputRowWithAction: {
    position: 'relative',
    width: '100%',
  },
  inputWithTrailingAction: {
    width: '100%',
  },
  input: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 16,
    color: LOGIN_ACCENT,
    fontSize: 18,
    textAlign: 'center',
  },
  editableInput: {
    backgroundColor: LOGIN_SURFACE,
    borderWidth: 1,
    borderColor: LOGIN_SOFT_BORDER,
  },
  pinInput: {
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderColor: LOGIN_INPUT_BORDER,
  },
  pinInputFullWidth: {
    width: '100%',
  },
  otpRow: {
    position: 'relative',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  otpBox: {
    width: 58,
    height: 66,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LOGIN_INPUT_BORDER,
    backgroundColor: LOGIN_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: LOGIN_ACCENT,
    backgroundColor: 'rgba(58, 150, 221, 0.08)',
  },
  otpBoxActive: {
    borderWidth: 2,
    borderColor: LOGIN_SUBMIT_BG,
  },
  otpDigit: {
    color: LOGIN_ACCENT,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  otpHiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.011,
    color: 'transparent',
    fontSize: 1,
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? { caretColor: 'transparent' as const, cursor: 'pointer' as const }
      : {}),
  },
  pinLockedPanel: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.rowHover,
    borderWidth: 1,
    borderColor: LOGIN_INPUT_BORDER,
    borderStyle: 'dashed',
  },
  readOnlyInputText: {
    color: LOGIN_ACCENT,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    opacity: 0.72,
  },
  nonSelectableText: {
    userSelect: 'none',
  } as TextStyle,
  pinHint: {
    color: LOGIN_ACCENT,
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
    opacity: 0.85,
  },
  pinHintBelowOtp: {
    color: LOGIN_ACCENT,
    fontSize: 16,
    marginTop: 14,
    lineHeight: 21,
    textAlign: 'center',
    opacity: 0.95,
  },
  loginLoader: {
    marginTop: 12,
    alignSelf: 'center',
  },
  backLink: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  backLinkText: {
    color: LOGIN_ACCENT,
    fontSize: 15,
    fontWeight: '600',
  },
  phoneConfirmedRow: {
    width: '100%',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  phoneConfirmedText: {
    color: LOGIN_ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },
  instanceHint: {
    color: LOGIN_ACCENT,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  instanceErrorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
  changeInstanceLink: {
    alignSelf: 'center',
    marginTop: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  changeInstanceLinkText: {
    color: LOGIN_ACCENT,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  checkingPinCard: {
    width: '100%',
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: LOGIN_SURFACE,
    borderWidth: 1,
    borderColor: LOGIN_SOFT_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  checkingPinText: {
    color: LOGIN_ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },
  emailPrimaryButton: {
    width: '100%',
    marginBottom: 0,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: LOGIN_SUBMIT_BG,
    borderWidth: 2,
    borderColor: LOGIN_ICON,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  emailPrimaryButtonDisabled: {
    opacity: 0.55,
  },
  emailPrimaryButtonText: {
    color: LOGIN_SUBMIT_TEXT,
    fontSize: 16,
    fontWeight: '800',
  },
  pinEmailFeedbackBox: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  pinEmailFeedbackError: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderColor: 'rgba(220, 38, 38, 0.35)',
  },
  pinEmailFeedbackSuccess: {
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    borderColor: 'rgba(22, 163, 74, 0.35)',
  },
  pinEmailFeedbackTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  pinEmailFeedbackTitleError: {
    color: '#B91C1C',
  },
  pinEmailFeedbackTitleSuccess: {
    color: '#166534',
  },
  pinEmailFeedbackText: {
    fontSize: 13,
    lineHeight: 18,
    color: MINIMAL_UI.text,
  },
  pinSentBanner: {
    width: '100%',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(58, 150, 221, 0.08)',
    borderWidth: 1,
    borderColor: LOGIN_SOFT_BORDER,
  },
  pinSentBannerText: {
    color: LOGIN_ACCENT,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  forgotPasswordBox: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: LOGIN_SURFACE,
    borderWidth: 1,
    borderColor: LOGIN_SOFT_BORDER,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  forgotPasswordBoxText: {
    color: LOGIN_ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
  trailingActionButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 56,
    zIndex: 10,
    elevation: 10,
    borderRadius: 16,
    backgroundColor: LOGIN_SURFACE,
    borderWidth: 1,
    borderColor: LOGIN_SOFT_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  trailingActionButtonDisabled: {
    opacity: 0.45,
  },
  clearButtonText: {
    color: LOGIN_ACCENT,
    fontSize: 18,
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: LOGIN_SUBMIT_BG,
    borderWidth: 2,
    borderColor: LOGIN_ICON,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  btnPrimaryDisabled: {
    opacity: 0.45,
  },
  btnBiometric: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: LOGIN_INPUT_BORDER,
    backgroundColor: '#F8FBFF',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  btnBiometricText: {
    color: LOGIN_ICON,
    fontWeight: '700',
    fontSize: 15,
  },
  btnText: {
    color: LOGIN_SUBMIT_TEXT,
    fontWeight: 'bold',
    fontSize: 16,
  },
  helpText: {
    marginTop: 18,
    color: '#00008B',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
