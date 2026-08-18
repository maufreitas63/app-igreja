import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { WEB_NON_SELECTABLE_VIEW_STYLES } from '@/lib/webTextSelectionGuard';

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

export default function IndexScreen() {
  const {
    [SIGN_OUT_QUERY_PARAM]: signedOutParam,
    phone: phoneParam,
    recovered: recoveredParam,
    email: emailParam,
    igreja: igrejaParam,
  } = useLocalSearchParams<{
      [SIGN_OUT_QUERY_PARAM]?: string | string[];
      phone?: string | string[];
      recovered?: string | string[];
      email?: string | string[];
      igreja?: string | string[];
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
  const [isTotemConfigLoading, setIsTotemConfigLoading] = useState(true);
  const [hasStoredAccessPin, setHasStoredAccessPin] = useState<boolean | null>(null);
  const [pinDeliveryUnlocked, setPinDeliveryUnlocked] = useState(false);
  const [loginStep, setLoginStep] = useState<1 | 2>(1);
  const [pinCodeSent, setPinCodeSent] = useState(false);
  const [showForgotPasswordHelp, setShowForgotPasswordHelp] = useState(false);
  const [passwordRecoveredBanner, setPasswordRecoveredBanner] = useState(false);
  const [recoveryEmailMasked, setRecoveryEmailMasked] = useState('');
  const [firstAccessNeedsEmail, setFirstAccessNeedsEmail] = useState(false);
  const [firstAccessEmail, setFirstAccessEmail] = useState('');
  const [firstAccessEmailConfirm, setFirstAccessEmailConfirm] = useState('');
  const [firstAccessEmailMasked, setFirstAccessEmailMasked] = useState('');
  const [biometricLoginAvailable, setBiometricLoginAvailable] = useState(false);
  const [biometricLoginLabel, setBiometricLoginLabel] = useState('Biometria');
  const [isBiometricUnlocking, setIsBiometricUnlocking] = useState(false);
  const isTotemLoginMode = celTotemPhones.some((totem) => phoneDigitsMatch(phone, totem));
  const phoneDigits = normalizePhoneDigits(phone);
  const needsEmailBeforePin =
    !isTotemLoginMode
    && !pinDeliveryUnlocked
    && (hasStoredAccessPin === false || firstAccessNeedsEmail);
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
  const pinInputRef = useRef<TextInput>(null);
  const router = useRouter();

  const focusPinInput = useCallback(() => {
    requestAnimationFrame(() => {
      pinInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    void import('@/lib/tenantSession').then(({ capturePreferredIgrejaCodeFromLocation }) =>
      capturePreferredIgrejaCodeFromLocation(igrejaParam)
    );
  }, [igrejaParam]);

  const goBackToPhoneStep = useCallback(() => {
    setPhone('');
    setLoginStep(1);
    setAccessPin('');
    setPinCodeSent(false);
    setShowForgotPasswordHelp(false);
    setPasswordRecoveredBanner(false);
    setRecoveryEmailMasked('');
    setFirstAccessNeedsEmail(false);
    setFirstAccessEmail('');
    setFirstAccessEmailConfirm('');
    setFirstAccessEmailMasked('');
    setPinDeliveryUnlocked(false);
    setHasStoredAccessPin(null);
  }, []);

  const advanceToPinStep = useCallback(() => {
    if (!isBrazilianMobilePhoneComplete(phone)) {
      Alert.alert('Atenção', 'Digite o celular completo com 11 dígitos.');
      return;
    }

    // Persiste o celular localmente para autofill na próxima abertura.
    void persistUserPhone(phone);

    setLoginStep(2);

    if (isTotemLoginMode) {
      focusPinInput();
    }
  }, [focusPinInput, isTotemLoginMode, phone]);

  const handlePhoneChange = (text: string) => {
    setPhone(formatBrazilPhoneInput(text));
    setLoginStep(1);
    setAccessPin('');
    setPinCodeSent(false);
    setShowForgotPasswordHelp(false);
    setPasswordRecoveredBanner(false);
    setRecoveryEmailMasked('');
    setFirstAccessNeedsEmail(false);
    setFirstAccessEmail('');
    setFirstAccessEmailConfirm('');
    setFirstAccessEmailMasked('');
    setPinDeliveryUnlocked(false);
    setHasStoredAccessPin(null);
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
      let route = resolveRegisteredUserSessionRoute(profile, phoneForSession, lgpdAtivo);

      if (!route) {
        return false;
      }

      // Após LGPD/cadastro ok: se há mais de uma igreja, escolher instância
      if (route.pathname === '/(tabs)' || route.pathname === '/(tabs)/dashboard') {
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
              route = buildSelecionarIgrejaRoute(phoneForSession);
            }
          } else if (preferredMatch) {
            await applyTenant(preferredMatch);
          } else if (primaryMatch) {
            await applyTenant(primaryMatch);
          } else if (churches.length === 1 && churches[0]) {
            await applyTenant(churches[0]);
          } else if (await shouldPromptTenantSelection()) {
            route = buildSelecionarIgrejaRoute(phoneForSession);
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
          setPinDeliveryUnlocked(true);
          setFirstAccessEmailMasked('');
          return;
        }

        if (hasPin === true) {
          setHasStoredAccessPin(true);

          // PIN no banco mas sem e-mail: ainda precisa do fluxo de 1º acesso.
          if (deliveryState.ok && deliveryState.needsEmail) {
            setPinDeliveryUnlocked(false);
            setFirstAccessNeedsEmail(true);
            setFirstAccessEmailMasked('');
          } else {
            setPinDeliveryUnlocked(true);
            setFirstAccessNeedsEmail(false);
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
            setFirstAccessEmailMasked(deliveryState.emailMasked);
          } else {
            setFirstAccessNeedsEmail(true);
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
  }, [continueWithExistingProfile, focusPinInput, isLoading, isBiometricUnlocking]);

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
      } finally {
        if (active) {
          setIsTotemConfigLoading(false);
        }
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
        if (active) {
          setIsRestoringSession(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [continueWithExistingProfile, router, skipSessionRestore]);

  const handleEmailPinPress = () => {
    if (!isBrazilianPhoneComplete(phone)) {
      Alert.alert('Atenção', 'Informe um número de celular válido antes de solicitar o código.');
      return;
    }

    const typedEmail = firstAccessEmail.trim();
    const typedConfirm = firstAccessEmailConfirm.trim();

    // Sempre exige e-mail + confirmação neste botão (evita enviar ao e-mail antigo do perfil).
    if (!typedEmail || !typedConfirm) {
      Alert.alert('Atenção', 'Informe e confirme o e-mail para receber o código de acesso.');
      return;
    }

    if (typedEmail.toLowerCase() !== typedConfirm.toLowerCase()) {
      Alert.alert('Atenção', 'Os e-mails informados não coincidem.');
      return;
    }

    void (async () => {
      setIsSendingPin(true);

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

          Alert.alert(
            'Não foi possível enviar o código',
            result.message.includes('AUTH_CHANNEL_BLOCKED')
              ? 'O envio por WhatsApp foi desativado. Use apenas e-mail.'
              : result.message.includes('auth-pin-email-only')
                ? AUTH_PIN_EMAIL_SQL_HINT
                : result.message
          );
          return;
        }

        setFirstAccessNeedsEmail(false);
        setFirstAccessEmailMasked(result.emailMasked);
        setPinDeliveryUnlocked(true);
        setHasStoredAccessPin(true);
        setPinCodeSent(true);
        setAccessPin('');
        focusPinInput();

        Alert.alert(
          'Código enviado por e-mail',
          [
            result.emailMasked
              ? `Enviamos o código de 4 dígitos para ${result.emailMasked}.`
              : 'Enviamos o código de 4 dígitos por e-mail.',
            'Confira a caixa de entrada e a pasta de spam/lixo eletrônico.',
            'O assunto é: "Seu código de acesso — Conecta Mais".',
          ].join('\n\n')
        );
      } catch (err: unknown) {
        console.error('Erro ao enviar código por e-mail:', err);
        const message = err instanceof Error ? err.message : '';
        Alert.alert(
          'Erro',
          message.includes('AUTH_CHANNEL_BLOCKED')
            ? 'O envio por WhatsApp foi desativado. Use apenas e-mail.'
            : AUTH_PIN_EMAIL_SQL_HINT
        );
      } finally {
        setIsSendingPin(false);
      }
    })();
  };

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
      isPasswordRecovered,
      isTotemLoginMode,
      phone,
      router,
    ]
  );

  useEffect(() => {
    if (loginStep !== 2 || isRestoringSession || isTotemConfigLoading) {
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
    isTotemConfigLoading,
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

  const renderStepIndicator = () => (
    <View pointerEvents="none" style={styles.stepIndicatorRow}>
      <View style={styles.stepIndicatorItem}>
        <View style={[styles.stepNumberCircle, loginStep === 1 && styles.stepNumberCircleActive]}>
          <ReadOnlyText
            style={[styles.stepNumberText, loginStep === 1 && styles.stepNumberTextActive]}
          >
            1
          </ReadOnlyText>
        </View>
        <ReadOnlyText style={[styles.stepChipLabel, loginStep === 1 && styles.stepChipLabelActive]}>
          Celular
        </ReadOnlyText>
      </View>
      <View style={styles.stepConnector} />
      <View style={styles.stepIndicatorItem}>
        <View style={[styles.stepNumberCircle, loginStep === 2 && styles.stepNumberCircleActive]}>
          <ReadOnlyText
            style={[styles.stepNumberText, loginStep === 2 && styles.stepNumberTextActive]}
          >
            2
          </ReadOnlyText>
        </View>
        <ReadOnlyText style={[styles.stepChipLabel, loginStep === 2 && styles.stepChipLabelActive]}>
          Código
        </ReadOnlyText>
      </View>
    </View>
  );

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
            onChangeText={setFirstAccessEmail}
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
            onChangeText={setFirstAccessEmailConfirm}
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
        onPress={handleEmailPinPress}
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
    </View>
  );

  if (isRestoringSession || isTotemConfigLoading) {
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
        importantForAutofill="noExcludeDescendants"
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

          {!isTotemLoginMode ? renderStepIndicator() : null}

          {loginStep === 1 ? (
            <>
              <View importantForAutofill="noExcludeDescendants" style={styles.inputContainer}>
                <ReadOnlyText style={styles.label}>1. Seu celular</ReadOnlyText>
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
              </View>

              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  !isBrazilianMobilePhoneComplete(phone) && styles.btnPrimaryDisabled,
                ]}
                onPress={advanceToPinStep}
                disabled={!isBrazilianMobilePhoneComplete(phone)}
              >
                <Text style={styles.btnText}>Continuar</Text>
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
                <View pointerEvents="none" style={styles.phoneConfirmedRow}>
                  <FontAwesome name="check-circle" size={18} color={LOGIN_ACCENT} />
                  <ReadOnlyText style={styles.phoneConfirmedText}>
                    Celular confirmado: {phone}
                  </ReadOnlyText>
                </View>
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

              <View importantForAutofill="noExcludeDescendants" style={styles.inputContainer}>
                <ReadOnlyText style={styles.label}>
                  {isTotemLoginMode
                    ? 'Senha do totem'
                    : isLikelyFirstAccess
                      ? '2. Código de acesso'
                      : '2. Sua senha'}
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
                    onPress={handleEmailPinPress}
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
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    color: LOGIN_ACCENT,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputRowWithAction: {
    position: 'relative',
    width: '100%',
  },
  inputWithTrailingAction: {
    width: '100%',
    paddingRight: 68,
  },
  input: {
    padding: 20,
    borderRadius: 16,
    color: LOGIN_ACCENT,
    fontSize: 18,
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
  nonSelectableText: WEB_NON_SELECTABLE_VIEW_STYLES,
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
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 10,
  },
  stepIndicatorItem: {
    alignItems: 'center',
    minWidth: 88,
  },
  stepNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: LOGIN_SOFT_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LOGIN_SURFACE,
  },
  stepNumberCircleActive: {
    borderColor: LOGIN_ACCENT,
    backgroundColor: LOGIN_SUBMIT_BG,
  },
  stepNumberText: {
    color: LOGIN_ACCENT,
    fontSize: 14,
    fontWeight: '800',
    opacity: 0.65,
  },
  stepNumberTextActive: {
    color: LOGIN_SUBMIT_TEXT,
    opacity: 1,
  },
  stepChipLabel: {
    color: LOGIN_ACCENT,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.65,
  },
  stepChipLabelActive: {
    color: LOGIN_ICON,
    opacity: 1,
  },
  stepConnector: {
    width: 36,
    height: 2,
    backgroundColor: LOGIN_SOFT_BORDER,
    marginTop: 15,
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
