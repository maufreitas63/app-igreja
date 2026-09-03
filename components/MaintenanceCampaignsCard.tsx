import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import { SegmentChipRow } from '@/components/ui/SegmentChipRow';
import { PixAccountsSettings } from '@/components/PixAccountsSettings';
import {
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUSES,
  fetchCampaignProjectsAdmin,
  formatCampaignBrl,
  formatCampaignCentsShort,
  formatCampaignProgressLabel,
  pickAndUploadCampaignCover,
  saveCampaignProject,
  type CampaignProject,
  type CampaignStatus,
} from '@/lib/campaignProjectsApi';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  fetchSessionPixAccounts,
  normalizePixAccountSlot,
  pixAccountDropdownOptions,
  type PixAccountSlot,
  type PixAccountsBundle,
} from '@/lib/pixAccountsApi';
import { formatBrazilDateInput } from '@/lib/inputMasks';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

const POLL_MS = 15_000;
const NEW_VALUE = '';

const parseCentsInput = (value: string) => {
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return 0;
  }

  return Math.min(99, Number.parseInt(digits.slice(-2), 10)) / 100;
};

/** Formata número como BRL sem símbolo: 1000000 → "1.000.000,00" */
const formatMetaDisplay = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

/** Digita da direita para a esquerda, como no restante do app (1 = 0,01). */
const handleMetaChange = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '') || '';

  if (!digits) {
    return '';
  }

  return formatMetaDisplay(Number.parseInt(digits, 10) / 100);
};

const parseMetaInput = (value: string): number => {
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return Number.NaN;
  }

  return Number.parseInt(digits, 10) / 100;
};

/** ISO (AAAA-MM-DD) → DD/MM/AAAA */
const isoToBr = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

/** DD/MM/AAAA → AAAA-MM-DD (ou null se inválido/incompleto) */
const brToIso = (br: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  return Number.isNaN(Date.parse(`${iso}T12:00:00Z`)) ? null : iso;
};

