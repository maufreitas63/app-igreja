import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { useEntityPrefix } from '@/context/EntityPrefixContext';
import { appAlert } from '@/lib/appAlert';
import { formatFamilyCodeShortDisplay } from '@/lib/family';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import {
  buildVisitorBadgePageUrl,
  buildVisitorQrImageUrl,
  buildVisitorQuickCheckinWhatsAppMessage,
  fetchActiveVisitorCheckinContext,
  lookupVisitorQuickCheckin,
  submitVisitorQuickCheckin,
  type VisitorQuickChild,
  type VisitorQuickLookupStatus,
} from '@/lib/visitorQuickCheckinApi';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type ChildForm = {
  key: string;
  profile_id?: string | null;
  full_name: string;
  birth_date: string;
  age_years: string;
  medical_food_alerts: string;
  special_needs: string;
  additional_care_notes: string;
};

type FlowPhase = 'lookup' | 'form' | 'done';

const emptyChild = (seed?: Partial<ChildForm>): ChildForm => ({
  key: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  profile_id: seed?.profile_id ?? null,
  full_name: seed?.full_name ?? '',
  birth_date: seed?.birth_date ?? '',
  age_years: seed?.age_years ?? '',
  medical_food_alerts: seed?.medical_food_alerts ?? '',
  special_needs: seed?.special_needs ?? '',
  additional_care_notes: seed?.additional_care_notes ?? '',
});

function mapLookupChildren(children: VisitorQuickChild[] | undefined): ChildForm[] {
  if (!children?.length) {
    return [emptyChild()];
  }
  return children.map((child) =>
    emptyChild({
      profile_id: child.profile_id,
      full_name: child.full_name,
      birth_date: child.birth_date ?? '',
      medical_food_alerts: child.medical_food_alerts ?? '',
      special_needs: child.special_needs ?? '',
      additional_care_notes: child.additional_care_notes ?? '',
    })
  );
}

