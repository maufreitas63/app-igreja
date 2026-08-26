import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import { SegmentChipRow } from '@/components/ui/SegmentChipRow';
import {
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUSES,
  fetchCampaignProjectsAdmin,
  formatCampaignBrl,
  formatCampaignCentsShort,
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
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState('');
  const [status, setStatus] = useState<CampaignStatus>('rascunho');
  const [centavos, setCentavos] = useState('60');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const selected = useMemo(
    () => campaigns.find((item) => item.id === selectedId) ?? null,
    [campaigns, selectedId]
  );

  const applyCampaign = (campaign: CampaignProject | null) => {
    setTitulo(campaign?.titulo ?? '');
    setDescricao(campaign?.descricao ?? '');
    setMeta(campaign ? String(campaign.meta_financeira) : '');
    setDataInicio(campaign?.data_inicio?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setDataFim(campaign?.data_fim?.slice(0, 10) || '');
    setStatus(campaign?.status ?? 'rascunho');
    setCentavos(
      String(Math.round((campaign?.centavos_referencia ?? 0.6) * 100)).padStart(2, '0')
    );
    setCoverUrl(campaign?.cover_url ?? null);
  };

  const load = useCallback(async () => {
    setError(null);

    try {
      const rows = await fetchCampaignProjectsAdmin();
      setCampaigns(rows);
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
    const metaValue = Number(meta.replace(',', '.'));
    const centsValue = parseCentsInput(centavos);

    if (!titulo.trim() || !Number.isFinite(metaValue) || metaValue <= 0) {
      Toast.show({ type: 'error', text1: 'Campanha', text2: 'Informe título e meta financeira.' });
      return;
    }

    if (centsValue < 0.01) {
      Toast.show({ type: 'error', text1: 'Campanha', text2: 'Informe os centavos de referência.' });
      return;
    }

    setSaving(true);

    try {
      const result = await saveCampaignProject({
        id: selectedId || null,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        metaFinanceira: metaValue,
        dataInicio,
        dataFim: dataFim.trim() || null,
        status,
        centavosReferencia: centsValue,
        coverUrl,
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

  const pct = Math.max(0, Math.min(100, selected?.progress_pct ?? 0));

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <MaintenanceHelpInfoTitle
        title="Gestão de Campanhas"
        helpText="Cadastre projetos com meta, prazo e centavos simbólicos. O Pix Copia e Cola aplica esse sufixo automaticamente; os depósitos são reconhecidos e ficam fora da receita ordinária."
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
                {pct.toFixed(0)}% · {formatCampaignBrl(selected.valor_arrecadado)} de{' '}
                {formatCampaignBrl(selected.meta_financeira)}
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
            onChangeText={setMeta}
            placeholder="Meta financeira (R$)"
            placeholderTextColor="#94A3B8"
            keyboardType="decimal-pad"
          />
          <View style={styles.row}>
            <TextInput
              style={[maintenancePanelStyles.input, styles.flex]}
              value={dataInicio}
              onChangeText={setDataInicio}
              placeholder="Início AAAA-MM-DD"
              placeholderTextColor="#94A3B8"
            />
            <TextInput
              style={[maintenancePanelStyles.input, styles.flex]}
              value={dataFim}
              onChangeText={setDataFim}
              placeholder="Fim (opcional)"
              placeholderTextColor="#94A3B8"
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
