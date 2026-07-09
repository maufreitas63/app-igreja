import { MediaAuthorizationLegalModal } from '@/components/MediaAuthorizationLegalModal';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import { cpfValidationMessage, formatCpf } from '@/lib/cpfValidation';
import {
  ensureServerSessionForMediaAuth,
  getMediaAuthorizationPdfSignedUrl,
  loadLatestMediaAuthorization,
  loadMediaAuthorizationProfile,
  MEDIA_AUTHORIZATION_TERMS_BODY,
  MEDIA_AUTHORIZATION_TERMS_TITLE,
  retryMediaAuthorizationPdf,
  submitMediaAuthorizationPending,
} from '@/lib/mediaAuthorization';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  profileId: string;
};

type FieldKey = 'fullName' | 'email' | 'cpf' | 'phone';

const isFilled = (value: string | null | undefined) => Boolean(value?.trim());

type LatestAuthorization = {
  id: string;
  accepted_at: string | null;
  storage_path: string | null;
};

export function AuthorizationForm({ profileId }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [alreadyAuthorized, setAlreadyAuthorized] = useState(false);
  const [latestAuthorization, setLatestAuthorization] = useState<LatestAuthorization | null>(null);
  const [lockedFields, setLockedFields] = useState<Record<FieldKey, boolean>>({
    fullName: false,
    email: false,
    cpf: false,
    phone: false,
  });

  useEffect(() => {
    void ensureServerSessionForMediaAuth(profileId);
  }, [profileId]);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);

      try {
        const [loadedProfile, latestAuthorization] = await Promise.all([
          loadMediaAuthorizationProfile(profileId),
          loadLatestMediaAuthorization(profileId),
        ]);

        if (!active || !loadedProfile) {
          return;
        }

        setFullName(loadedProfile.full_name?.trim() ?? '');
        setEmail(loadedProfile.email?.trim() ?? '');
        setCpf(formatCpf(loadedProfile.cpf ?? ''));
        setPhone(formatBrazilPhoneInput(loadedProfile.phone ?? ''));
        setAlreadyAuthorized(Boolean(latestAuthorization?.id));
        setAcceptedTerms(Boolean(latestAuthorization?.id));
        setLatestAuthorization(
          latestAuthorization?.id
            ? {
                id: String(latestAuthorization.id),
                accepted_at: latestAuthorization.accepted_at ?? null,
                storage_path: latestAuthorization.storage_path ?? null,
              }
            : null
        );
        setLockedFields({
          fullName: isFilled(loadedProfile.full_name),
          email: isFilled(loadedProfile.email),
          cpf: isFilled(loadedProfile.cpf),
          phone: isFilled(loadedProfile.phone),
        });
      } catch (error) {
        console.error('[AuthorizationForm] load failed', error);
        Alert.alert('Erro', 'Não foi possível carregar seus dados cadastrais.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [profileId]);

  const validateCpfField = useCallback((value: string) => {
    const message = cpfValidationMessage(value);
    setCpfError(message);
    return message === null;
  }, []);

  const isFormLocked = alreadyAuthorized;

  const canSubmit = useMemo(
    () =>
      !isFormLocked
      && fullName.trim().length > 3
      && email.trim().includes('@')
      && cpfValidationMessage(cpf) === null
      && phone.replace(/\D/g, '').length >= 10
      && acceptedTerms
      && !submitting,
    [acceptedTerms, cpf, email, fullName, isFormLocked, phone, submitting]
  );

  const handleSubmit = async () => {
    if (isFormLocked) {
      return;
    }

    if (!validateCpfField(cpf)) {
      Alert.alert('CPF inválido', cpfError ?? 'Revise o CPF informado.');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Termos', 'Marque que leu e concorda com a autorização.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await submitMediaAuthorizationPending({
        fullName,
        email,
        cpf,
        phone,
        profileId,
      });

      if (!result.ok) {
        const title = result.sessionValid === false ? 'Sessão expirada' : 'Não foi possível enviar';
        const detail = [
          result.message,
          result.pendingId ? `Pendência: ${result.pendingId}` : null,
        ].filter(Boolean).join('\n\n');
        Alert.alert(title, detail);
        return;
      }

      if (!result.emailSent) {
        Alert.alert(
          'E-mail não enviado',
          [
            result.message,
            result.emailProvider ? `Provedor: ${result.emailProvider}` : null,
            result.pendingId ? `Pendência gravada: ${result.pendingId}` : null,
          ].filter(Boolean).join('\n\n')
        );
        return;
      }

      Alert.alert(
        'Confirme seu e-mail',
        [
          result.message,
          result.emailMasked ? `Destino: ${result.emailMasked}` : null,
          result.emailProvider ? `Provedor: ${result.emailProvider}` : null,
          result.resendId ? `ID Resend: ${result.resendId}` : null,
          'Verifique também a pasta de spam.',
        ].filter(Boolean).join('\n\n')
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar autorização.';
      console.error('[AuthorizationForm] submit failed', error);
      Alert.alert('Erro', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    const storagePath = latestAuthorization?.storage_path?.trim();
    if (!storagePath) {
      return;
    }

    setPdfLoading(true);

    try {
      const signedUrl = await getMediaAuthorizationPdfSignedUrl(storagePath);
      if (!signedUrl) {
        Alert.alert('PDF indisponível', 'Não foi possível abrir o documento. Tente gerar novamente.');
        return;
      }

      await Linking.openURL(signedUrl);
    } catch (error) {
      console.error('[AuthorizationForm] download pdf failed', error);
      Alert.alert('Erro', 'Não foi possível abrir o PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    const authorizationId = latestAuthorization?.id;
    if (!authorizationId) {
      return;
    }

    setPdfLoading(true);

    try {
      const result = await retryMediaAuthorizationPdf(authorizationId);
      if (!result.ok) {
        Alert.alert('Não foi possível gerar o PDF', result.message);
        return;
      }

      if (result.storagePath) {
        setLatestAuthorization((current) =>
          current ? { ...current, storage_path: result.storagePath ?? null } : current
        );
      }

      Alert.alert('PDF gerado', result.message);
    } catch (error) {
      console.error('[AuthorizationForm] generate pdf failed', error);
      Alert.alert('Erro', 'Falha ao gerar o PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const acceptedAtLabel = useMemo(() => {
    if (!latestAuthorization?.accepted_at) {
      return null;
    }

    const date = new Date(latestAuthorization.accepted_at);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }, [latestAuthorization?.accepted_at]);

  if (loading) {
    return <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>Autorização de imagem e voz</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Por que este aceite tem validade jurídica?"
          onPress={() => setLegalOpen(true)}
          style={styles.infoButton}
        >
          <FontAwesome name="info-circle" size={20} color={MINIMAL_UI.icon} />
        </Pressable>
      </View>

      {alreadyAuthorized ? (
        <View style={styles.authorizedBox}>
          <Text style={styles.notice}>
            Autorização confirmada{acceptedAtLabel ? ` em ${acceptedAtLabel}` : ''}.
          </Text>
          {latestAuthorization?.storage_path ? (
            <Pressable
              accessibilityRole="button"
              disabled={pdfLoading}
              onPress={() => void handleDownloadPdf()}
              style={styles.pdfButton}
            >
              {pdfLoading ? (
                <ActivityIndicator color={MINIMAL_UI.onDark} />
              ) : (
                <Text style={styles.pdfButtonText}>Baixar PDF da autorização</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={pdfLoading}
              onPress={() => void handleGeneratePdf()}
              style={styles.pdfButtonSecondary}
            >
              {pdfLoading ? (
                <ActivityIndicator color={MINIMAL_UI.icon} />
              ) : (
                <Text style={styles.pdfButtonSecondaryText}>Gerar PDF da autorização</Text>
              )}
            </Pressable>
          )}
        </View>
      ) : null}

      <ScrollView
        style={[styles.formScroll, isFormLocked && styles.formScrollLocked]}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <Field
          label="Nome completo"
          value={fullName}
          onChangeText={setFullName}
          editable={!isFormLocked && !lockedFields.fullName}
          autoCapitalize="words"
        />
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          editable={!isFormLocked && !lockedFields.email}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View style={styles.fieldRow}>
          <Field
            label="CPF"
            value={cpf}
            onChangeText={(value) => {
              setCpf(formatCpf(value));
              if (cpfError) {
                setCpfError(null);
              }
            }}
            onBlur={() => validateCpfField(cpf)}
            editable={!isFormLocked && !lockedFields.cpf}
            keyboardType="number-pad"
            error={cpfError}
            compact
            halfWidth
          />
          <Field
            label="Telefone"
            value={phone}
            onChangeText={(value) => setPhone(formatBrazilPhoneInput(value))}
            editable={!isFormLocked && !lockedFields.phone}
            keyboardType="phone-pad"
            compact
            halfWidth
          />
        </View>

        <View style={styles.termsBox}>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.termsScroll}
            contentContainerStyle={styles.termsScrollContent}
          >
            <Text style={styles.termsTitle}>{MEDIA_AUTHORIZATION_TERMS_TITLE}</Text>
            <Text style={styles.termsText}>{MEDIA_AUTHORIZATION_TERMS_BODY}</Text>
          </ScrollView>
        </View>

        {isFormLocked ? (
          <View
            accessibilityRole="checkbox"
            accessibilityState={{ checked: true, disabled: true }}
            style={[styles.acceptRow, styles.acceptRowLocked]}
          >
            <View style={[styles.checkbox, styles.checkboxChecked, styles.checkboxLocked]} />
            <Text style={[styles.acceptLabel, styles.acceptLabelLocked]}>
              Li e concordo com a autorização acima
            </Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            onPress={() => setAcceptedTerms((current) => !current)}
            style={styles.acceptRow}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]} />
            <Text style={styles.acceptLabel}>Li e concordo com a autorização acima</Text>
          </Pressable>
        )}

        {!isFormLocked ? (
          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() => void handleSubmit()}
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color={MINIMAL_UI.onDark} />
            ) : (
              <Text style={styles.submitButtonText}>Enviar e confirmar por e-mail</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>

      <MediaAuthorizationLegalModal visible={legalOpen} onClose={() => setLegalOpen(false)} />
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  editable?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad';
  autoCapitalize?: 'none' | 'words';
  error?: string | null;
  compact?: boolean;
  halfWidth?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  onBlur,
  editable = true,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  compact = false,
  halfWidth = false,
}: FieldProps) {
  return (
    <View style={[styles.field, halfWidth && styles.fieldHalf]}>
      <Text style={[styles.fieldLabel, compact && styles.fieldLabelCompact]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        editable={editable}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[
          styles.input,
          compact && styles.inputCompact,
          !editable && styles.inputLocked,
          error ? styles.inputError : null,
        ]}
        placeholderTextColor={MINIMAL_UI.textMuted}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    backgroundColor: MINIMAL_UI.background,
  },
  loader: {
    marginTop: 32,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    flex: 1,
    marginBottom: 0,
  },
  infoButton: {
    padding: 6,
  },
  notice: {
    fontSize: 13,
    lineHeight: 18,
    color: MINIMAL_UI.blue,
    marginBottom: 8,
  },
  noticeMuted: {
    fontSize: 12,
    lineHeight: 16,
    color: MINIMAL_UI.textMuted,
    marginTop: 8,
  },
  authorizedBox: {
    marginBottom: 8,
  },
  pdfButton: {
    backgroundColor: MINIMAL_UI.icon,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  pdfButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 14,
    fontWeight: '600',
  },
  pdfButtonSecondary: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.icon,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  pdfButtonSecondaryText: {
    color: MINIMAL_UI.icon,
    fontSize: 14,
    fontWeight: '600',
  },
  formScroll: {
    flex: 1,
    minHeight: 0,
  },
  formScrollLocked: {
    opacity: 0.92,
  },
  formContent: {
    gap: 12,
    paddingBottom: 16,
  },
  field: {
    gap: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  fieldHalf: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: MINIMAL_UI.text,
  },
  fieldLabelCompact: {
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: MINIMAL_UI.blue,
    backgroundColor: MINIMAL_UI.background,
  },
  inputCompact: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  inputLocked: {
    backgroundColor: MINIMAL_UI.rowHover,
    color: MINIMAL_UI.textMuted,
  },
  inputError: {
    borderColor: '#DC2626',
  },
  fieldError: {
    fontSize: 12,
    color: '#DC2626',
  },
  termsBox: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    maxHeight: 168,
    overflow: 'hidden',
  },
  termsScroll: {
    maxHeight: 168,
  },
  termsScrollContent: {
    padding: 14,
    gap: 8,
    paddingBottom: 16,
  },
  termsTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  termsText: {
    fontSize: 13,
    lineHeight: 20,
    color: MINIMAL_UI.blue,
  },
  acceptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  acceptRowLocked: {
    opacity: 0.85,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: MINIMAL_UI.icon,
  },
  checkboxChecked: {
    backgroundColor: MINIMAL_UI.icon,
  },
  checkboxLocked: {
    borderColor: MINIMAL_UI.textMuted,
    backgroundColor: MINIMAL_UI.textMuted,
  },
  acceptLabel: {
    flex: 1,
    fontSize: 14,
    color: MINIMAL_UI.text,
  },
  acceptLabelLocked: {
    color: MINIMAL_UI.textMuted,
  },
  submitButton: {
    backgroundColor: MINIMAL_UI.blue,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 15,
    fontWeight: '800',
  },
});
