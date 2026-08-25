import {
  igrejaTransferStatusLabel,
  listarTransferenciasPastoral,
  pastoralCancelarTransferenciaDestino,
  pastoralDecidirTransferenciaOrigem,
  pastoralIniciarTransferenciaEntrada,
  pastoralPreviewTransferenciaEntrada,
  type IgrejaTransferPerson,
  type IgrejaTransferPreview,
  type IgrejaTransferRequest,
} from '@/lib/igrejaTransferenciaApi';
import { formatShortName } from '@/lib/formatShortName';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

type TabKey = 'solicitar' | 'origem' | 'enviados';

const ACCENT = '#3A96DD';

function peopleLabel(people: IgrejaTransferPerson[]) {
  if (people.length === 0) {
    return 'Nenhum membro';
  }
  return people.map((person) => formatShortName(person.fullName)).join(', ');
}

function RequestCard({
  request,
  actions,
}: {
  request: IgrejaTransferRequest;
  actions?: React.ReactNode;
}) {
  return (
    <View style={styles.requestCard}>
      <Text style={styles.requestTitle}>
        {request.scope === 'family' ? 'Família' : 'Membro'} · {igrejaTransferStatusLabel(request.status)}
      </Text>
      <Text style={styles.requestMeta}>
        {request.originCode} → {request.destinationCode}
      </Text>
      <Text style={styles.requestPeople}>{peopleLabel(request.people)}</Text>
      {request.originFamilyId ? (
        <Text style={styles.requestMeta}>Família origem: {request.originFamilyId}</Text>
      ) : null}
      {request.destFamilyId ? (
        <Text style={styles.requestMeta}>Nova família: {request.destFamilyId}</Text>
      ) : null}
      {request.destinationName ? (
        <Text style={styles.requestMeta}>Destino: {request.destinationName}</Text>
      ) : null}
      {request.note ? <Text style={styles.requestNote}>{request.note}</Text> : null}
      {actions}
    </View>
  );
}

export function MaintenanceIgrejaTransferCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const [tab, setTab] = useState<TabKey>('solicitar');
  const [phone, setPhone] = useState('');
  const [includeFamily, setIncludeFamily] = useState(false);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<IgrejaTransferPreview | null>(null);
  const [inbound, setInbound] = useState<IgrejaTransferRequest[]>([]);
  const [outbound, setOutbound] = useState<IgrejaTransferRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lists = await listarTransferenciasPastoral();
      setInbound(lists.inbound);
      setOutbound(lists.outbound);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar transferências.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    void loadLists();
  }, [isActive, loadLists]);

  const handlePreview = async () => {
    if (!phone.replace(/\D/g, '')) {
      Toast.show({ type: 'error', text1: 'Informe o celular para localizar o cadastro' });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const next = await pastoralPreviewTransferenciaEntrada({
        phone,
        includeFamily,
      });
      setPreview(next);
      setIncludeFamily(next.includeFamily);
    } catch (err) {
      setPreview(null);
      Toast.show({
        type: 'error',
        text1: 'Cadastro não encontrado',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview?.originTenantId) {
      Toast.show({ type: 'error', text1: 'Localize o cadastro pelo celular antes de enviar' });
      return;
    }

    const confirmed = await confirmDialog(
      'Enviar pedido de transferência?',
      'A igreja de origem receberá o pedido. Cargos e privilégios de liderança serão removidos na entrada.',
      'Enviar pedido',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      const result = await pastoralIniciarTransferenciaEntrada({
        originTenantId: preview.originTenantId,
        phone,
        includeFamily,
        note,
      });
      Toast.show({ type: 'success', text1: 'Pedido enviado', text2: result.message });
      setPreview(null);
      setNote('');
      setTab('enviados');
      await loadLists();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Falha ao enviar',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDecide = async (request: IgrejaTransferRequest, approve: boolean) => {
    const confirmed = await confirmDialog(
      approve ? 'Aprovar transferência?' : 'Recusar transferência?',
      approve
        ? 'A data de saída será registrada na origem. No destino, um novo código de família será gerado e os cargos administrativos serão zerados.'
        : 'O cadastro permanece nesta igreja.',
      approve ? 'Aprovar e transferir' : 'Recusar',
      'Cancelar',
      { destructive: !approve }
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      const result = await pastoralDecidirTransferenciaOrigem(request.id, approve);
      Toast.show({
        type: approve ? 'success' : 'info',
        text1: approve ? 'Transferência concluída' : 'Pedido recusado',
        text2: result.destFamilyId
          ? `${result.message} Nova família: ${result.destFamilyId}`
          : result.message,
      });
      await loadLists();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Falha ao processar',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (request: IgrejaTransferRequest) => {
    const confirmed = await confirmDialog(
      'Cancelar pedido?',
      'O pedido deixará de aparecer para a igreja de origem.',
      'Cancelar pedido',
      'Voltar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      const result = await pastoralCancelarTransferenciaDestino(request.id);
      Toast.show({ type: 'success', text1: 'Pedido cancelado', text2: result.message });
      await loadLists();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Falha ao cancelar',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const pendingInbound = inbound.filter((row) => row.status === 'pending_origin');
  const historyInbound = inbound.filter((row) => row.status !== 'pending_origin');

  return (
    <View style={[maintenancePanelStyles.panel, { height: contentHeight }]}>
      <MaintenanceHelpInfoTitle
        title="Transferência de Membro"
        helpText="Informe o celular para localizar o cadastro. A igreja de origem só aparece depois da busca. A origem registra a saída; nesta igreja o cadastro entra sem cargos de liderança."
        minimal={minimal}
        titleStyle={minimal ? styles.titleMinimal : styles.title}
        showSubtitleSpacer={false}
      />

      <View style={styles.tabs}>
        {(
          [
            ['solicitar', 'Solicitar'],
            ['origem', `Recebidos (${pendingInbound.length})`],
            ['enviados', 'Enviados'],
          ] as const
        ).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.searchBtn} onPress={() => void loadLists()}>
            <Text style={styles.searchBtnText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'solicitar' ? (
            <>
              <Text style={styles.fieldLabel}>Celular</Text>
              <View style={styles.phoneRow}>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(formatBrazilPhoneInput(value));
                    setPreview(null);
                  }}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={MINIMAL_UI.textMuted}
                  keyboardType="phone-pad"
                />
                <TouchableOpacity
                  style={styles.searchBtnInline}
                  onPress={() => void handlePreview()}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <Text style={styles.searchBtnText}>
                    {saving ? 'Buscando...' : 'Localizar cadastro'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Observação pastoral</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={note}
                onChangeText={setNote}
                placeholder="Motivo da transferência (opcional)"
                placeholderTextColor={MINIMAL_UI.textMuted}
                multiline
              />

              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setIncludeFamily((current) => !current)}
                activeOpacity={0.85}
              >
                <View style={[styles.checkbox, includeFamily && styles.checkboxOn]} />
                <Text style={styles.checkLabel}>Incluir o grupo familiar inteiro</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, styles.submitBtn]}
                onPress={() => void handleSubmit()}
                disabled={saving}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Solicitar transferência"
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? 'Enviando...' : 'Solicitar transferência'}
                </Text>
              </TouchableOpacity>

              {preview ? (
                <View style={styles.previewBox}>
                  <Text style={styles.fieldLabel}>Igreja de origem</Text>
                  <Text style={styles.originFound}>
                    {preview.originCode}
                    {preview.originName ? ` · ${preview.originName}` : ''}
                  </Text>
                  <Text style={styles.previewTitle}>
                    {preview.originName} → {preview.destinationName}
                  </Text>
                  {preview.people.map((person) => (
                    <Text key={person.profileId} style={styles.previewPerson}>
                      {formatShortName(person.fullName)}
                      {person.originFamilyId ? ` · ${person.originFamilyId}` : ''}
                      {person.destBasicRole ? ` · entra como ${person.destBasicRole}` : ''}
                    </Text>
                  ))}
                  <Text style={styles.securityNote}>
                    Cargos administrativos, liderança e privilégios da origem serão removidos.
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {tab === 'origem' ? (
            pendingInbound.length === 0 && historyInbound.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma transferência registrada nesta igreja.</Text>
            ) : (
              <>
                {pendingInbound.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum pedido aguardando decisão.</Text>
                ) : (
                  pendingInbound.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      actions={
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => void handleDecide(request, true)}
                            disabled={saving}
                          >
                            <Text style={styles.primaryBtnText}>Aprovar saída</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.secondaryBtn}
                            onPress={() => void handleDecide(request, false)}
                            disabled={saving}
                          >
                            <Text style={styles.secondaryBtnText}>Recusar</Text>
                          </TouchableOpacity>
                        </View>
                      }
                    />
                  ))
                )}
                {historyInbound.length > 0 ? (
                  <>
                    <Text style={styles.fieldLabel}>Histórico de saídas</Text>
                    {historyInbound.map((request) => (
                      <RequestCard key={request.id} request={request} />
                    ))}
                  </>
                ) : null}
              </>
            )
          ) : null}

          {tab === 'enviados' ? (
            outbound.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum pedido enviado por esta igreja.</Text>
            ) : (
              outbound.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  actions={
                    request.status === 'pending_origin' ? (
                      <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => void handleCancel(request)}
                        disabled={saving}
                      >
                        <Text style={styles.secondaryBtnText}>Cancelar pedido</Text>
                      </TouchableOpacity>
                    ) : null
                  }
                />
              ))
            )
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleMinimal: {
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(58, 150, 221, 0.12)',
    borderColor: ACCENT,
  },
  tabText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: ACCENT,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 16,
    gap: 8,
  },
  fieldLabel: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: MINIMAL_UI.text,
    fontSize: 14,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneInput: {
    width: 148,
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  searchBtnInline: {
    flex: 1,
    minWidth: 0,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 37,
  },
  noteInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  originFound: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '800',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  checkboxOn: {
    backgroundColor: ACCENT,
  },
  checkLabel: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '600',
  },
  searchBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
  },
  previewBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  previewTitle: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '800',
    fontSize: 13,
  },
  previewPerson: {
    color: MINIMAL_UI.text,
    fontSize: 13,
  },
  securityNote: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
    flex: 1,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 20,
  },
  submitBtn: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'stretch',
    minHeight: 48,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
    flex: 1,
  },
  secondaryBtnText: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '800',
    fontSize: 13,
  },
  requestCard: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  requestTitle: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '800',
    fontSize: 13,
  },
  requestMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  requestPeople: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '600',
  },
  requestNote: {
    color: MINIMAL_UI.text,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  emptyText: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
    fontSize: 13,
  },
});
