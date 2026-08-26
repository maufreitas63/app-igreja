import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  expressVolunteerOpportunityInterest,
  fetchVolunteerOpportunitiesForMe,
  type VolunteerOpportunityMember,
} from '@/lib/volunteerOpportunitiesApi';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp';
import { fetchMinisterialProfileResult } from '@/lib/ministerialProfileQuestionnaire';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  panelHeight: number;
  isActive?: boolean;
};

export function OpportunityMuralCard({ panelHeight, isActive = true }: Props) {
  const router = useRouter();
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [loading, setLoading] = useState(true);
  const [hasResult, setHasResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<VolunteerOpportunityMember[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      await loadEffectiveSessionProfile();
      const profileId = (await resolveEffectiveProfileId())?.trim() ?? null;
      const result = profileId ? await fetchMinisterialProfileResult(profileId) : null;
      const completed = Boolean(result && result.success && result.hasResult);
      setHasResult(completed);
      setRows(completed ? await fetchVolunteerOpportunitiesForMe() : []);
    } catch (loadError) {
      setRows([]);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o mural.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void load();
  }, [isActive, load]);

  const forYou = useMemo(() => rows.filter((row) => row.isPrimaryMatch), [rows]);
  const others = useMemo(() => rows.filter((row) => !row.isPrimaryMatch), [rows]);

  const handleInterest = async (row: VolunteerOpportunityMember) => {
    setBusyId(row.id);

    try {
      const result = await expressVolunteerOpportunityInterest(row.id);

      if (!result.success) {
        Alert.alert('Mural', result.message);
        return;
      }

      const whatsappPhone = normalizePhoneForWhatsApp(row.leaderPhone);

      if (!whatsappPhone) {
        Alert.alert('Mural', `${result.message} O líder ainda não tem telefone cadastrado.`);
        await load();
        return;
      }

      const text = encodeURIComponent(
        `Olá! Vi a vaga "${row.titulo}" no mural e tenho interesse em servir.`
      );
      await Linking.openURL(`https://wa.me/${whatsappPhone}?text=${text}`);
      await load();
    } catch (interestError) {
      Alert.alert(
        'Mural',
        interestError instanceof Error ? interestError.message : 'Não foi possível registrar o interesse.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenTrail = () => {
    void navigateWithScreenAccess(
      router,
      '/trilha-discipulado',
      ACCESS_SCREEN.discipleshipTrail,
      {},
      { deniedMessage: 'Você não tem permissão para abrir a Trilha de Discipulado.' }
    );
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Mural de Oportunidades</Text>
      <Text style={styles.subtitle}>
        Vagas alinhadas ao seu Perfil Ministerial. O resultado da Lição 5.1 não aparece aqui — só o match.
      </Text>

      {loading ? (
        <ActivityIndicator color="#1E3A5F" style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : !hasResult ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>
            Conclua a Lição 5.1 (Descobrindo meus Dons) para ver vagas combinadas com o seu chamado.
          </Text>
          <TouchableOpacity style={styles.primary} onPress={handleOpenTrail} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Abrir Trilha de Discipulado</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Text style={styles.section}>Vagas para você</Text>
          {forYou.length === 0 ? (
            <Text style={styles.empty}>Nenhuma vaga com o seu dom principal no momento.</Text>
          ) : (
            forYou.map((row) => (
              <OpportunityCard
                key={row.id}
                row={row}
                busy={busyId === row.id}
                showSeal
                onInterest={() => void handleInterest(row)}
              />
            ))
          )}
          {others.length ? (
            <>
              <Text style={styles.section}>Outras vagas abertas</Text>
              {others.map((row) => (
                <OpportunityCard
                  key={row.id}
                  row={row}
                  busy={busyId === row.id}
                  showSeal={false}
                  onInterest={() => void handleInterest(row)}
                />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function OpportunityCard({
  row,
  busy,
  showSeal,
  onInterest,
}: {
  row: VolunteerOpportunityMember;
  busy: boolean;
  showSeal: boolean;
  onInterest: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{row.titulo}</Text>
        {showSeal ? (
          <Text style={styles.seal}>Match de {Math.max(row.matchPct, 80)}%</Text>
        ) : null}
      </View>
      {row.ministerioNome ? <Text style={styles.meta}>{row.ministerioNome}</Text> : null}
      {row.descricao ? (
        <Text style={styles.body} numberOfLines={4}>
          {row.descricao}
        </Text>
      ) : null}
      {row.myInterest ? (
        <Text style={styles.interest}>Interesse: {row.myInterest}</Text>
      ) : (
        <TouchableOpacity style={styles.primary} onPress={onInterest} disabled={busy} activeOpacity={0.85}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryText}>Tenho Interesse</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    gap: 8,
  },
  subtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  loader: {
    marginTop: 24,
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
  },
  emptyBox: {
    gap: 12,
    paddingVertical: 12,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 10,
    paddingBottom: 12,
  },
  section: {
    color: '#1E3A5F',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: '#1E3A5F',
    fontSize: 15,
    fontWeight: '800',
  },
  seal: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  meta: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  interest: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  primary: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
