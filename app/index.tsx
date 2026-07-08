import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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

const LOGIN_SURFACE = '#FFFFFF';
const LOGIN_ACCENT = VIGILANCE_SCALES_UI.accent;
const LOGIN_ICON = '#1B4F8A';
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
import { SocialBrandIcon } from '@/components/SocialBrandIcon';
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
  SIGN_OUT_QUERY_PARAM,
} from '@/lib/userSession';
import {
  getCelTotemPhone,
  isTotemDevicePhone,
  isValidTotemAccessPin,
  normalizePhoneDigits,
  persistTotemDeviceSession,
} from '@/lib/totemDevice';

export default function IndexScreen() {
  const { [SIGN_OUT_QUERY_PARAM]: signedOutParam, phone: phoneParam, recovered: recoveredParam, email: emailParam } =
    useLocalSearchParams<{
      [SIGN_OUT_QUERY_PARAM]?: string | string[];
      phone?: string | string[];
      recovered?: string | string[];
      email?: string | string[];
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
  const [celTotemPhone, setCelTotemPhone] = useState<string | null>(null);
  const [isTotemConfigLoading, setIsTotemConfigLoading] = useState(() => !skipSessionRestore);
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
  const isTotemLoginMode = Boolean(
    celTotemPhone && normalizePhoneDigits(phone) === celTotemPhone
  );
  const phoneDigits = normalizePhoneDigits(phone);
  const needsEmailBeforePin =
    !isTotemLoginMode && !pinDeliveryUnlocked && hasStoredAccessPin === false;
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
  const canPressEntrar =
    loginStep === 2
    && isValidAccessPin(accessPin)
    && !isLoading
    && (isTotemLoginMode || canAttemptMemberPinLogin);
  const isEmailPinButtonDisabled = isSendingPin;
  const isVerifyingPinRef = useRef(false);
  const pinInputRef = useRef<TextInput>(null);
  const router = useRouter();

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
      options?: { afterPasswordRecovery?: boolean; recoveryPin?: string }
    ) => {
      await persistUserSession(profile, phoneForSession, sessionToken);
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

      const lgpdAtivo = await isLgpdAtivoEnabled();
      const route = resolveRegisteredUserSessionRoute(profile, phoneForSession, lgpdAtivo);

      if (!route) {
        return false;
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

        if (hasPin === true) {
          setHasStoredAccessPin(true);
          setPinDeliveryUnlocked(true);
          setFirstAccessNeedsEmail(false);
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
    if (skipSessionRestore) {
      setIsTotemConfigLoading(false);
      setIsRestoringSession(false);
      return;
    }

    let active = true;

    void (async () => {
      try {
        const configuredTotemPhone = await getCelTotemPhone();

        if (!active) {
          return;
        }

        setCelTotemPhone(configuredTotemPhone);

        const storedPhone = await getStoredUserPhone();

        if (
          storedPhone &&
          configuredTotemPhone &&
          normalizePhoneDigits(storedPhone) === configuredTotemPhone
        ) {
          router.replace('/totem-checkin');
        }
      } catch (error) {
        console.error('Erro ao restaurar sessão:', error);
      } finally {
        if (active) {
          setIsTotemConfigLoading(false);
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

    if (firstAccessNeedsEmail) {
      const email = firstAccessEmail.trim();
      const emailConfirm = firstAccessEmailConfirm.trim();

      if (!email || !emailConfirm) {
        Alert.alert('Atenção', 'Informe e confirme o e-mail para receber o código de acesso.');
        return;
      }

      if (email.toLowerCase() !== emailConfirm.toLowerCase()) {
        Alert.alert('Atenção', 'Os e-mails informados não coincidem.');
        return;
      }
    }

    void (async () => {
      setIsSendingPin(true);

      try {
        const result = await dispatchAuthAccessPinEmail({
          phone,
          email: firstAccessNeedsEmail ? firstAccessEmail : undefined,
          emailConfirm: firstAccessNeedsEmail ? firstAccessEmailConfirm : undefined,
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
          result.emailMasked
            ? `Enviamos o código de 4 dígitos para ${result.emailMasked}. Confira também a pasta de spam.`
            : 'Enviamos o código de 4 dígitos por e-mail. Confira também a pasta de spam.'
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

  const handleOpenSocial = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Erro ao abrir rede social:', error);
      Alert.alert('Erro', 'Não foi possível abrir o link neste dispositivo.');
    }
  }, []);

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

          const entered = await persistTotemDeviceSession();

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
            'Toque em "Esqueci minha senha" para validar sua pergunta de segurança e receber a nova senha por e-mail.'
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

  const handleAccess = () => {
    if (!isValidAccessPin(accessPin)) {
      Alert.alert('Atenção', 'Digite a senha de acesso de 4 dígitos.');
      return;
    }

    void submitAccess(accessPin);
  };

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

    return 'Boas-vindas';
  };

  const getLoginSubtitle = () => {
    if (loginStep === 1) {
      return 'Informe seu celular para começar';
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
      return 'Esqueceu a senha? Valide a pergunta de segurança e receba a nova senha por e-mail.';
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
      return 'Use "Esqueci minha senha" para validar a pergunta de segurança e receber o código por e-mail.';
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

    return 'Digite os 4 números da sua senha.';
  };

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
      {firstAccessNeedsEmail ? (
        <>
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
      ) : null}

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

  const renderSocialLinks = () => (
    <View style={styles.socialFooter}>
      <View style={styles.socialRow}>
        <View style={styles.socialLinksCenter}>
          <TouchableOpacity
            accessibilityLabel="Abrir Instagram da Igreja Batista Norte"
            accessibilityRole="button"
            onPress={() => {
              void handleOpenSocial('https://www.instagram.com/igrejabatistanorte');
            }}
            style={styles.socialButton}
          >
            <SocialBrandIcon network="instagram" />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel="Abrir YouTube da Igreja Batista Norte"
            accessibilityRole="button"
            onPress={() => {
              void handleOpenSocial('https://www.youtube.com/@ibnorte');
            }}
            style={styles.socialButton}
          >
            <SocialBrandIcon network="youtube" />
          </TouchableOpacity>
        </View>
      </View>
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
            <Image
              source={require('../images/IBNORTE - LOGO MARCA 9.png')}
              style={styles.logo}
              contentFit="contain"
              tintColor={LOGIN_ICON}
            />
          </View>
          <ReadOnlyText style={styles.title}>{getLoginTitle()}</ReadOnlyText>
          <ReadOnlyText style={styles.subtitle}>{getLoginSubtitle()}</ReadOnlyText>

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

              {!isTotemLoginMode ? (
                <ReadOnlyText style={styles.helpText}>
                  É sua primeira vez? O Ministério de Acolhimento da Igreja pode ajudar.
                </ReadOnlyText>
              ) : null}

              {!isTotemLoginMode ? renderSocialLinks() : null}
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
                  <TextInput
                    ref={pinInputRef}
                    style={[styles.input, styles.editableInput, styles.pinInput, styles.pinInputFullWidth]}
                    placeholder="****"
                    placeholderTextColor={LOGIN_PLACEHOLDER}
                    value={accessPin}
                    onChangeText={handlePinChange}
                    autoComplete="off"
                    autoCorrect={false}
                    importantForAutofill="no"
                    contextMenuHidden
                    disableFullscreenUI
                    keyboardType="number-pad"
                    maxLength={ACCESS_PIN_LENGTH}
                    secureTextEntry
                    spellCheck={false}
                    textAlign="center"
                    textContentType="none"
                  />
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
                <ReadOnlyText style={styles.pinHint}>
                  {isTotemLoginMode
                    ? 'Este aparelho não usa cadastro de membro.'
                    : getMemberPinHint()}
                </ReadOnlyText>
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
                {!isTotemLoginMode && isLoading ? (
                  <ActivityIndicator color={LOGIN_ACCENT} style={styles.loginLoader} />
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, !canPressEntrar && styles.btnPrimaryDisabled]}
                onPress={handleAccess}
                disabled={!canPressEntrar}
              >
                {isLoading ? (
                  <ActivityIndicator color={LOGIN_SUBMIT_TEXT} />
                ) : (
                  <Text style={styles.btnText}>
                    {isTotemLoginMode ? 'Abrir tela do totem' : 'Acessar'}
                  </Text>
                )}
              </TouchableOpacity>

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
  logo: {
    width: '100%',
    maxWidth: 300,
    height: 110,
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
  },
  pinInputFullWidth: {
    width: '100%',
  },
  pinLockedPanel: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.rowHover,
    borderWidth: 1,
    borderColor: LOGIN_SOFT_BORDER,
    borderStyle: 'dashed',
  },
  readOnlyInputText: {
    color: LOGIN_ACCENT,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    opacity: 0.72,
  },
  nonSelectableText: Platform.select({
    web: {
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    },
    default: {},
  }),
  pinHint: {
    color: LOGIN_ACCENT,
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
    opacity: 0.85,
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
  socialFooter: {
    marginTop: 24,
    width: '100%',
    alignSelf: 'stretch',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 44,
  },
  socialLinksCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  socialButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
});
