import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  ACCESS_PIN_LENGTH,
  buildAccessPinDeliveryAlertMessage,
  getAccessPinWhatsappRecipientDigits,
  isValidAccessPin,
  loadAccessPinDeliverySettings,
  prepareAccessPinDraft,
  profileHasAccessPin,
  sendAccessPinViaWhatsApp,
  type AccessPinDeliverySettings,
  type PreparedAccessPinDraft,
} from '@/lib/accessPin';
import { openWhatsAppLikeBirthdays, openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { isBrazilianMobilePhoneComplete, isBrazilianPhoneComplete } from '@/lib/phoneValidation';
import { verificarLogin } from '@/lib/verificarLogin';
import { resolveRegisteredUserSessionRoute } from '@/lib/profileOnboarding';
import {
  getStoredUserPhone,
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

/** Cores oficiais / padrão de marca (ícone sólido). */
const SOCIAL_BRAND_COLORS = {
  instagram: '#E4405F',
  youtube: '#FF0000',
} as const;

export default function IndexScreen() {
  const { [SIGN_OUT_QUERY_PARAM]: signedOutParam } = useLocalSearchParams<{
    [SIGN_OUT_QUERY_PARAM]?: string | string[];
  }>();
  const skipSessionRestore =
    signedOutParam === '1' || (Array.isArray(signedOutParam) && signedOutParam.includes('1'));
  const [phone, setPhone] = useState('');
  const [accessPin, setAccessPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingPin, setIsSendingPin] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(() => !skipSessionRestore);
  const [celTotemPhone, setCelTotemPhone] = useState<string | null>(null);
  const [isTotemConfigLoading, setIsTotemConfigLoading] = useState(() => !skipSessionRestore);
  const [hasStoredAccessPin, setHasStoredAccessPin] = useState<boolean | null>(null);
  const [pinDeliveryUnlocked, setPinDeliveryUnlocked] = useState(false);
  const [pinDeliverySettings, setPinDeliverySettings] = useState<AccessPinDeliverySettings | null>(
    null
  );
  const [isPinDeliverySettingsLoading, setIsPinDeliverySettingsLoading] = useState(true);
  const [loginStep, setLoginStep] = useState<1 | 2>(1);
  const [pinCodeSent, setPinCodeSent] = useState(false);
  const [showForgotPasswordHelp, setShowForgotPasswordHelp] = useState(false);
  const isTotemLoginMode = Boolean(
    celTotemPhone && normalizePhoneDigits(phone) === celTotemPhone
  );
  const phoneDigits = normalizePhoneDigits(phone);
  const whatsappRecipientDigits = pinDeliverySettings
    ? getAccessPinWhatsappRecipientDigits(pinDeliverySettings, phoneDigits)
    : null;
  const needsWhatsappBeforePin =
    !isTotemLoginMode && !pinDeliveryUnlocked && hasStoredAccessPin === false;
  const isCheckingStoredPin =
    loginStep === 2 && !isTotemLoginMode && isBrazilianPhoneComplete(phone) && hasStoredAccessPin === null;
  const showWhatsappAbovePin =
    !isTotemLoginMode && needsWhatsappBeforePin && !isCheckingStoredPin && !showForgotPasswordHelp;
  const showWhatsappBelowPin =
    !isTotemLoginMode && showForgotPasswordHelp && !isCheckingStoredPin;
  const canAttemptMemberPinLogin =
    isTotemLoginMode || (isBrazilianPhoneComplete(phone) && !needsWhatsappBeforePin);
  const isPinInputEditable =
    loginStep === 2
    && (isTotemLoginMode
      || (hasStoredAccessPin !== null && (!needsWhatsappBeforePin || pinDeliveryUnlocked)));
  const canPressEntrar =
    loginStep === 2
    && isValidAccessPin(accessPin)
    && !isLoading
    && (isTotemLoginMode || canAttemptMemberPinLogin);
  const isWhatsappButtonDisabled =
    isSendingPin || isPinDeliverySettingsLoading || !whatsappRecipientDigits;
  const isVerifyingPinRef = useRef(false);
  const pinInputRef = useRef<TextInput>(null);
  const preparedPinDraftRef = useRef<PreparedAccessPinDraft | null>(null);
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
    setPinDeliveryUnlocked(false);
    setHasStoredAccessPin(null);
    preparedPinDraftRef.current = null;
  }, []);

  const advanceToPinStep = useCallback(() => {
    if (!isBrazilianMobilePhoneComplete(phone)) {
      Alert.alert('Atenção', 'Digite o celular completo com 11 dígitos.');
      return;
    }

    setLoginStep(2);

    if (isTotemLoginMode) {
      focusPinInput();
    }
  }, [focusPinInput, isTotemLoginMode, phone]);

  const handlePhoneChange = (text: string) => {
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 11) cleaned = cleaned.substring(0, 11);

    let formatted = cleaned;
    if (cleaned.length > 0) {
      formatted = `(${cleaned.substring(0, 2)}`;
      if (cleaned.length > 2) formatted += `) ${cleaned.substring(2, 7)}`;
      if (cleaned.length > 7) formatted += `-${cleaned.substring(7, 11)}`;
    }
    setPhone(formatted);
    setLoginStep(1);
    setAccessPin('');
    setPinCodeSent(false);
    setShowForgotPasswordHelp(false);
    setPinDeliveryUnlocked(false);
    setHasStoredAccessPin(null);
    preparedPinDraftRef.current = null;
  };

  const handlePinChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, ACCESS_PIN_LENGTH);
    setAccessPin(digits);
  };

  const continueWithExistingProfile = useCallback(
    async (profile: Record<string, unknown>, phoneForSession: string) => {
      await persistUserSession(profile, phoneForSession);

      const route = resolveRegisteredUserSessionRoute(profile, phoneForSession);

      if (!route) {
        return false;
      }

      router.replace(route);
      return true;
    },
    [router]
  );

  useEffect(() => {
    if (isTotemLoginMode || !isBrazilianPhoneComplete(phone)) {
      setHasStoredAccessPin(null);
      return;
    }

    let active = true;

    void (async () => {
      try {
        const hasPin = await profileHasAccessPin(phoneDigits);

        if (!active) {
          return;
        }

        if (hasPin === true) {
          setHasStoredAccessPin(true);
          setPinDeliveryUnlocked(true);
          return;
        }

        if (hasPin === false) {
          setHasStoredAccessPin(false);
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

  useEffect(() => {
    if (isTotemLoginMode) {
      return;
    }

    let active = true;
    setIsPinDeliverySettingsLoading(true);

    void (async () => {
      try {
        const settings = await loadAccessPinDeliverySettings();

        if (active) {
          setPinDeliverySettings(settings);
        }
      } catch (error) {
        console.error('Erro ao carregar psw_user/psw_mngr:', error);

        if (active) {
          setPinDeliverySettings(null);
        }
      } finally {
        if (active) {
          setIsPinDeliverySettingsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [isTotemLoginMode]);

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

  const handleWhatsappPress = () => {
    if (!isBrazilianPhoneComplete(phone)) {
      Alert.alert('Atenção', 'Informe um número de celular válido antes de solicitar o código.');
      return;
    }

    if (!whatsappRecipientDigits) {
      Alert.alert(
        'WhatsApp indisponível',
        pinDeliverySettings?.sendToUser
          ? 'Confira o celular digitado ou defina psw_user = sim em app_parameters.'
          : 'Com psw_user = nao, cadastre psw_mngr em app_parameters (ex.: 19996166161, só dígitos).'
      );
      return;
    }

    const sendToUser = pinDeliverySettings?.sendToUser ?? false;

    // Gestor (psw_user = nao): abre o MESMO Zap (psw_mngr) para qualquer celular digitado.
    const whatsappOpenedOnPress = sendToUser
      ? false
      : Boolean(openWhatsAppLikeBirthdays(whatsappRecipientDigits));

    void (async () => {
      setIsSendingPin(true);

      try {
        const preparedResult = await prepareAccessPinDraft(phone);

        if (!preparedResult.ok) {
          Alert.alert('Erro ao gerar código', preparedResult.message);
          return;
        }

        const prepared = preparedResult.draft;
        preparedPinDraftRef.current = prepared;

        let whatsappOpened = whatsappOpenedOnPress;

        if (sendToUser) {
          whatsappOpened = Boolean(
            openWhatsAppLikeBirthdaysWithText(whatsappRecipientDigits, prepared.message)
          );

          if (!whatsappOpened) {
            Alert.alert(
              'WhatsApp indisponível',
              'Não foi possível abrir o Zap para o celular informado.'
            );
            return;
          }
        }

        await finishAccessPinWhatsappRequest(whatsappOpened, prepared);
      } finally {
        setIsSendingPin(false);
      }
    })();
  };

  const finishAccessPinWhatsappRequest = async (
    whatsappOpenedOnPress: boolean,
    preparedOnPress: PreparedAccessPinDraft
  ) => {
    try {
      const prepared = preparedOnPress;

      const result = await sendAccessPinViaWhatsApp(phone, {
        skipOpenWhatsApp: true,
        prepared: prepared ?? undefined,
      });

      if (!result.ok) {
        if (result.reason === 'missing_manager_phone') {
          Alert.alert(
            'Gestor não configurado',
            'Com psw_user = "nao", o app envia a senha temporária para o WhatsApp em psw_mngr. Cadastre o celular do gestor em app_parameters (psw_mngr) no Supabase.'
          );
          return;
        }

        if (result.reason === 'profile_not_found') {
          Alert.alert(
            'Não foi possível gerar o código',
            'Execute no Supabase scripts/preparar-perfil-acesso-cadastro.sql ou profiles-access-pin.sql e tente novamente.'
          );
          return;
        }

        Alert.alert(
          'Celular inválido',
          'Não foi possível abrir o WhatsApp para o celular informado. Confira o número digitado.'
        );
        return;
      }

      try {
        await Clipboard.setStringAsync(result.message);
      } catch (clipboardError) {
        console.error('Erro ao copiar mensagem do código:', clipboardError);
      }

      setPinDeliveryUnlocked(true);
      setHasStoredAccessPin(true);
      setPinCodeSent(true);
      setAccessPin('');
      focusPinInput();

      Alert.alert(
        'Código gerado',
        buildAccessPinDeliveryAlertMessage({
          ...result,
          whatsappOpened: whatsappOpenedOnPress,
        })
      );
    } catch (err: unknown) {
      console.error('Erro ao enviar código:', err);
      Alert.alert(
        'Erro',
        'Não foi possível concluir o envio do código. Confira psw_user/psw_mngr em app_parameters e os scripts SQL no Supabase.'
      );
    }
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
            'Na primeira entrada, toque em "Receber código no WhatsApp", confira a mensagem e digite os 4 dígitos aqui.'
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
          Alert.alert('Senha incorreta', 'Toque em "Esqueci minha senha" e receba um novo código pelo WhatsApp.');
          return;
        }

        const continued = await continueWithExistingProfile(verification.profile, cleanPhone);

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
    [canAttemptMemberPinLogin, continueWithExistingProfile, isTotemLoginMode, phone, router]
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
    && (needsWhatsappBeforePin || hasStoredAccessPin === false);

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

    if (showForgotPasswordHelp) {
      return 'Esqueceu a senha? Receba um novo código pelo WhatsApp.';
    }

    if (isLikelyFirstAccess) {
      return pinDeliverySettings?.sendToUser
        ? 'Toque no botão abaixo para receber o código no seu WhatsApp.'
        : 'Toque no botão abaixo — a secretaria envia o código pelo WhatsApp.';
    }

    return 'Digite sua senha de 4 dígitos para continuar.';
  };

  const getMemberPinHint = () => {
    if (isCheckingStoredPin || isPinDeliverySettingsLoading) {
      return 'Aguarde um instante...';
    }

    if (showForgotPasswordHelp) {
      return 'Receba um novo código pelo WhatsApp e tente novamente.';
    }

    if (needsWhatsappBeforePin) {
      return pinDeliverySettings?.sendToUser
        ? 'O código chega no seu WhatsApp com 4 números.'
        : 'A secretaria envia o código com 4 números pelo WhatsApp.';
    }

    if (!isPinInputEditable) {
      return 'Toque no botão acima para receber seu código.';
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

  const renderWhatsappButton = (marginBottom = 16) => (
    <TouchableOpacity
      accessibilityLabel="Receber código no WhatsApp"
      accessibilityRole="button"
      activeOpacity={0.85}
      disabled={isWhatsappButtonDisabled}
      onPress={handleWhatsappPress}
      style={[
        styles.whatsappPrimaryButton,
        { marginBottom },
        isWhatsappButtonDisabled && styles.whatsappPrimaryButtonDisabled,
      ]}
    >
      {isSendingPin || isPinDeliverySettingsLoading ? (
        <ActivityIndicator color="#064E3B" size="small" />
      ) : (
        <>
          <FontAwesome name="whatsapp" size={24} color="#064E3B" />
          <Text style={styles.whatsappPrimaryButtonText}>Receber código no WhatsApp</Text>
        </>
      )}
    </TouchableOpacity>
  );

  const renderSocialLinks = () => (
    <View style={styles.socialFooter}>
      <View style={styles.socialRow}>
        <TouchableOpacity
          accessibilityLabel="Abrir Instagram da Igreja Batista Norte"
          accessibilityRole="button"
          onPress={() => {
            void handleOpenSocial('https://www.instagram.com/igrejabatistanorte');
          }}
          style={styles.socialButton}
        >
          <FontAwesome5 name="instagram" brand size={20} color={SOCIAL_BRAND_COLORS.instagram} />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="Abrir YouTube da Igreja Batista Norte"
          accessibilityRole="button"
          onPress={() => {
            void handleOpenSocial('https://www.youtube.com/@ibnorte');
          }}
          style={styles.socialButton}
        >
          <FontAwesome5 name="youtube" brand size={20} color={SOCIAL_BRAND_COLORS.youtube} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isRestoringSession || isTotemConfigLoading) {
    return (
      <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
        <View style={styles.restoreLoader}>
          <ActivityIndicator color="#10b981" size="large" />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
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
              tintColor="#FFFFFF"
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
                    placeholderTextColor="#475569"
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
                  <FontAwesome name="check-circle" size={18} color="#10b981" />
                  <ReadOnlyText style={styles.phoneConfirmedText}>
                    Celular confirmado: {phone}
                  </ReadOnlyText>
                </View>
              ) : null}

              {!isTotemLoginMode && isCheckingStoredPin ? (
                <View style={styles.checkingPinCard}>
                  <ActivityIndicator color="#10b981" size="small" />
                  <ReadOnlyText style={styles.checkingPinText}>Verificando seu acesso...</ReadOnlyText>
                </View>
              ) : null}

              {showWhatsappAbovePin ? renderWhatsappButton() : null}

              {!isTotemLoginMode && pinCodeSent ? (
                <View pointerEvents="none" style={styles.pinSentBanner}>
                  <ReadOnlyText style={styles.pinSentBannerText}>
                    Código enviado! Confira o WhatsApp e digite os 4 dígitos abaixo.
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
                    placeholderTextColor="#475569"
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
                    accessibilityLabel="Senha bloqueada até receber o código no WhatsApp"
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
                {!isTotemLoginMode && showForgotPasswordHelp ? (
                  <TouchableOpacity
                    accessibilityLabel="Esqueci minha senha"
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    onPress={handleWhatsappPress}
                    style={styles.forgotPasswordBox}
                  >
                    <Text style={styles.forgotPasswordBoxText}>Esqueci minha senha</Text>
                  </TouchableOpacity>
                ) : null}
                {showWhatsappBelowPin ? renderWhatsappButton(12) : null}
                {!isTotemLoginMode && isLoading ? (
                  <ActivityIndicator color="#10b981" style={styles.loginLoader} />
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, !canPressEntrar && styles.btnPrimaryDisabled]}
                onPress={handleAccess}
                disabled={!canPressEntrar}
              >
                {isLoading ? (
                  <ActivityIndicator color="#020617" />
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  restoreLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 32,
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
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    color: '#10b981',
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
    borderRadius: 20,
    color: '#FFF',
    fontSize: 18,
  },
  editableInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 2,
    borderColor: '#10b981',
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.45)',
    borderStyle: 'dashed',
  },
  readOnlyInputText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
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
    color: '#64748b',
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
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
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stepNumberCircleActive: {
    borderColor: '#10b981',
    backgroundColor: '#10b981',
  },
  stepNumberText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '800',
  },
  stepNumberTextActive: {
    color: '#0f172a',
  },
  stepChipLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  stepChipLabelActive: {
    color: '#D1FAE5',
  },
  stepConnector: {
    width: 36,
    height: 2,
    backgroundColor: '#334155',
    marginTop: 15,
  },
  backLink: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  backLinkText: {
    color: '#94A3B8',
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
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  checkingPinCard: {
    width: '100%',
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  checkingPinText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  whatsappPrimaryButton: {
    width: '100%',
    marginBottom: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  whatsappPrimaryButtonDisabled: {
    opacity: 0.55,
  },
  whatsappPrimaryButtonText: {
    color: '#064E3B',
    fontSize: 16,
    fontWeight: '800',
  },
  pinSentBanner: {
    width: '100%',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  pinSentBannerText: {
    color: '#A7F3D0',
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
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: '#475569',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  forgotPasswordBoxText: {
    color: '#94A3B8',
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
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  trailingActionButtonDisabled: {
    opacity: 0.45,
  },
  clearButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: '#10b981',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  btnPrimaryDisabled: {
    opacity: 0.45,
  },
  btnText: {
    color: '#020617',
    fontWeight: 'bold',
    fontSize: 16,
  },
  helpText: {
    marginTop: 18,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  socialFooter: {
    marginTop: 24,
    alignItems: 'center',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
});
