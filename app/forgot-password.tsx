import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import {
  passwordRecoveryGetState,
  passwordRecoverySendPin,
  passwordRecoverySetEmail,
} from '@/lib/passwordRecovery';
import { isBrazilianMobilePhoneComplete } from '@/lib/phoneValidation';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { clearUserSession } from '@/lib/userSession';
import { FontAwesome } from '@expo/vector-icons';
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
} from 'react-native';

type RecoveryStep = 'loading' | 'email';

const RECOVERY_SURFACE = '#FFFFFF';
const RECOVERY_ACCENT = VIGILANCE_SCALES_UI.accent;
const RECOVERY_ICON = '#1B4F8A';
const RECOVERY_SOFT_BORDER = 'rgba(52, 211, 153, 0.35)';
const RECOVERY_SUBMIT_BG = '#3A96DD';
const RECOVERY_SUBMIT_TEXT = '#FFFFFF';
const RECOVERY_PLACEHOLDER = 'rgba(58, 150, 221, 0.55)';

const buildLoginRouteAfterRecovery = (phoneValue: string, emailMasked?: string) => {
  const digits = phoneValue.replace(/\D/g, '');

  if (!isBrazilianMobilePhoneComplete(phoneValue) || !digits) {
    const params = new URLSearchParams({ recovered: '1' });
    const masked = emailMasked?.trim();
    if (masked) {
      params.set('email', masked);
    }
    return `/?${params.toString()}`;
  }

  const params = new URLSearchParams({
    phone: digits,
    recovered: '1',
  });
  const masked = emailMasked?.trim();
  if (masked) {
    params.set('email', masked);
  }

  return `/?${params.toString()}`;
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const initialPhone =
    typeof params.phone === 'string' ? formatBrazilPhoneInput(params.phone) : '';

  const [step, setStep] = useState<RecoveryStep>('loading');
  const [phone] = useState(initialPhone);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [emailMasked, setEmailMasked] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const recoverySessionClearedRef = useRef(false);

  useEffect(() => {
    if (recoverySessionClearedRef.current) {
      return;
    }

    recoverySessionClearedRef.current = true;
    void clearUserSession();
  }, []);

  const loadState = useCallback(async () => {
    if (!isBrazilianMobilePhoneComplete(phone)) {
      router.replace('/');
      return;
    }

    setStep('loading');
    setStepError(null);

    const result = await passwordRecoveryGetState(phone);

    if (!result.ok) {
      Alert.alert('Recuperação de senha', result.message, [
        { text: 'Voltar', onPress: () => router.replace('/') },
      ]);
      return;
    }

    setNeedsEmail(result.needsEmail);
    setEmailMasked(result.emailMasked);
    setStep('email');
  }, [phone, router]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const sendPinAndRedirect = useCallback(async () => {
    setLoading(true);
    setStepError(null);

    try {
      const result = await passwordRecoverySendPin(phone);

      if (!result.ok) {
        setStepError(result.message);

        if (result.blocked) {
          Alert.alert('Recuperação bloqueada', result.message, [
            { text: 'Voltar', onPress: () => router.replace('/') },
          ]);
        }

        return;
      }

      router.replace(buildLoginRouteAfterRecovery(phone, result.emailMasked) as Href);
    } finally {
      setLoading(false);
    }
  }, [phone, router]);

  const handleSaveEmail = useCallback(async () => {
    if (!email.trim() || !emailConfirm.trim()) {
      setStepError('Informe o e-mail e a confirmação.');
      return;
    }

    setLoading(true);
    setStepError(null);

    try {
      const result = await passwordRecoverySetEmail(phone, email, emailConfirm);

      if (!result.ok) {
        setStepError(result.message);
        return;
      }

      setNeedsEmail(false);
      setEmailMasked(result.emailMasked);
      setEmail('');
      setEmailConfirm('');
      await sendPinAndRedirect();
    } finally {
      setLoading(false);
    }
  }, [email, emailConfirm, phone, sendPinAndRedirect]);

  const handleConfirmExistingEmail = useCallback(() => {
    void sendPinAndRedirect();
  }, [sendPinAndRedirect]);

  const getTitle = () => {
    if (step === 'email') {
      return needsEmail ? 'Cadastrar e-mail' : 'Confirmar e-mail';
    }

    return 'Recuperar senha';
  };

  const getSubtitle = () => {
    if (step === 'loading') {
      return 'Carregando dados do perfil...';
    }

    if (step === 'email') {
      return needsEmail
        ? 'Informe e confirme seu e-mail para receber a nova senha.'
        : 'Confirme o e-mail cadastrado para receber a nova senha.';
    }

    return '';
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/')}
            activeOpacity={0.85}
          >
            <FontAwesome name="chevron-left" size={14} color={RECOVERY_ACCENT} />
            <Text style={styles.backButtonText}>Voltar à entrada</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>

          {step === 'loading' ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={RECOVERY_ACCENT} size="large" />
            </View>
          ) : null}

          {step !== 'loading' ? (
            <View style={styles.block}>
              <Text style={styles.label}>Celular</Text>
              <View style={[styles.input, styles.readOnlyPanel]}>
                <Text style={styles.readOnlyText}>{phone}</Text>
              </View>
            </View>
          ) : null}

          {step === 'email' ? (
            <View style={styles.block}>
              {needsEmail ? (
                <>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    style={[styles.input, styles.editableInput]}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setStepError(null);
                    }}
                    placeholder="seu@email.com"
                    placeholderTextColor={RECOVERY_PLACEHOLDER}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    editable={!loading}
                  />

                  <Text style={styles.label}>Confirmar e-mail</Text>
                  <TextInput
                    style={[styles.input, styles.editableInput]}
                    value={emailConfirm}
                    onChangeText={(text) => {
                      setEmailConfirm(text);
                      setStepError(null);
                    }}
                    placeholder="seu@email.com"
                    placeholderTextColor={RECOVERY_PLACEHOLDER}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    editable={!loading}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.label}>E-mail cadastrado</Text>
                  <View style={[styles.input, styles.readOnlyPanel]}>
                    <Text style={styles.readOnlyText}>{emailMasked || '—'}</Text>
                  </View>
                  <Text style={styles.hint}>
                    A nova senha será enviada para este endereço. O código não aparece na tela.
                  </Text>
                </>
              )}

              {stepError ? <Text style={styles.errorText}>{stepError}</Text> : null}

              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={() =>
                  void (needsEmail ? handleSaveEmail() : handleConfirmExistingEmail())
                }
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={RECOVERY_SUBMIT_TEXT} />
                ) : (
                  <Text style={styles.btnText}>
                    {needsEmail ? 'Salvar e-mail e enviar senha' : 'Enviar senha por e-mail'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RECOVERY_SURFACE,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
    backgroundColor: RECOVERY_SURFACE,
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  backButtonText: {
    color: RECOVERY_ACCENT,
    fontSize: 14,
    fontWeight: '600',
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
    color: RECOVERY_ACCENT,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  block: {
    gap: 10,
    marginBottom: 20,
  },
  label: {
    color: RECOVERY_ACCENT,
    fontWeight: '600',
  },
  hint: {
    color: RECOVERY_ACCENT,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
  },
  input: {
    padding: 20,
    borderRadius: 16,
    color: RECOVERY_ACCENT,
    fontSize: 18,
  },
  editableInput: {
    backgroundColor: RECOVERY_SURFACE,
    borderWidth: 1,
    borderColor: RECOVERY_SOFT_BORDER,
  },
  readOnlyPanel: {
    backgroundColor: MINIMAL_UI.rowHover,
    borderWidth: 1,
    borderColor: RECOVERY_SOFT_BORDER,
  },
  readOnlyText: {
    color: RECOVERY_ACCENT,
    fontSize: 16,
    lineHeight: 22,
  },
  btnPrimary: {
    marginTop: 8,
    backgroundColor: RECOVERY_SUBMIT_BG,
    borderWidth: 2,
    borderColor: RECOVERY_ICON,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnText: {
    color: RECOVERY_SUBMIT_TEXT,
    fontSize: 16,
    fontWeight: '800',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