export function MaintenanceCampaignsCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignProject[]>([]);
  const [selectedId, setSelectedId] = useState(NEW_VALUE);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [meta, setMeta] = useState('');
  const [dataInicio, setDataInicio] = useState(() => isoToBr(new Date().toISOString().slice(0, 10)));
  const [dataFim, setDataFim] = useState('');
  const [status, setStatus] = useState<CampaignStatus>('rascunho');
  const [centavos, setCentavos] = useState('60');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [pixSlot, setPixSlot] = useState<PixAccountSlot>('1');
  const [pixBundle, setPixBundle] = useState<PixAccountsBundle | null>(null);

  const selected = useMemo(
    () => campaigns.find((item) => item.id === selectedId) ?? null,
    [campaigns, selectedId]
  );

  const applyCampaign = (campaign: CampaignProject | null) => {
    setTitulo(campaign?.titulo ?? '');
    setDescricao(campaign?.descricao ?? '');
    setMeta(
      campaign?.meta_financeira != null && campaign.meta_financeira > 0
        ? formatMetaDisplay(campaign.meta_financeira)
        : ''
    );
    setDataInicio(isoToBr(campaign?.data_inicio?.slice(0, 10)) || isoToBr(new Date().toISOString().slice(0, 10)));
    setDataFim(isoToBr(campaign?.data_fim?.slice(0, 10)));
    setStatus(campaign?.status ?? 'rascunho');
    setCentavos(
      String(Math.round((campaign?.centavos_referencia ?? 0.6) * 100)).padStart(2, '0')
    );
    setCoverUrl(campaign?.cover_url ?? null);
    setPixSlot(campaign?.chave_pix_selecionada ?? pixBundle?.defaultSlot ?? '1');
  };

  const load = useCallback(async () => {
    setError(null);

    try {
      const [rows, accounts] = await Promise.all([
        fetchCampaignProjectsAdmin(),
        fetchSessionPixAccounts().catch(() => null),
      ]);
      setCampaigns(rows);
      setPixBundle(accounts);
    } catch (loadError) {
      setCampaigns([]);
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar campanhas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void load();
    const timer = setInterval(() => {
      void load();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [isActive, load]);

  const handleSelect = (value: string) => {
    setSelectedId(value);
    applyCampaign(value ? campaigns.find((item) => item.id === value) ?? null : null);
  };

  const handleSave = async () => {
    const metaValue = meta.trim() ? parseMetaInput(meta) : null;
    const centsValue = parseCentsInput(centavos);

    if (!titulo.trim()) {
      Toast.show({ type: 'error', text1: 'Campanha', text2: 'Informe o título da campanha.' });
      return;
    }

    if (metaValue != null && (!Number.isFinite(metaValue) || metaValue <= 0)) {
      Toast.show({ type: 'error', text1: 'Campanha', text2: 'Informe uma meta financeira válida ou deixe em branco.' });
      return;
    }

    if (centsValue < 0.01) {
      Toast.show({ type: 'error', text1: 'Campanha', text2: 'Informe os centavos de referência.' });
      return;
    }

    const dataInicioIso = brToIso(dataInicio);
    const dataFimIso = dataFim.trim() ? brToIso(dataFim) : null;

    if (!dataInicioIso) {
      Toast.show({ type: 'error', text1: 'Campanha', text2: 'Informe a data de início em DD/MM/AAAA.' });
      return;
    }

    if (dataFim.trim() && !dataFimIso) {
      Toast.show({ type: 'error', text1: 'Campanha', text2: 'Informe a data de fim em DD/MM/AAAA.' });
      return;
    }

    setSaving(true);

    try {
      const result = await saveCampaignProject({
        id: selectedId || null,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        metaFinanceira: metaValue,
        dataInicio: dataInicioIso,
        dataFim: dataFimIso,
        status,
        centavosReferencia: centsValue,
        coverUrl,
        chavePixSelecionada: pixSlot,
      });
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Campanha',
        text2: result.message,
      });

      if (result.success) {
        if (result.id) {
          setSelectedId(result.id);
        }

        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCover = async () => {
    try {
      const nextUrl = await pickAndUploadCampaignCover(selectedId || null);
      if (nextUrl) {
        setCoverUrl(nextUrl);
      }
    } catch (uploadError) {
      Toast.show({
        type: 'error',
        text1: 'Capa',
        text2: uploadError instanceof Error ? uploadError.message : 'Falha no upload.',
      });
    }
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <MaintenanceHelpInfoTitle
        title="Gestão de Campanhas"
        helpText="Cadastre projetos com meta, prazo, centavos simbólicos e a conta Pix que receberá as contribuições. O Pix Copia e Cola aplica o sufixo automaticamente; os depósitos ficam fora da receita ordinária."
        minimal={minimal}
        titleStyle={minimal ? styles.titleMinimal : maintenancePanelStyles.panelTitle}
      />

      {loading ? (
        <ActivityIndicator color={minimal ? MINIMAL_UI.accent : '#1E3A5F'} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          {...MAINTENANCE_SCROLL_PROPS}
        >
          <DropdownSelect
            options={[
              { value: NEW_VALUE, label: 'Nova campanha' },
              ...campaigns.map((item) => ({
                value: item.id,
                label: `${item.titulo} · ${CAMPAIGN_STATUS_LABEL[item.status]}`,
              })),
            ]}
            selectedValue={selectedId}
            onValueChange={handleSelect}
            modalTitle="Campanha"
            variant={minimal ? 'minimal' : 'default'}
          />

          {selected ? (
            <View style={styles.stats}>
              <Text style={styles.statTitle}>Desempenho</Text>
              <Text style={styles.statLine}>
                {formatCampaignProgressLabel(
                  selected.valor_arrecadado,
                  selected.meta_financeira,
                  selected.progress_pct
                )}
              </Text>
              <Text style={styles.statLine}>
                Doadores únicos: {selected.unique_donors} · Doações: {selected.donations_count}
              </Text>
              <Text style={styles.statLine}>
                Velocidade: {formatCampaignBrl(selected.velocity_per_day)} / dia
              </Text>
              <Text style={styles.statLine}>
                Centavos: {formatCampaignCentsShort(selected.centavos_referencia)}
              </Text>
              <Text style={styles.statLine}>
                Pix:{' '}
                {pixBundle?.accounts.find((item) => item.slot === selected.chave_pix_selecionada)
                  ?.label ?? `Conta ${selected.chave_pix_selecionada}`}
              </Text>
            </View>
          ) : null}

          {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.cover} /> : null}

          <TextInput
            style={maintenancePanelStyles.input}
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Título"
            placeholderTextColor="#94A3B8"
          />
          <TextInput
            style={[maintenancePanelStyles.input, styles.multiline]}
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Descrição"
            placeholderTextColor="#94A3B8"
            multiline
          />
          <TextInput
            style={maintenancePanelStyles.input}
            value={meta}
            onChangeText={(v) => setMeta(handleMetaChange(v))}
            placeholder="Meta financeira (R$) — opcional"
            placeholderTextColor="#94A3B8"
            keyboardType="decimal-pad"
          />
          <View style={styles.row}>
            <TextInput
              style={[maintenancePanelStyles.input, styles.flex]}
              value={dataInicio}
              onChangeText={(v) => setDataInicio(formatBrazilDateInput(v))}
              placeholder="Início DD/MM/AAAA"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />
            <TextInput
              style={[maintenancePanelStyles.input, styles.flex]}
              value={dataFim}
              onChangeText={(v) => setDataFim(formatBrazilDateInput(v))}
              placeholder="Fim DD/MM/AAAA"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />
          </View>
          <Text style={styles.fieldLabel}>Centavos simbólicos de referência</Text>
          <TextInput
            style={maintenancePanelStyles.input}
            value={centavos}
            onChangeText={setCentavos}
            placeholder="Ex.: 60 (vira 0,60 no Pix)"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            accessibilityLabel="Centavos simbólicos de referência"
          />
          <Text style={styles.hint}>
            O Pix Copia e Cola do membro recebe automaticamente{' '}
            {formatCampaignCentsShort(parseCentsInput(centavos) || 0.6)}. Depósitos com esse sufixo
            são conciliados a este projeto e ficam fora da receita ordinária.
          </Text>
          <Text style={styles.fieldLabel}>Conta Pix deste projeto</Text>
          <DropdownSelect
            options={pixAccountDropdownOptions(pixBundle)}
            selectedValue={pixSlot}
            onValueChange={(value) => setPixSlot(normalizePixAccountSlot(value))}
            modalTitle="Conta Pix do projeto"
            variant={minimal ? 'minimal' : 'default'}
          />
          <Text style={styles.hint}>
            O Copia e Cola desta campanha usa a chave escolhida, com os centavos simbólicos de
            identificação.
          </Text>
          <PixAccountsSettings
            isActive={isActive}
            minimal={minimal}
            compact
            onBundleChange={setPixBundle}
          />
          <SegmentChipRow
            variant={minimal ? 'vigilance' : 'default'}
            compact
            options={CAMPAIGN_STATUSES.map((item) => ({
              value: item,
              label: CAMPAIGN_STATUS_LABEL[item],
            }))}
            selectedValue={status}
            onSelect={(value) => setStatus(value as CampaignStatus)}
          />
          <TouchableOpacity style={styles.secondary} onPress={() => void handleCover()}>
            <Text style={styles.secondaryText}>Enviar imagem de capa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primary} onPress={() => void handleSave()} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>Salvar campanha</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    minHeight: 0,
    gap: 8,
  },
  titleMinimal: {
    color: MINIMAL_UI.accent,
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 17,
  },
  error: {
    color: '#B91C1C',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    gap: 8,
    paddingBottom: 12,
  },
  stats: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  statTitle: {
    color: '#1E3A5F',
    fontWeight: '800',
    textAlign: 'center',
  },
  statLine: {
    color: '#334155',
    fontSize: 12,
    textAlign: 'center',
  },
  cover: {
    width: '100%',
    height: 88,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  multiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  fieldLabel: {
    color: '#1E3A5F',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    color: '#1D4ED8',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  secondary: {
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#1E3A5F',
    fontWeight: '800',
  },
  primary: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
