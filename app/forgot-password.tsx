import { PwaInstallButton } from '@/components/PwaInstallButton';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import {
  passwordRecoveryGetState,
  passwordRecoverySetEmail,
  passwordRecoveryVerifyAndSendPin,
} from '@/lib/passwordRecovery';
import { isBrazilianMobilePhoneComplete } from '@/lib/phoneValidation';
import { clearUserSession } from '@/lib/userSession';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'react-native';

type RecoveryStep = 'loading' | 'email' | 'security';

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
  const [hasSecurityQuestion, setHasSecurityQuestion] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
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
    setHasSecurityQuestion(result.hasSecurityQuestion);
    setSecurityQuestion(result.securityQuestion);
    setNewQuestion(result.hasSecurityQuestion ? '' : result.securityQuestion);
    setStep('email');
  }, [phone, router]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const goToSecurityStep = useCallback(() => {
    setStepError(null);
    setStep('security');
  }, []);

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
      goToSecurityStep();
    } finally {
      setLoading(false);
    }
  }, [email, emailConfirm, goToSecurityStep, phone]);

  const handleConfirmExistingEmail = useCallback(() => {
    goToSecurityStep();
  }, [goToSecurityStep]);

  const handleVerifyAndSendPin = useCallback(async () => {
    if (hasSecurityQuestion) {
      if (!securityAnswer.trim()) {
        setStepError('Informe a resposta da pergunta de segurança.');
        return;
      }
    } else {
      if (!newQuestion.trim()) {
        setStepError('Informe a pergunta de segurança.');
        return;
      }

      if (!securityAnswer.trim()) {
        setStepError('Informe a resposta da pergunta de segurança.');
        return;
      }
    }

    setLoading(true);
    setStepError(null);

    try {
      const result = await passwordRecoveryVerifyAndSendPin(
        phone,
        securityAnswer,
        hasSecurityQuestion ? undefined : newQuestion
      );

      if (!result.ok) {
        const attemptsSuffix =
          typeof result.attemptsRemaining === 'number' && result.attemptsRemaining > 0
            ? ` Tentativas restantes: ${result.attemptsRemaining}.`
            : '';

        setStepError(`${result.message}${attemptsSuffix}`);

        if (result.blocked) {
          Alert.alert('Recuperação bloqueada', result.message, [
            { text: 'Voltar', onPress: () => router.replace('/') },
          ]);
        }

        return;
      }

      router.replace(buildLoginRouteAfterRecovery(phone, result.emailMasked));
    } finally {
      setLoading(false);
    }
  }, [hasSecurityQuestion, newQuestion, phone, router, securityAnswer]);

  const getTitle = () => {
    if (step === 'email') {
      return needsEmail ? 'Cadastrar e-mail' : 'Confirmar e-mail';
    }

    if (step === 'security') {
      return hasSecurityQuestion ? 'Pergunta de segurança' : 'Cadastrar pergunta de segurança';
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
        : 'Confirme o e-mail cadastrado para continuar.';
    }

    return hasSecurityQuestion
      ? 'Responda à pergunta de segurança. Enviaremos a nova senha por e-mail.'
      : 'Cadastre pergunta e resposta. Enviaremos a nova senha por e-mail.';
  };

  return (
    <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
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
            <FontAwesome name="chevron-left" size={14} color="#94A3B8" />
            <Text style={styles.backButtonText}>Voltar à entrada</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>

          {step === 'loading' ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color="#10b981" size="large" />
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
                    placeholderTextColor="#64748B"
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
                    placeholderTextColor="#64748B"
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
                  <ActivityIndicator color="#020617" />
                ) : (
                  <Text style={styles.btnText}>
                    {needsEmail ? 'Salvar e-mail e continuar' : 'Confirmar e continuar'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {step === 'security' ? (
            <View style={styles.block}>
              {emailMasked ? (
                <>
                  <Text style={styles.label}>E-mail para envio</Text>
                  <View style={[styles.input, styles.readOnlyPanel]}>
                    <Text style={styles.readOnlyText}>{emailMasked}</Text>
                  </View>
                </>
              ) : null}

              {hasSecurityQuestion ? (
                <>
                  <Text style={styles.label}>Pergunta de segurança</Text>
                  <View style={[styles.input, styles.readOnlyPanel]}>
                    <Text style={styles.readOnlyText}>{securityQuestion}</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Pergunta de segurança</Text>
                  <TextInput
                    style={[styles.input, styles.editableInput]}
                    value={newQuestion}
                    onChangeText={(text) => {
                      setNewQuestion(text);
                      setStepError(null);
                    }}
                    placeholder="Ex.: Qual o nome do seu primeiro animal de estimação?"
                    placeholderTextColor="#64748B"
                    multiline
                    textAlignVertical="top"
                    editable={!loading}
                  />
                </>
              )}

              <Text style={styles.label}>
                {hasSecurityQuestion ? 'Sua resposta' : 'Resposta da pergunta'}
              </Text>
              <TextInput
                style={[styles.input, styles.editableInput]}
                value={securityAnswer}
                onChangeText={(text) => {
                  setSecurityAnswer(text);
                  setStepError(null);
                }}
                placeholder="Resposta secreta"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                editable={!loading}
                onSubmitEditing={() => void handleVerifyAndSendPin()}
                returnKeyType="done"
              />

              {stepError ? <Text style={styles.errorText}>{stepError}</Text> : null}

              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={() => void handleVerifyAndSendPin()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#020617" />
                ) : (
                  <Text style={styles.btnText}>Validar e enviar senha por e-mail</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          <PwaInstallButton />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
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
  },
  backButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
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
    lineHeight: 22,
  },
  block: {
    gap: 10,
    marginBottom: 20,
  },
  label: {
    color: '#10b981',
    fontWeight: '600',
  },
  hint: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
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
  readOnlyPanel: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  readOnlyText: {
    color: '#E2E8F0',
    fontSize: 16,
    lineHeight: 22,
  },
  btnPrimary: {
    marginTop: 8,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnText: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '800',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
