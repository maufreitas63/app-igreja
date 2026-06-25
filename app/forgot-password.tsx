import { PwaInstallButton } from '@/components/PwaInstallButton';
import {
  ACCESS_PIN_LENGTH,
  isValidAccessPin,
} from '@/lib/accessPin';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import {
  passwordRecoveryIdentify,
  passwordRecoveryOpenWhatsAppFromDispatch,
  passwordRecoveryResetAccessPin,
  passwordRecoveryVerifyChallengeAndDispatch,
} from '@/lib/passwordRecovery';
import { isBrazilianMobilePhoneComplete } from '@/lib/phoneValidation';
import { FontAwesome } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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

type RecoveryStep = 'phone' | 'challenge' | 'token';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const initialPhone =
    typeof params.phone === 'string' ? formatBrazilPhoneInput(params.phone) : '';

  const [step, setStep] = useState<RecoveryStep>('phone');
  const [phone, setPhone] = useState(initialPhone);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [challengePassed, setChallengePassed] = useState(false);
  const [tokenCode, setTokenCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenDispatched, setTokenDispatched] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [phoneStepError, setPhoneStepError] = useState<string | null>(null);

  const pinMismatch = useMemo(
    () =>
      isValidAccessPin(newPin)
      && isValidAccessPin(confirmPin)
      && newPin !== confirmPin,
    [confirmPin, newPin]
  );

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
      setChallengePassed(false);
      setTokenDispatched(false);
      setTokenCode('');
      setNewPin('');
      setConfirmPin('');
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
    setDispatchFeedback(null);

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
          setChallengePassed(false);
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

      setChallengePassed(true);
      setTokenDispatched(true);
      setStep('token');
      setDispatchFeedback(
        whatsapp.ok
          ? whatsapp.whatsappOpened
            ? 'Desafio validado. O WhatsApp foi aberto com o código de 4 dígitos (válido por 5 minutos).'
            : 'Desafio validado. O código foi copiado — abra o WhatsApp e envie a mensagem.'
          : whatsapp.message
      );
    } finally {
      setLoading(false);
    }
  }, [phone, securityAnswer]);

  const handleResetPin = useCallback(async () => {
    if (!challengePassed || !tokenDispatched) {
      Alert.alert(
        'Etapa pendente',
        'Valide a pergunta de segurança e receba o código no WhatsApp antes de redefinir a senha.'
      );
      return;
    }

    if (!isValidAccessPin(tokenCode)) {
      Alert.alert('Atenção', 'Informe o código de 4 dígitos recebido no WhatsApp.');
      return;
    }

    if (!isValidAccessPin(newPin)) {
      Alert.alert('Atenção', 'A nova senha deve ter 4 dígitos.');
      return;
    }

    if (pinMismatch) {
      Alert.alert('Atenção', 'A confirmação da nova senha não confere.');
      return;
    }

    setLoading(true);

    try {
      const result = await passwordRecoveryResetAccessPin(phone, tokenCode, newPin);

      if (!result.ok) {
        Alert.alert('Não foi possível redefinir', result.message);
        return;
      }

      Alert.alert('Senha redefinida', 'Use a nova senha de 4 dígitos na tela de entrada.', [
        {
          text: 'Ir para entrada',
          onPress: () => router.replace('/'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [challengePassed, newPin, phone, pinMismatch, router, tokenCode, tokenDispatched]);

  const getTitle = () => {
    if (step === 'phone') {
      return 'Recuperar senha';
    }

    if (step === 'challenge') {
      return 'Pergunta de segurança';
    }

    return 'Código e nova senha';
  };

  const getSubtitle = () => {
    if (step === 'phone') {
      return 'Informe o celular cadastrado. É necessário ter pergunta de segurança salva em Dados Cadastrais.';
    }

    if (step === 'challenge') {
      return 'Responda à pergunta cadastrada em Dados Cadastrais.';
    }

    return 'Informe o código recebido no WhatsApp e escolha uma nova senha.';
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

          {step === 'token' ? (
            <View style={styles.block}>
              {dispatchFeedback ? (
                <Text style={styles.successText}>{dispatchFeedback}</Text>
              ) : null}

              <Text style={styles.label}>Código do WhatsApp</Text>
              <TextInput
                style={[styles.input, styles.editableInput, styles.pinInput]}
                value={tokenCode}
                onChangeText={(text) => setTokenCode(text.replace(/\D/g, '').slice(0, ACCESS_PIN_LENGTH))}
                placeholder="0000"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                maxLength={ACCESS_PIN_LENGTH}
                editable={challengePassed && tokenDispatched && !loading}
                textAlign="center"
                autoComplete="off"
                textContentType="none"
              />

              <Text style={styles.label}>Nova senha (4 dígitos)</Text>
              <TextInput
                style={[styles.input, styles.editableInput, styles.pinInput]}
                value={newPin}
                onChangeText={(text) => setNewPin(text.replace(/\D/g, '').slice(0, ACCESS_PIN_LENGTH))}
                placeholder="0000"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                maxLength={ACCESS_PIN_LENGTH}
                editable={challengePassed && tokenDispatched && !loading}
                textAlign="center"
                autoComplete="off"
                textContentType="none"
              />

              <Text style={styles.label}>Confirmar nova senha</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.editableInput,
                  styles.pinInput,
                  pinMismatch && styles.inputError,
                ]}
                value={confirmPin}
                onChangeText={(text) =>
                  setConfirmPin(text.replace(/\D/g, '').slice(0, ACCESS_PIN_LENGTH))
                }
                placeholder="0000"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                maxLength={ACCESS_PIN_LENGTH}
                editable={challengePassed && tokenDispatched && !loading}
                textAlign="center"
                autoComplete="off"
                textContentType="none"
              />

              {pinMismatch ? (
                <Text style={styles.errorText}>A confirmação da nova senha não confere.</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  (loading || !challengePassed || !tokenDispatched || pinMismatch) && styles.btnDisabled,
                ]}
                onPress={() => void handleResetPin()}
                disabled={loading || !challengePassed || !tokenDispatched || pinMismatch}
              >
                {loading ? (
                  <ActivityIndicator color="#020617" />
                ) : (
                  <Text style={styles.btnText}>Redefinir senha</Text>
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
});
