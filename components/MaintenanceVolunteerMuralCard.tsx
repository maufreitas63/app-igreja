import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import { SegmentChipRow } from '@/components/ui/SegmentChipRow';
import {
  fetchMaintenanceScaleTypes,
  registerScaleVolunteer,
  searchProfilesForScaleVolunteer,
  type ProfileForScaleVolunteer,
} from '@/lib/maintenanceScaleVolunteersApi';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { mapLegacyRoomDisplayLabel } from '@/lib/roomDisplayLabels';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { confirmDialog } from '@/lib/confirmDialog';
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp';
import {
  fetchOpportunityMatchingMembers,
  fetchVolunteerOpportunitiesAdmin,
  OPPORTUNITY_STATUS_LABEL,
  OPPORTUNITY_STATUSES,
  resolveVolunteerOpportunityInterest,
  saveVolunteerOpportunity,
  VOLUNTEER_GIFT_CODES,
  type OpportunityMatchingMember,
  type OpportunityStatus,
  type VolunteerOpportunityAdmin,
} from '@/lib/volunteerOpportunitiesApi';
import { MINISTERIAL_PROFILE_LABELS, type MinisterialProfileCode } from '@/lib/ministerialProfileQuestionnaire';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const NEW_VALUE = '';

export function MaintenanceVolunteerMuralCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<VolunteerOpportunityAdmin[]>([]);
  const [selectedId, setSelectedId] = useState(NEW_VALUE);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoEscalaId, setTipoEscalaId] = useState('');
  const [leaderProfileId, setLeaderProfileId] = useState<string | null>(null);
  const [leaderQuery, setLeaderQuery] = useState('');
  const [leaderHits, setLeaderHits] = useState<ProfileForScaleVolunteer[]>([]);
  const [gifts, setGifts] = useState<MinisterialProfileCode[]>([]);
  const [status, setStatus] = useState<OpportunityStatus>('rascunho');
  const [scaleTypes, setScaleTypes] = useState<{ id: string; name: string }[]>([]);
  const [matches, setMatches] = useState<OpportunityMatchingMember[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const applyRow = (row: VolunteerOpportunityAdmin | null) => {
    setTitulo(row?.titulo ?? '');
    setDescricao(row?.descricao ?? '');
    setTipoEscalaId(row?.tipoEscalaId ?? '');
    setLeaderProfileId(row?.leaderProfileId ?? null);
    setLeaderQuery(row?.leaderName ?? '');
    setLeaderHits([]);
    setGifts(row?.requiredGifts ?? []);
    setStatus(row?.status ?? 'rascunho');
  };

  const load = useCallback(async () => {
    setError(null);

    try {
      const [adminRows, types] = await Promise.all([
        fetchVolunteerOpportunitiesAdmin(),
        fetchMaintenanceScaleTypes(),
      ]);
      setRows(adminRows);
      setScaleTypes(types.map((type) => ({ id: type.id, name: type.name })));
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

  useEffect(() => {
    applyRow(selected);
  }, [selected]);

  useEffect(() => {
    if (!selectedId) {
      setMatches([]);
      return;
    }

    let cancelled = false;
    setMatchesLoading(true);

    void fetchOpportunityMatchingMembers(selectedId)
      .then((list) => {
        if (!cancelled) {
          setMatches(list);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMatchesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleSearchLeader = async (text: string) => {
    setLeaderQuery(text);
    setLeaderProfileId(null);

    if (text.trim().length < 2) {
      setLeaderHits([]);
      return;
    }

    try {
      setLeaderHits(await searchProfilesForScaleVolunteer(text, 8));
    } catch {
      setLeaderHits([]);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const result = await saveVolunteerOpportunity({
        id: selectedId || null,
        titulo,
        descricao,
        tipoEscalaId: tipoEscalaId || null,
        leaderProfileId,
        requiredGifts: gifts,
        status,
      });

      if (!result.success) {
        Toast.show({ type: 'error', text1: 'Mural', text2: result.message });
        return;
      }

      Toast.show({ type: 'success', text1: 'Mural', text2: result.message });
      await load();
      if (result.id) {
        setSelectedId(result.id);
      }
    } catch (saveError) {
      Toast.show({
        type: 'error',
        text1: 'Mural',
        text2: saveError instanceof Error ? saveError.message : 'Falha ao salvar.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (member: OpportunityMatchingMember) => {
    if (!member.interestId) {
      Alert.alert('Mural', 'O membro ainda não registrou interesse nesta vaga.');
      return;
    }

    const result = await resolveVolunteerOpportunityInterest(member.interestId, true);

    if (!result.success) {
      Alert.alert('Mural', result.message);
      return;
    }

    Toast.show({ type: 'success', text1: 'Mural', text2: result.message });

    if (result.suggestScaleVolunteer && result.profileId && result.tipoEscalaId) {
      const confirmed = await confirmDialog(
        'Servos em Disponibilidade',
        `Incluir ${member.fullName} na escala deste ministério?`,
        'Incluir',
        'Agora não'
      );

      if (confirmed) {
        try {
          const volunteer = await registerScaleVolunteer(result.tipoEscalaId, result.profileId);
          Toast.show({
            type: 'success',
            text1: 'Servos',
            text2: volunteer.message ?? 'Servo incluído.',
          });
        } catch (volunteerError) {
          Alert.alert(
            'Servos',
            volunteerError instanceof Error
              ? volunteerError.message
              : 'Não foi possível incluir o servo. Faça isso em Servos em Disponibilidade.'
          );
        }
      }
    }

    setMatches(await fetchOpportunityMatchingMembers(selectedId));
  };

  const handleWhatsapp = async (phone: string | null, name: string) => {
    const whatsappPhone = normalizePhoneForWhatsApp(phone);

    if (!whatsappPhone) {
      Alert.alert('WhatsApp', 'Este membro não tem telefone cadastrado.');
      return;
    }

    const text = encodeURIComponent(
      `Olá, ${name.split(' ')[0]}! Vimos seu Perfil Ministerial e gostaríamos de convidar você para uma vaga de serviço.`
    );
    await Linking.openURL(`https://wa.me/${whatsappPhone}?text=${text}`);
  };

  const toggleGift = (code: MinisterialProfileCode) => {
    setGifts((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <MaintenanceHelpInfoTitle
        title="Mural de Voluntários"
        helpText="Cadastre vagas, vincule o ministério (tipo de escala) e os dons da Lição 5.1. A busca ativa lista quem já concluiu o questionário e combina com a vaga. O perfil ministerial não aparece no mural público."
        minimal={minimal}
      />

      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.blueDark} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <ScrollView {...MAINTENANCE_SCROLL_PROPS} contentContainerStyle={styles.content}>
          <Text style={[maintenancePanelStyles.panelTitle, styles.blockTitle]}>Editor de vagas</Text>
          <DropdownSelect
            selectedValue={selectedId}
            placeholder="Nova vaga"
            modalTitle="Vaga"
            variant={minimal ? 'minimal' : 'default'}
            options={[
              { value: NEW_VALUE, label: 'Nova vaga' },
              ...rows.map((row) => ({
                value: row.id,
                label: `${row.titulo} (${OPPORTUNITY_STATUS_LABEL[row.status]})`,
              })),
            ]}
            onValueChange={(value) => setSelectedId(value)}
          />

          <Text style={styles.label}>Título</Text>
          <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} />

          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={descricao}
            onChangeText={setDescricao}
            multiline
          />

          <Text style={styles.label}>Ministério (tipo de escala)</Text>
          <DropdownSelect
            selectedValue={tipoEscalaId}
            placeholder="Selecione"
            modalTitle="Ministério"
            variant={minimal ? 'minimal' : 'default'}
            options={scaleTypes.map((type) => ({
              value: type.id,
              label: mapLegacyRoomDisplayLabel(type.name),
            }))}
            onValueChange={setTipoEscalaId}
          />

          <Text style={styles.label}>Líder responsável (WhatsApp)</Text>
          <TextInput
            style={styles.input}
            value={leaderQuery}
            onChangeText={(text) => void handleSearchLeader(text)}
            placeholder="Buscar pelo nome"
            placeholderTextColor="#64748B"
          />
          {leaderHits.map((hit) => (
            <TouchableOpacity
              key={hit.id}
              style={styles.hit}
              onPress={() => {
                setLeaderProfileId(hit.id);
                setLeaderQuery(hit.fullName);
                setLeaderHits([]);
              }}
            >
              <Text style={styles.hitText}>{hit.fullName}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.label}>Dons necessários (Lição 5.1)</Text>
          <View style={styles.giftWrap}>
            {VOLUNTEER_GIFT_CODES.map((code) => (
              <TouchableOpacity
                key={code}
                style={[styles.giftChip, gifts.includes(code) && styles.giftChipOn]}
                onPress={() => toggleGift(code)}
              >
                <Text style={[styles.giftChipText, gifts.includes(code) && styles.giftChipTextOn]}>
                  {MINISTERIAL_PROFILE_LABELS[code]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Status</Text>
          <SegmentChipRow
            options={OPPORTUNITY_STATUSES.map((item) => ({
              value: item,
              label: OPPORTUNITY_STATUS_LABEL[item],
            }))}
            selectedValue={status}
            onSelect={setStatus}
            variant="vigilance"
            compact
          />

          <TouchableOpacity style={styles.save} onPress={() => void handleSave()} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>{selectedId ? 'Salvar vaga' : 'Cadastrar vaga'}</Text>
            )}
          </TouchableOpacity>

          {selectedId ? (
            <>
              <Text style={[maintenancePanelStyles.panelTitle, styles.blockTitle]}>
                Busca ativa ({matches.length})
              </Text>
              <Text style={styles.hint}>
                Membros que concluíram a Lição 5.1 com dons compatíveis. Convide pelo WhatsApp; o
                perfil completo permanece restrito à liderança.
              </Text>
              {matchesLoading ? (
                <ActivityIndicator color={MINIMAL_UI.blueDark} />
              ) : matches.length === 0 ? (
                <Text style={styles.hint}>Nenhum membro compatível ainda.</Text>
              ) : (
                matches.map((member) => (
                  <View key={member.profileId} style={styles.matchRow}>
                    <Text style={styles.matchName}>{member.fullName}</Text>
                    <Text style={styles.matchMeta}>
                      {member.perfilLabel} · Match {member.matchPct}%
                      {member.lessonCompleted ? ' · Lição 5.1 concluída' : ''}
                      {member.interestStatus ? ` · Interesse ${member.interestStatus}` : ''}
                    </Text>
                    <View style={styles.matchActions}>
                      <TouchableOpacity
                        style={styles.secondary}
                        onPress={() => void handleWhatsapp(member.phone, member.fullName)}
                      >
                        <Text style={styles.secondaryText}>WhatsApp</Text>
                      </TouchableOpacity>
                      {member.interestStatus === 'pendente' && member.interestId ? (
                        <TouchableOpacity style={styles.save} onPress={() => void handleAccept(member)}>
                          <Text style={styles.saveText}>Aceitar</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    minHeight: 0,
  },
  content: {
    gap: 8,
    paddingBottom: 16,
  },
  blockTitle: {
    marginTop: 8,
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
  },
  label: {
    color: '#1E3A5F',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  hit: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  hitText: {
    color: '#1E3A5F',
    fontWeight: '600',
  },
  giftWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  giftChip: {
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  giftChipOn: {
    backgroundColor: '#1E3A5F',
  },
  giftChipText: {
    color: '#1E3A5F',
    fontSize: 12,
    fontWeight: '700',
  },
  giftChipTextOn: {
    color: '#FFFFFF',
  },
  save: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  matchRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  matchName: {
    color: '#1E3A5F',
    fontWeight: '800',
  },
  matchMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  matchActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  secondary: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryText: {
    color: '#1E3A5F',
    fontWeight: '800',
    fontSize: 12,
  },
});
