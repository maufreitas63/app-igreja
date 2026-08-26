import { SegmentChipRow } from '@/components/ui/SegmentChipRow';
import { maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  addDaysIso,
  checkinPastoralSlot,
  fetchMyPastoralAgenda,
  formatPastoralSlotTimeRange,
  PASTORAL_ATTENDANCE_TYPE_LABEL,
  PASTORAL_SLOT_STATUS_LABEL,
  savePastoralSlot,
  startOfWeekIso,
  type PastoralAgendaSlot,
  type PastoralAttendanceType,
} from '@/lib/pastoralSlotsApi';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  minimal?: boolean;
};

const weekdayLabel = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

export function MaintenancePastoralAgendaPanel({ isActive = true, minimal = false }: Props) {
  const [weekStart, setWeekStart] = useState(startOfWeekIso());
  const [slots, setSlots] = useState<PastoralAgendaSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:00');
  const [tipo, setTipo] = useState<PastoralAttendanceType>('presencial');
  const [published, setPublished] = useState(true);

  const weekEnd = useMemo(() => addDaysIso(weekStart, 7), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setSlots(await fetchMyPastoralAgenda(weekStart, weekEnd));
    } catch (loadError) {
      setSlots([]);
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar a agenda.');
    } finally {
      setLoading(false);
    }
  }, [weekEnd, weekStart]);

  useEffect(() => {
    if (isActive) {
      void load();
    }
  }, [isActive, load]);

  const byDay = useMemo(() => {
    const groups = new Map<string, PastoralAgendaSlot[]>();

    for (const slot of slots) {
      const key = slot.data_hora_inicio.slice(0, 10);
      const list = groups.get(key) ?? [];
      list.push(slot);
      groups.set(key, list);
    }

    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [slots]);

  const reservedCount = slots.filter((slot) => slot.status === 'reservado').length;

  const handleSave = async () => {
    const startsAt = new Date(`${date}T${startTime}:00`);
    const endsAt = new Date(`${date}T${endTime}:00`);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      Toast.show({ type: 'error', text1: 'Agenda', text2: 'Informe data e horário válidos.' });
      return;
    }

    setSaving(true);

    try {
      const result = await savePastoralSlot({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        tipo,
        isPublished: published,
      });
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Agenda',
        text2: result.message,
      });

      if (result.success) {
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCheckin = async (slotId: string) => {
    const result = await checkinPastoralSlot(slotId);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Check-in',
      text2: result.message,
    });

    if (result.success) {
      await load();
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={minimal ? styles.weekTitleMinimal : styles.weekTitle}>
        Semana · {weekdayLabel(weekStart)} a {weekdayLabel(addDaysIso(weekStart, 6))}
      </Text>
      <Text style={styles.hint}>
        Carga: {slots.length} horários · {reservedCount} reservados
      </Text>

      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekStart(addDaysIso(weekStart, -7))}>
          <Text style={styles.link}>← Anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setWeekStart(startOfWeekIso())}>
          <Text style={styles.link}>Hoje</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setWeekStart(addDaysIso(weekStart, 7))}>
          <Text style={styles.link}>Próxima →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <TextInput
          style={maintenancePanelStyles.input}
          value={date}
          onChangeText={setDate}
          placeholder="Data (AAAA-MM-DD)"
          placeholderTextColor="#94A3B8"
        />
        <View style={styles.timeRow}>
          <TextInput
            style={[maintenancePanelStyles.input, styles.timeInput]}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="Início HH:MM"
            placeholderTextColor="#94A3B8"
          />
          <TextInput
            style={[maintenancePanelStyles.input, styles.timeInput]}
            value={endTime}
            onChangeText={setEndTime}
            placeholder="Fim HH:MM"
            placeholderTextColor="#94A3B8"
          />
        </View>
        <SegmentChipRow
          variant={minimal ? 'vigilance' : 'default'}
          compact
          options={[
            { value: 'presencial', label: 'Presencial' },
            { value: 'online', label: 'Online' },
          ]}
          selectedValue={tipo}
          onSelect={(value) => setTipo(value as PastoralAttendanceType)}
        />
        <View style={styles.publishRow}>
          <Text style={styles.hint}>{published ? 'Publicado' : 'Rascunho'}</Text>
          <Switch value={published} onValueChange={setPublished} />
        </View>
        <TouchableOpacity style={styles.primary} onPress={() => void handleSave()} disabled={saving}>
          <Text style={styles.primaryText}>Salvar horário</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : byDay.length === 0 ? (
        <Text style={styles.hint}>Nenhum horário nesta semana.</Text>
      ) : (
        byDay.map(([day, daySlots]) => (
          <View key={day} style={styles.dayBlock}>
            <Text style={styles.dayTitle}>{weekdayLabel(`${day}T12:00:00`)}</Text>
            {daySlots.map((slot) => (
              <View key={slot.id} style={styles.slotRow}>
                <View style={styles.slotMain}>
                  <Text style={styles.slotTime}>
                    {formatPastoralSlotTimeRange(slot.data_hora_inicio, slot.data_hora_fim)}
                  </Text>
                  <Text style={styles.hint}>
                    {PASTORAL_ATTENDANCE_TYPE_LABEL[slot.tipo_atendimento]} ·{' '}
                    {PASTORAL_SLOT_STATUS_LABEL[slot.status]}
                    {slot.member_name ? ` · ${slot.member_name}` : ''}
                  </Text>
                  {slot.motivo ? (
                    <Text style={styles.motivo} numberOfLines={2}>
                      {slot.motivo}
                    </Text>
                  ) : slot.destination_label ? (
                    <Text style={styles.hint}>{slot.destination_label}</Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.seal,
                    slot.is_published ? styles.sealPublished : styles.sealDraft,
                  ]}
                >
                  <Text style={styles.sealText}>{slot.is_published ? 'Publicado' : 'Rascunho'}</Text>
                </View>
                {slot.can_checkin ? (
                  <TouchableOpacity style={styles.checkin} onPress={() => void handleCheckin(slot.id)}>
                    <Text style={styles.checkinText}>Check-in de Atendimento</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  weekTitle: {
    color: '#1E3A5F',
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 14,
  },
  weekTitleMinimal: {
    color: MINIMAL_UI.accent,
    fontWeight: '800',
    textAlign: 'center',
  },
  hint: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
  weekNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  link: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 12,
  },
  form: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeInput: {
    flex: 1,
  },
  publishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  error: {
    color: '#B91C1C',
    textAlign: 'center',
  },
  dayBlock: {
    gap: 6,
  },
  dayTitle: {
    color: '#1E3A5F',
    fontWeight: '800',
    fontSize: 12,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
  },
  slotMain: {
    flex: 1,
    gap: 2,
  },
  slotTime: {
    color: '#1E3A5F',
    fontWeight: '700',
    fontSize: 12,
  },
  motivo: {
    color: '#334155',
    fontSize: 11,
  },
  seal: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sealPublished: {
    backgroundColor: '#16A34A',
  },
  sealDraft: {
    backgroundColor: '#2563EB',
  },
  sealText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  checkin: {
    backgroundColor: '#0F766E',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  checkinText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
