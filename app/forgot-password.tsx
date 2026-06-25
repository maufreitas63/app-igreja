import { PwaInstallButton } from '@/components/PwaInstallButton';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import {
  passwordRecoveryIdentify,
  passwordRecoveryOpenWhatsAppFromDispatch,
  passwordRecoveryVerifyChallengeAndDispatch,
} from '@/lib/passwordRecovery';
import { isBrazilianMobilePhoneComplete } from '@/lib/phoneValidation';
import { FontAwesome } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
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

type RecoveryStep = 'phone' | 'challenge';

const buildLoginRouteAfterRecovery = (phoneValue: string) => {
  const digits = phoneValue.replace(/\D/g, '');

  if (!isBrazilianMobilePhoneComplete(phoneValue) || !digits) {
    return '/?recovered=1';
  }

  return `/?phone=${encodeURIComponent(digits)}&recovered=1`;
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const initialPhone =
    typeof params.phone === 'string' ? formatBrazilPhoneInput(params.phone) : '';

  const [step, setStep] = useState<RecoveryStep>('phone');
  const [phone, setPhone] = useState(initialPhone);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [phoneStepError, setPhoneStepError] = useState<string | null>(null);

  const handleIdentify = useCallback(async () => {
    if (!isBrazilianMobilePhoneComplete(phone)) {
      Alert.alert('Atenção', 'Informe o celular completo com 11 dígitos.');
      return;
    }

    setLoading(true);
    setPhoneStepError(null);

    try {
      const result = await passwordRecoveryIdentify(phone);

      if (!result.ok) {
        setPhoneStepError(result.message);
        return;
      }

      setSecurityQuestion(result.securityQuestion);
      setSecurityAnswer('');
      setStep('challenge');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const handleVerifyChallenge = useCallback(async () => {
    if (!securityAnswer.trim()) {
      setChallengeError('Informe a resposta da pergunta de segurança.');
      return;
    }

    setLoading(true);
    setChallengeError(null);

    try {
      const result = await passwordRecoveryVerifyChallengeAndDispatch(phone, securityAnswer);

      if (!result.ok) {
        const attemptsSuffix =
          typeof result.attemptsRemaining === 'number' && result.attemptsRemaining > 0
            ? ` Tentativas restantes: ${result.attemptsRemaining}.`
            : '';

        setChallengeError(`${result.message}${attemptsSuffix}`);

        if (result.blocked) {
          setSecurityAnswer('');
          setStep('phone');
        }

        return;
      }

      const whatsapp = passwordRecoveryOpenWhatsAppFromDispatch(phone, result);

      try {
        await Clipboard.setStringAsync(result.whatsappMessage);
      } catch (clipboardError) {
        console.error('Erro ao copiar mensagem de recuperação:', clipboardError);
      }

      if (!whatsapp.ok) {
        Alert.alert(
          'Senha atualizada',
          'O código do WhatsApp já é sua senha de entrada. Digite os 4 dígitos na tela de login.',
          [{ text: 'Continuar', onPress: () => router.replace(buildLoginRouteAfterRecovery(phone)) }]
        );
        return;
      }

      router.replace(buildLoginRouteAfterRecovery(phone));
    } finally {
      setLoading(false);
    }
  }, [phone, router, securityAnswer]);

  const getTitle = () => {
    if (step === 'phone') {
      return 'Recuperar senha';
    }

    return 'Pergunta de segurança';
  };

  const getSubtitle = () => {
    if (step === 'phone') {
      return 'Informe o celular cadastrado. É necessário ter pergunta de segurança salva em Dados Cadastrais.';
    }

    return 'Responda à pergunta cadastrada em Dados Cadastrais.';
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

          {step === 'phone' ? (
            <View style={styles.block}>
              <Text style={styles.label}>Celular</Text>
              <TextInput
                style={[styles.input, styles.editableInput]}
                value={phone}
                onChangeText={(text) => {
                  setPhone(formatBrazilPhoneInput(text));
                  setPhoneStepError(null);
                }}
                placeholder="(00) 00000-0000"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              {phoneStepError ? <Text style={styles.errorText}>{phoneStepError}</Text> : null}
              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={() => void handleIdentify()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#020617" />
                ) : (
                  <Text style={styles.btnText}>Continuar</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {step === 'challenge' ? (
            <View style={styles.block}>
              <Text style={styles.label}>Celular</Text>
              <View style={[styles.input, styles.readOnlyPanel]}>
                <Text style={styles.readOnlyText}>{phone}</Text>
              </View>

              <Text style={styles.label}>Pergunta de segurança</Text>
              <View style={[styles.input, styles.readOnlyPanel]}>
                <Text style={styles.readOnlyText}>{securityQuestion}</Text>
              </View>

              <Text style={styles.label}>Sua resposta</Text>
              <TextInput
                style={[styles.input, styles.editableInput]}
                value={securityAnswer}
                onChangeText={(text) => {
                  setSecurityAnswer(text);
                  setChallengeError(null);
                }}
                placeholder="Resposta secreta"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                editable={!loading}
                onSubmitEditing={() => void handleVerifyChallenge()}
                returnKeyType="done"
              />

              {challengeError ? <Text style={styles.errorText}>{challengeError}</Text> : null}

              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={() => void handleVerifyChallenge()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#020617" />
                ) : (
                  <Text style={styles.btnText}>Validar resposta e enviar código</Text>
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
  inputError: {
    borderColor: '#f87171',
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
  pinInput: {
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 16,
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
  btnSecondary: {
    marginTop: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '800',
  },
  successText: {
    color: '#86EFAC',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  warningText: {
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  helpText: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  optionalSectionLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
});
