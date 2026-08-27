import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { formatShortName } from '@/lib/formatShortName';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  addSmallGroupMember,
  deleteSmallGroupAdmin,
  enqueueSmallGroupVisitor,
  fetchSmallGroupGuideCandidates,
  fetchSmallGroupRollCall,
  fetchSmallGroupsAdmin,
  publishSmallGroupGuide,
  removeSmallGroupMember,
  saveSmallGroupAdmin,
  searchSmallGroupProfiles,
  setSmallGroupAttendance,
  SMALL_GROUP_WEEKDAYS,
  submitSmallGroupSpiritualReport,
  type SmallGroupAdminRow,
  type SmallGroupGuideCandidate,
  type SmallGroupProfileSummary,
  type SmallGroupRollCallMember,
} from '@/lib/smallGroupsApi';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
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

const todayIso = () => new Date().toISOString().slice(0, 10);

export function MaintenanceSmallGroupsCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canAdmin, setCanAdmin] = useState(false);
  const [groups, setGroups] = useState<SmallGroupAdminRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [name, setName] = useState('');
  const [weekday, setWeekday] = useState('3');
  const [time, setTime] = useState('19:30');
  const [hostId, setHostId] = useState<string>('');
  const [leaderId, setLeaderId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<SmallGroupProfileSummary[]>([]);
  const [meetingDate, setMeetingDate] = useState(todayIso());
  const [roll, setRoll] = useState<SmallGroupRollCallMember[]>([]);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [prayer, setPrayer] = useState('');
  const [pastoralNotes, setPastoralNotes] = useState('');
  const [guides, setGuides] = useState<SmallGroupGuideCandidate[]>([]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedId) ?? null,
    [groups, selectedId]
  );

  const applyGroup = useCallback((group: SmallGroupAdminRow | null) => {
    setSelectedId(group?.id ?? '');
    setName(group?.name ?? '');
    setWeekday(String(group?.meeting_weekday ?? 3));
    setTime(group?.meeting_time || '19:30');
    setHostId(group?.host?.id ?? '');
    setLeaderId(group?.leader?.id ?? '');
    setNotes(group?.notes ?? '');
  }, []);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchSmallGroupsAdmin();
      setCanAdmin(result.canAdmin);
      setGroups(result.groups);
      setSelectedId((current) => {
        if (current && result.groups.some((group) => group.id === current)) {
          return current;
        }

        return result.groups[0]?.id ?? '';
      });
    } catch (loadError) {
      setGroups([]);
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar grupos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void loadGroups();
  }, [isActive, loadGroups]);

  useEffect(() => {
    applyGroup(selectedGroup);
  }, [applyGroup, selectedGroup]);

  const loadRoll = useCallback(async () => {
    if (!selectedId) {
      setRoll([]);
      return;
    }

    try {
      const rows = await fetchSmallGroupRollCall(selectedId, meetingDate);
      setRoll(rows);
    } catch (rollError) {
      setRoll([]);
      Toast.show({
        type: 'error',
        text1: 'Chamada',
        text2: rollError instanceof Error ? rollError.message : 'Falha ao carregar a chamada.',
      });
    }
  }, [meetingDate, selectedId]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void loadRoll();
  }, [isActive, loadRoll]);

  const loadGuides = useCallback(async () => {
    try {
      setGuides(await fetchSmallGroupGuideCandidates());
    } catch {
      setGuides([]);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      void loadGuides();
    }
  }, [isActive, loadGuides]);

  useEffect(() => {
    const query = search.trim();

    if (query.length < 2) {
      setCandidates([]);
      return;
    }

    const timer = setTimeout(() => {
      void searchSmallGroupProfiles(query)
        .then(setCandidates)
        .catch(() => setCandidates([]));
    }, 280);

    return () => clearTimeout(timer);
  }, [search]);

  const notify = (ok: boolean, title: string, message: string) => {
    Toast.show({ type: ok ? 'success' : 'error', text1: title, text2: message });
  };

  const handleSaveGroup = async () => {
    setSaving(true);

    try {
      const result = await saveSmallGroupAdmin({
        id: selectedId || null,
        name,
        meetingWeekday: Number(weekday),
        meetingTime: time,
        hostProfileId: hostId || null,
        leaderProfileId: leaderId || null,
        notes,
      });
      notify(result.success, 'Pequenos grupos', result.message);

      if (result.success) {
        await loadGroups();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleNewGroup = () => {
    applyGroup(null);
    setSelectedId('');
  };

  const handleDeleteGroup = () => {
    if (!selectedId || !selectedGroup) {
      notify(false, 'Pequenos grupos', 'Selecione um grupo para excluir.');
      return;
    }

    const hostLabel = selectedGroup.host?.full_name
      ? formatShortName(selectedGroup.host.full_name)
      : 'não definido';
    const leaderLabel = selectedGroup.leader?.full_name
      ? formatShortName(selectedGroup.leader.full_name)
      : 'não definido';

    Alert.alert(
      'Excluir grupo',
      `O grupo "${selectedGroup.name}" será excluído, incluindo anfitrião (${hostLabel}) e líder (${leaderLabel}). Os cadastros dessas pessoas na igreja permanecem.\n\nEsta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSaving(true);

              try {
                const result = await deleteSmallGroupAdmin(selectedId);
                notify(result.success, 'Pequenos grupos', result.message);

                if (result.success) {
                  applyGroup(null);
                  await loadGroups();
                }
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ]
    );
  };

  const handleAddMember = async (profileId: string) => {
    if (!selectedId) {
      notify(false, 'Membros', 'Salve o grupo antes de incluir participantes.');
      return;
    }

    const result = await addSmallGroupMember(selectedId, profileId);
    notify(result.success, 'Membros', result.message);

    if (result.success) {
      setSearch('');
      setCandidates([]);
      await Promise.all([loadGroups(), loadRoll()]);
    }
  };

  const handleRemoveMember = async (profileId: string) => {
    if (!selectedId) {
      return;
    }

    const result = await removeSmallGroupMember(selectedId, profileId);
    notify(result.success, 'Membros', result.message);

    if (result.success) {
      await Promise.all([loadGroups(), loadRoll()]);
    }
  };

  const handleTogglePresence = async (member: SmallGroupRollCallMember) => {
    if (!selectedId) {
      return;
    }

    const next = !member.present;
    setRoll((current) =>
      current.map((row) => (row.profile_id === member.profile_id ? { ...row, present: next } : row))
    );

    const result = await setSmallGroupAttendance({
      groupId: selectedId,
      meetingDate,
      profileId: member.profile_id,
      present: next,
    });

    if (!result.success) {
      setRoll((current) =>
        current.map((row) =>
          row.profile_id === member.profile_id ? { ...row, present: member.present } : row
        )
      );
      notify(false, 'Chamada', result.message);
    }
  };

  const handleVisitor = async () => {
    if (!selectedId) {
      notify(false, 'Visitante', 'Selecione um grupo.');
      return;
    }

    setSaving(true);

    try {
      const result = await enqueueSmallGroupVisitor(selectedId, visitorName, visitorPhone);
      notify(result.success, 'Visitante', result.message);

      if (result.success) {
        setVisitorName('');
        setVisitorPhone('');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReport = async () => {
    if (!selectedId) {
      notify(false, 'Relatório', 'Selecione um grupo.');
      return;
    }

    setSaving(true);

    try {
      const result = await submitSmallGroupSpiritualReport(selectedId, prayer, pastoralNotes);
      notify(result.success, 'Relatório', result.message);

      if (result.success) {
        setPrayer('');
        setPastoralNotes('');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublishGuide = async (lessonId: string | null) => {
    const result = await publishSmallGroupGuide(lessonId);
    notify(result.success, 'Roteiro', result.message);

    if (result.success) {
      await loadGuides();
    }
  };

  const groupOptions = useMemo(
    () => [
      { value: '', label: canAdmin ? 'Novo grupo' : 'Selecione um grupo' },
      ...groups.map((group) => ({ value: group.id, label: group.name })),
    ],
    [canAdmin, groups]
  );

  const weekdayOptions = SMALL_GROUP_WEEKDAYS.map((item) => ({
    value: String(item.value),
    label: item.label,
  }));

  const pickRole = (kind: 'host' | 'leader', profile: SmallGroupProfileSummary) => {
    if (kind === 'host') {
      setHostId(profile.id);
    } else {
      setLeaderId(profile.id);
    }
  };

  return (
    <View style={[maintenancePanelStyles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Gestão de Pequenos Grupos</Text>
      <Text style={maintenancePanelStyles.panelSubtitle}>
        Chamada, visitantes e relatório espiritual da célula.
      </Text>

      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView
          {...MAINTENANCE_SCROLL_PROPS}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
        >
          <DropdownSelect
            options={groupOptions}
            selectedValue={selectedId}
            onValueChange={(value) => {
              if (!value) {
                handleNewGroup();
                return;
              }

              setSelectedId(value);
            }}
            modalTitle="Pequeno grupo"
            variant={minimal ? 'minimal' : 'vigilance'}
          />

          {canAdmin ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cadastro</Text>
              <TextInput
                style={maintenancePanelStyles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nome do grupo"
                placeholderTextColor="#94A3B8"
              />
              <DropdownSelect
                options={weekdayOptions}
                selectedValue={weekday}
                onValueChange={setWeekday}
                modalTitle="Dia da reunião"
                variant={minimal ? 'minimal' : 'vigilance'}
              />
              <TextInput
                style={maintenancePanelStyles.input}
                value={time}
                onChangeText={setTime}
                placeholder="Horário (HH:MM)"
                placeholderTextColor="#94A3B8"
              />
              <View style={styles.roleRow}>
                <Text style={styles.hint}>
                  Anfitrião:{' '}
                  {hostId
                    ? selectedGroup?.host?.id === hostId && selectedGroup.host.full_name
                      ? formatShortName(selectedGroup.host.full_name)
                      : 'selecionado na busca'
                    : 'não definido'}
                </Text>
                {hostId ? (
                  <TouchableOpacity onPress={() => setHostId('')} accessibilityRole="button">
                    <Text style={styles.link}>Remover</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.roleRow}>
                <Text style={styles.hint}>
                  Líder:{' '}
                  {leaderId
                    ? selectedGroup?.leader?.id === leaderId && selectedGroup.leader.full_name
                      ? formatShortName(selectedGroup.leader.full_name)
                      : 'selecionado na busca'
                    : 'não definido'}
                </Text>
                {leaderId ? (
                  <TouchableOpacity onPress={() => setLeaderId('')} accessibilityRole="button">
                    <Text style={styles.link}>Remover</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                style={maintenancePanelStyles.input}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar membro (nome ou celular)"
                placeholderTextColor="#94A3B8"
              />
              {candidates.map((profile) => (
                <View key={profile.id} style={styles.candidateRow}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {formatShortName(profile.full_name)} · {profile.phone ?? 'sem celular'}
                  </Text>
                  <View style={styles.candidateActions}>
                    <TouchableOpacity onPress={() => pickRole('host', profile)}>
                      <Text style={styles.link}>Anfitrião</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => pickRole('leader', profile)}>
                      <Text style={styles.link}>Líder</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => void handleAddMember(profile.id)}>
                      <Text style={styles.link}>Incluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TextInput
                style={[maintenancePanelStyles.input, styles.multiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Observações internas"
                placeholderTextColor="#94A3B8"
                multiline
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => void handleSaveGroup()}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>{selectedId ? 'Salvar grupo' : 'Criar grupo'}</Text>
              </TouchableOpacity>
              {selectedId ? (
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={handleDeleteGroup}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Excluir grupo, anfitrião e líder"
                >
                  <Text style={styles.dangerButtonText}>Excluir grupo, anfitrião e líder</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chamada</Text>
            <TextInput
              style={maintenancePanelStyles.input}
              value={meetingDate}
              onChangeText={setMeetingDate}
              placeholder="Data (AAAA-MM-DD)"
              placeholderTextColor="#94A3B8"
            />
            {roll.length === 0 ? (
              <Text style={styles.hint}>Nenhum membro vinculado a este grupo.</Text>
            ) : (
              roll.map((member) => (
                <View key={member.profile_id} style={styles.memberRow}>
                  <View style={styles.memberMain}>
                    <Text style={styles.memberName}>{formatShortName(member.full_name)}</Text>
                    <View style={styles.badgeRow}>
                      {member.badges.map((badge) => (
                        <View
                          key={`${member.profile_id}-${badge.badge_code}-${badge.step_order ?? 'x'}`}
                          style={[
                            styles.badge,
                            { backgroundColor: badge.badge_color || '#C9A227' },
                          ]}
                        >
                          <Text style={styles.badgeText} numberOfLines={1}>
                            {badge.badge_title}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Switch
                    value={member.present}
                    onValueChange={() => void handleTogglePresence(member)}
                  />
                  {canAdmin ? (
                    <TouchableOpacity onPress={() => void handleRemoveMember(member.profile_id)}>
                      <FontAwesome name="trash-o" size={16} color="#B91C1C" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visitante</Text>
            <Text style={styles.hint}>Encaminha nome e celular para a fila de Recepção Familiar.</Text>
            <TextInput
              style={maintenancePanelStyles.input}
              value={visitorName}
              onChangeText={setVisitorName}
              placeholder="Nome completo"
              placeholderTextColor="#94A3B8"
            />
            <TextInput
              style={maintenancePanelStyles.input}
              value={visitorPhone}
              onChangeText={setVisitorPhone}
              placeholder="Celular (11 dígitos)"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => void handleVisitor()}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>Enviar à recepção</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Relatório espiritual</Text>
            <TextInput
              style={[maintenancePanelStyles.input, styles.multiline]}
              value={prayer}
              onChangeText={setPrayer}
              placeholder="Pedidos de oração (Intercessão)"
              placeholderTextColor="#94A3B8"
              multiline
            />
            <TextInput
              style={[maintenancePanelStyles.input, styles.multiline]}
              value={pastoralNotes}
              onChangeText={setPastoralNotes}
              placeholder="Observações pastorais (sigilo)"
              placeholderTextColor="#94A3B8"
              multiline
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => void handleReport()}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>Enviar ao cuidado pastoral</Text>
            </TouchableOpacity>
          </View>

          {canAdmin ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Roteiro da semana</Text>
              <Text style={styles.hint}>
                O conteúdo é editado em Temas da Trilha. Publique aqui a lição da semana.
              </Text>
              {guides.map((lesson) => (
                <TouchableOpacity
                  key={lesson.id}
                  style={[styles.guideRow, lesson.is_cell_weekly_guide && styles.guideRowActive]}
                  onPress={() => void handlePublishGuide(lesson.id)}
                >
                  <Text style={styles.memberName} numberOfLines={2}>
                    {lesson.module_title}: {lesson.title}
                  </Text>
                  {lesson.is_cell_weekly_guide ? (
                    <Text style={styles.link}>Publicado</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 16,
  },
  section: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    color: '#1E3A5F',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
  },
  hint: {
    color: '#64748B',
    fontSize: 12,
    flex: 1,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  dangerButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B91C1C',
  },
  dangerButtonText: {
    color: '#B91C1C',
    fontWeight: '800',
    fontSize: 13,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  memberMain: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    color: '#1E3A5F',
    fontSize: 13,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  candidateRow: {
    gap: 4,
    paddingVertical: 4,
  },
  candidateActions: {
    flexDirection: 'row',
    gap: 10,
  },
  link: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 12,
  },
  guideRow: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  guideRowActive: {
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
  },
});