export function VisitorQuickCheckinPanel() {
  const { prefix: entityPrefix } = useEntityPrefix();
  const [phase, setPhase] = useState<FlowPhase>('lookup');
  const [phone, setPhone] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [children, setChildren] = useState<ChildForm[]>([emptyChild()]);
  const [lookupStatus, setLookupStatus] = useState<VisitorQuickLookupStatus | string | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const familyShortCode = useMemo(
    () => (familyId ? formatFamilyCodeShortDisplay(familyId, entityPrefix) : ''),
    [entityPrefix, familyId]
  );

  const isRecurring = lookupStatus === 'recurring_visitor';
  const hasEventCode = eventCode.length === 4;

  const titleHint = useMemo(() => {
    if (lookupStatus === 'recurring_visitor') {
      return lookupMessage ?? 'Visitante recorrente encontrado.';
    }
    if (lookupStatus === 'new_visitor') {
      return 'Novo visitante — preencha os dados.';
    }
    if (!hasEventCode) {
      return 'Aguardando o código do culto ativo (gerado na Programação de Eventos).';
    }
    return 'Informe o celular do responsável. O código do culto ativo já está associado.';
  }, [hasEventCode, lookupMessage, lookupStatus]);

  const loadActiveEvent = useCallback(async () => {
    setLoadingEvent(true);
    setError(null);
    try {
      const context = await fetchActiveVisitorCheckinContext();
      if (!context.success || !context.event?.visitor_checkin_code) {
        setEventCode('');
        setEventName(null);
        setError(context.message || 'Nenhum culto ativo com código de visitante.');
        return;
      }
      setEventCode(String(context.event.visitor_checkin_code).replace(/\D/g, '').slice(0, 4));
      setEventName(context.event.name ?? null);
    } catch (loadError) {
      setEventCode('');
      setEventName(null);
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar o culto ativo.');
    } finally {
      setLoadingEvent(false);
    }
  }, []);

  useEffect(() => {
    void loadActiveEvent();
  }, [loadActiveEvent]);

  const resetFlow = useCallback(() => {
    setPhase('lookup');
    setPhone('');
    setGuardianName('');
    setLgpdAccepted(false);
    setChildren([emptyChild()]);
    setLookupStatus(null);
    setLookupMessage(null);
    setFamilyId(null);
    setError(null);
    void loadActiveEvent();
  }, [loadActiveEvent]);

  const updateChild = useCallback((key: string, patch: Partial<ChildForm>) => {
    setChildren((prev) => prev.map((child) => (child.key === key ? { ...child, ...patch } : child)));
  }, []);

  const removeChild = useCallback((key: string) => {
    setChildren((prev) => (prev.length <= 1 ? prev : prev.filter((child) => child.key !== key)));
  }, []);

  const handleLookup = useCallback(async () => {
    setError(null);
    if (!hasEventCode) {
      setError('Código do culto ativo indisponível. Confira a Programação de Eventos.');
      return;
    }
    setBusy(true);
    try {
      const result = await lookupVisitorQuickCheckin(phone, eventCode);
      setLookupStatus(result.status);
      setLookupMessage(result.message);
      setEventName(result.event?.name ?? eventName);

      if (result.status === 'member_blocked') {
        void appAlert('Membro ativo', result.message, 'Entendi');
        return;
      }

      if (!result.success) {
        setError(result.message);
        return;
      }

      if (result.status === 'recurring_visitor') {
        setGuardianName(result.guardian?.full_name ?? '');
        setLgpdAccepted(result.guardian?.lgpd_accepted === true);
        setChildren(mapLookupChildren(result.children));
        setPhase('form');
        return;
      }

      setGuardianName('');
      setLgpdAccepted(false);
      setChildren([emptyChild()]);
      setPhase('form');
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'Falha ao consultar.');
    } finally {
      setBusy(false);
    }
  }, [eventCode, eventName, hasEventCode, phone]);

  const openVisitorWhatsApp = useCallback(
    (targetPhone: string, targetFamilyId: string, targetGuardianName?: string | null, targetEventName?: string | null) => {
      const message = buildVisitorQuickCheckinWhatsAppMessage({
        guardianName: targetGuardianName,
        familyId: targetFamilyId,
        eventName: targetEventName,
        badgeUrl: buildVisitorBadgePageUrl(targetFamilyId),
        qrImageUrl: buildVisitorQrImageUrl(targetFamilyId),
        entityPrefix,
      });
      return openWhatsAppLikeBirthdaysWithText(targetPhone, message);
    },
    [entityPrefix]
  );

  const handleSubmit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await submitVisitorQuickCheckin({
        phone,
        eventCode,
        guardianName,
        lgpdAccepted,
        children: children.map((child) => ({
          profile_id: child.profile_id,
          full_name: child.full_name,
          birth_date: child.birth_date || null,
          age_years: child.age_years || null,
          medical_food_alerts: child.medical_food_alerts || null,
          special_needs: child.special_needs || null,
          additional_care_notes: child.additional_care_notes || null,
        })),
      });

      if (!result.success || !result.family_id) {
        if (result.status === 'member_blocked') {
          void appAlert('Membro ativo', result.message, 'Entendi');
        }
        setError(result.message);
        return;
      }

      setFamilyId(result.family_id);
      setEventName(result.event?.name ?? eventName);
      setPhase('done');

      openVisitorWhatsApp(
        result.whatsapp?.phone ?? phone,
        result.family_id,
        result.guardian?.full_name ?? guardianName,
        result.event?.name ?? eventName
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Falha ao salvar check-in.');
    } finally {
      setBusy(false);
    }
  }, [children, eventCode, eventName, guardianName, lgpdAccepted, openVisitorWhatsApp, phone]);

  return (
    <View style={styles.root}>
      <KnowledgeSectionTitle
        title="Visitantes / Cadastro Rápido"
        routeKey={KNOWLEDGE_ROUTE.visitantesCadastroRapido}
        titleStyle={styles.title}
      />
      <Text style={styles.hint}>{titleHint}</Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {phase === 'lookup' ? (
          <View style={styles.card}>
            <Text style={styles.label}>Celular do responsável (WhatsApp)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(value) => setPhone(formatBrazilPhoneInput(value))}
              keyboardType="phone-pad"
              placeholder="(11) 98765-4321"
              placeholderTextColor={MINIMAL_UI.textMuted}
              maxLength={15}
              autoComplete="tel"
              textContentType="telephoneNumber"
            />
            <Text style={styles.label}>Código do evento (4 dígitos)</Text>
            <TextInput
              style={[styles.input, styles.inputReadonly]}
              value={loadingEvent ? '…' : eventCode}
              editable={false}
              selectTextOnFocus={false}
              placeholder="0000"
              placeholderTextColor={MINIMAL_UI.textMuted}
              maxLength={4}
              accessibilityLabel="Código do culto ativo, somente leitura"
            />
            {eventName ? <Text style={styles.eventLine}>Culto ativo: {eventName}</Text> : null}
            <Pressable
              style={[styles.primaryButton, (busy || !hasEventCode || loadingEvent) && styles.buttonDisabled]}
              onPress={() => void handleLookup()}
              disabled={busy || !hasEventCode || loadingEvent}
            >
              {busy ? (
                <ActivityIndicator color={MINIMAL_UI.onDark} />
              ) : (
                <Text style={styles.primaryButtonText}>Consultar celular</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {phase === 'form' ? (
          <View style={styles.card}>
            {isRecurring ? (
              <View style={styles.banner}>
                <MaterialIcons name="verified-user" size={18} color={MINIMAL_UI.blueDark} />
                <Text style={styles.bannerText}>{lookupMessage}</Text>
              </View>
            ) : null}

            {eventName ? <Text style={styles.eventLine}>Evento: {eventName}</Text> : null}

            <Text style={styles.label}>Nome completo do responsável</Text>
            <TextInput
              style={styles.input}
              value={guardianName}
              onChangeText={setGuardianName}
              placeholder="Nome do responsável"
              placeholderTextColor={MINIMAL_UI.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Celular</Text>
            <TextInput
              style={[styles.input, styles.inputReadonly]}
              value={phone}
              editable={false}
            />

            <Text style={styles.sectionTitle}>Filhos</Text>
            {children.map((child, index) => (
              <View key={child.key} style={styles.childCard}>
                <View style={styles.childHeader}>
                  <Text style={styles.childTitle}>Filho {index + 1}</Text>
                  {children.length > 1 ? (
                    <Pressable onPress={() => removeChild(child.key)} hitSlop={8}>
                      <MaterialIcons name="close" size={20} color={MINIMAL_UI.blueDark} />
                    </Pressable>
                  ) : null}
                </View>

                <Text style={styles.label}>Nome completo</Text>
                <TextInput
                  style={styles.input}
                  value={child.full_name}
                  onChangeText={(value) => updateChild(child.key, { full_name: value })}
                  placeholder="Nome da criança"
                  placeholderTextColor={MINIMAL_UI.textMuted}
                  autoCapitalize="words"
                />

                <Text style={styles.label}>Data de nascimento (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={child.birth_date}
                  onChangeText={(value) => updateChild(child.key, { birth_date: value })}
                  placeholder="2018-05-20"
                  placeholderTextColor={MINIMAL_UI.textMuted}
                />

                <Text style={styles.label}>Ou idade (anos)</Text>
                <TextInput
                  style={styles.input}
                  value={child.age_years}
                  onChangeText={(value) =>
                    updateChild(child.key, { age_years: value.replace(/\D/g, '').slice(0, 2) })
                  }
                  keyboardType="number-pad"
                  placeholder="Ex.: 7"
                  placeholderTextColor={MINIMAL_UI.textMuted}
                  maxLength={2}
                />

                <Text style={styles.label}>Restrição alimentar</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={child.medical_food_alerts}
                  onChangeText={(value) => updateChild(child.key, { medical_food_alerts: value })}
                  placeholder="Alergias, lactose, glúten…"
                  placeholderTextColor={MINIMAL_UI.textMuted}
                  multiline
                />

                <Text style={styles.label}>Necessidades específicas</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={child.special_needs}
                  onChangeText={(value) => updateChild(child.key, { special_needs: value })}
                  placeholder="Mobilidade, TDAH, autismo, apoio…"
                  placeholderTextColor={MINIMAL_UI.textMuted}
                  multiline
                />

                <Text style={styles.label}>Observações adicionais</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={child.additional_care_notes}
                  onChangeText={(value) => updateChild(child.key, { additional_care_notes: value })}
                  placeholder="Recados para os professores"
                  placeholderTextColor={MINIMAL_UI.textMuted}
                  multiline
                />
              </View>
            ))}

            <Pressable style={styles.secondaryButton} onPress={() => setChildren((prev) => [...prev, emptyChild()])}>
              <Text style={styles.secondaryButtonText}>+ Adicionar filho</Text>
            </Pressable>

            <View style={styles.lgpdRow}>
              <Switch
                value={lgpdAccepted}
                onValueChange={setLgpdAccepted}
                trackColor={{ false: MINIMAL_UI.divider, true: MINIMAL_UI.accent }}
                thumbColor={MINIMAL_UI.background}
              />
              <Text style={styles.lgpdText}>Aceite do termo de imagem (LGPD)</Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable style={styles.secondaryButton} onPress={resetFlow} disabled={busy}>
                <Text style={styles.secondaryButtonText}>Voltar</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.flexButton, busy && styles.buttonDisabled]}
                onPress={() => void handleSubmit()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={MINIMAL_UI.onDark} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {isRecurring ? 'Gerar QR / Check-in' : 'Cadastrar e gerar QR'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        {phase === 'done' && familyId ? (
          <View style={styles.card}>
            <Text style={styles.doneTitle}>Check-in concluído</Text>
            <Text style={styles.eventLine}>Família {familyShortCode || familyId}</Text>
            {eventName ? <Text style={styles.eventLine}>{eventName}</Text> : null}
            <View style={styles.qrWrap}>
              <QRCode value={familyId} size={180} />
            </View>
            <Text style={styles.hint}>
              WhatsApp com link do crachá e imagem do QR Code. Na retirada, valide o QR no Espaço
              Infantil.
            </Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                openVisitorWhatsApp(phone, familyId, guardianName || null, eventName)
              }
            >
              <Text style={styles.secondaryButtonText}>Reenviar QR no WhatsApp</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={resetFlow}>
              <Text style={styles.primaryButtonText}>Novo cadastro</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    backgroundColor: MINIMAL_UI.background,
  },
  label: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: MINIMAL_UI.text,
    fontSize: 15,
    backgroundColor: '#F8FAFC',
  },
  inputReadonly: {
    opacity: 0.75,
  },
  textarea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: MINIMAL_UI.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  bannerText: {
    flex: 1,
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '600',
  },
  eventLine: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    marginBottom: 4,
  },
  sectionTitle: {
    marginTop: 8,
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '700',
  },
  childCard: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.divider,
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginTop: 6,
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  childTitle: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
  },
  lgpdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  lgpdText: {
    flex: 1,
    color: MINIMAL_UI.text,
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  flexButton: {
    flex: 1,
  },
  doneTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  error: {
    color: '#B91C1C',
    fontSize: 13,
  },
});
