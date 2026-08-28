import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { MonthlyDatePickerModal } from '@/components/ui/MonthlyDatePickerModal';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatFullName } from '@/lib/fullName';
import { formatShortName } from '@/lib/formatShortName';
import { formatBrazilPhoneInput, formatBrazilTimeInput } from '@/lib/inputMasks';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  calendarDateInputToBr,
  calendarDateInputToIso,
} from '@/lib/monthlyDatePicker';
import {
  addSmallGroupMember,
  deleteSmallGroupAdmin,
  enqueueSmallGroupVisitor,
  fetchSmallGroupGuideCandidates,
  fetchSmallGroupManualGuide,
  fetchSmallGroupRollCall,
  fetchSmallGroupsAdmin,
  formatSmallGroupMeetingLabel,
  publishSmallGroupGuide,
  removeSmallGroupMember,
  saveSmallGroupAdmin,
  saveSmallGroupManualGuide,
  searchSmallGroupProfiles,
  setSmallGroupAttendance,
  submitSmallGroupSpiritualReport,
  type SmallGroupAdminRow,
  type SmallGroupGuideCandidate,
  type SmallGroupMeeting,
  type SmallGroupProfileSummary,
  type SmallGroupRollCallMember,
} from '@/lib/smallGroupsApi';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
  const [meetings, setMeetings] = useState<SmallGroupMeeting[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [rollDatePickerOpen, setRollDatePickerOpen] = useState(false);
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
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualVideoUrl, setManualVideoUrl] = useState('');

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedId) ?? null,
    [groups, selectedId]
  );

  const applyGroup = useCallback((group: SmallGroupAdminRow | null) => {
    setSelectedId(group?.id ?? '');
    setName(group?.name ?? '');
    setMeetings(group?.meetings ?? []);
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
      const [lessons, manual] = await Promise.all([
        fetchSmallGroupGuideCandidates(),
        fetchSmallGroupManualGuide().catch(() => null),
      ]);
      setGuides(lessons);
      setManualTitle(manual?.title ?? '');
      setManualContent(manual?.content ?? '');
      setManualVideoUrl(manual?.video_url ?? '');
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
      const firstMeeting = meetings[0];
      const meetingWeekday = firstMeeting
        ? new Date(`${firstMeeting.meeting_date}T12:00:00`).getDay()
        : 3;
      const result = await saveSmallGroupAdmin({
        id: selectedId || null,
        name,
        meetingWeekday,
        meetingTime: firstMeeting?.meeting_time || '19:30',
        hostProfileId: hostId || null,
        leaderProfileId: leaderId || null,
        notes,
        meetings,
      });
      notify(result.success, 'Pequenos grupos', result.message);

      if (result.success) {
        if (result.id) {
          setSelectedId(result.id);
        }
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

  const handleDeleteGroup = async () => {
    if (!selectedId || !selectedGroup) {
      notify(false, 'Pequenos grupos', 'Selecione um grupo para excluir.');
      return;
    }

    const confirmed = await confirmDialog(
      'Excluir grupo',
      `O grupo "${selectedGroup.name}" será excluído, com a lista de participantes e as chamadas. Os cadastros de anfitrião e líder na igreja permanecem.\n\nEsta ação não pode ser desfeita.`,
      'Excluir',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

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

  const handleSaveManualGuide = async () => {
    setSaving(true);

    try {
      const result = await saveSmallGroupManualGuide({
        title: manualTitle,
        content: manualContent,
        videoUrl: manualVideoUrl,
      });
      notify(result.success, 'Roteiro', result.message);

      if (result.success) {
        await loadGuides();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMeetingDate = (dateInput: string) => {
    const iso = calendarDateInputToIso(dateInput);
    if (!iso) {
      return;
    }

    setMeetings((current) => {
      const exists = current.some((item) => item.meeting_date === iso);
      if (exists) {
        return current.filter((item) => item.meeting_date !== iso);
      }

      return [...current, { meeting_date: iso, meeting_time: '19:30' }].sort((left, right) =>
        left.meeting_date.localeCompare(right.meeting_date)
      );
    });
  };

  const handleMeetingTimeChange = (meetingDateValue: string, nextTime: string) => {
    const masked = formatBrazilTimeInput(nextTime);
    setMeetings((current) =>
      current.map((item) =>
        item.meeting_date === meetingDateValue ? { ...item, meeting_time: masked } : item
      )
    );
  };

  const groupOptions = useMemo(
    () => [
      { value: '', label: canAdmin ? 'Novo grupo' : 'Selecione um grupo' },
      ...groups.map((group) => ({ value: group.id, label: group.name })),
    ],
    [canAdmin, groups]
  );

  const meetingDateKeys = useMemo(
    () => meetings.map((item) => calendarDateInputToBr(item.meeting_date)),
    [meetings]
  );

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
              <Pressable
                style={styles.dateTrigger}
                onPress={() => setCalendarOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Abrir calendário de reuniões"
              >
                <Text style={styles.dateTriggerText}>
                  {meetings.length
                    ? `${meetings.length} ${meetings.length === 1 ? 'data selecionada' : 'datas selecionadas'}`
                    : 'Selecionar datas no calendário'}
                </Text>
                <MaterialIcons name="calendar-today" size={18} color="#94A3B8" />
              </Pressable>
              {meetings.map((meeting) => (
                <View key={meeting.meeting_date} style={styles.meetingRow}>
                  <Text style={styles.meetingDate}>
                    {formatSmallGroupMeetingLabel(meeting.meeting_date)}
                  </Text>
                  <TextInput
                    style={[maintenancePanelStyles.input, styles.meetingTimeInput]}
                    value={meeting.meeting_time}
                    onChangeText={(value) => handleMeetingTimeChange(meeting.meeting_date, value)}
                    placeholder="HH:MM"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>
              ))}
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
                    {formatShortName(profile.full_name)} · {profile.phone ? formatBrazilPhoneInput(profile.phone) : 'sem celular'}
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
                  onPress={() => void handleDeleteGroup()}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Excluir grupo"
                >
                  <Text style={styles.dangerButtonText}>Excluir grupo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chamada</Text>
            <Pressable
              style={styles.dateTrigger}
              onPress={() => setRollDatePickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Selecionar data da chamada"
            >
              <Text style={styles.dateTriggerText}>
                {calendarDateInputToBr(meetingDate) || 'DD/MM/AAAA'}
              </Text>
              <MaterialIcons name="calendar-today" size={18} color="#94A3B8" />
            </Pressable>
            {roll.length === 0 ? (
              <Text style={styles.hint}>Nenhum participante vinculado a este grupo.</Text>
            ) : (
              roll.map((member) => (
                <View key={member.profile_id} style={styles.memberRow}>
                  <Pressable
                    onPress={() => void handleTogglePresence(member)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: member.present }}
                    accessibilityLabel={`Presença de ${formatFullName(member.full_name) || 'participante'}`}
                    style={styles.checkboxHit}
                  >
                    <FontAwesome
                      name={member.present ? 'check-square' : 'square-o'}
                      size={22}
                      color={member.present ? MINIMAL_UI.accent : '#94A3B8'}
                    />
                  </Pressable>
                  <View style={styles.memberMain}>
                    <Text style={styles.memberName}>
                      {formatFullName(member.full_name) || '—'}
                    </Text>
                  </View>
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
              onChangeText={(value) => setVisitorPhone(formatBrazilPhoneInput(value))}
              placeholder="(11) 98765-4321"
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
                Pode ser escrito aqui, sem depender dos temas da Trilha. A publicação manual substitui o roteiro da trilha.
              </Text>
              <TextInput
                style={maintenancePanelStyles.input}
                value={manualTitle}
                onChangeText={setManualTitle}
                placeholder="Título do roteiro"
                placeholderTextColor="#94A3B8"
              />
              <TextInput
                style={[maintenancePanelStyles.input, styles.multiline]}
                value={manualContent}
                onChangeText={setManualContent}
                placeholder="Conteúdo do encontro"
                placeholderTextColor="#94A3B8"
                multiline
              />
              <TextInput
                style={maintenancePanelStyles.input}
                value={manualVideoUrl}
                onChangeText={setManualVideoUrl}
                placeholder="Link ou PDF (opcional)"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => void handleSaveManualGuide()}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>Publicar roteiro</Text>
              </TouchableOpacity>
              {guides.length ? (
                <>
                  <Text style={styles.hint}>Opcional: publicar um tema da Trilha.</Text>
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
                </>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
      <MonthlyDatePickerModal
        visible={calendarOpen}
        value={meetings[0]?.meeting_date ?? ''}
        title="Datas das reuniões"
        variant={minimal ? 'minimal' : 'default'}
        multiSelect
        selectedDates={meetingDateKeys}
        onToggleDate={handleToggleMeetingDate}
        onClose={() => setCalendarOpen(false)}
        onConfirm={() => undefined}
      />
      <MonthlyDatePickerModal
        visible={rollDatePickerOpen}
        value={meetingDate}
        title="Data da chamada"
        variant={minimal ? 'minimal' : 'default'}
        onClose={() => setRollDatePickerOpen(false)}
        onConfirm={(dateInput) => {
          const iso = calendarDateInputToIso(dateInput);
          if (iso) {
            setMeetingDate(iso);
          }
        }}
      />
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
  checkboxHit: {
    padding: 4,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  dateTriggerText: {
    color: '#1E3A5F',
    fontSize: 14,
    flex: 1,
  },
  meetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meetingDate: {
    color: '#1E3A5F',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  meetingTimeInput: {
    width: 88,
    flexGrow: 0,
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
