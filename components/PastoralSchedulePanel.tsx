import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SegmentChipRow } from '@/components/ui/SegmentChipRow';
import { appAlert } from '@/lib/appAlert';
import { fetchMyPastoralRequests, formatPastoralRequestDate } from '@/lib/pastoralRequest';
import {
  bookPastoralSlot,
  fetchAvailablePastoralSlots,
  fetchPastoralAttendants,
  formatPastoralSlotTimeRange,
  PASTORAL_ATTENDANCE_TYPE_LABEL,
  type AvailablePastoralSlot,
  type PastoralAttendanceType,
  type PastoralAttendant,
} from '@/lib/pastoralSlotsApi';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  profileId: string;
  vigilance?: boolean;
};

export function PastoralSchedulePanel({ profileId, vigilance = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attendants, setAttendants] = useState<PastoralAttendant[]>([]);
  const [slots, setSlots] = useState<AvailablePastoralSlot[]>([]);
  const [pastorId, setPastorId] = useState('');
  const [tipo, setTipo] = useState<PastoralAttendanceType | 'all'>('all');
  const [slotId, setSlotId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [requestOptions, setRequestOptions] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextAttendants, nextSlots, requests] = await Promise.all([
        fetchPastoralAttendants(),
        fetchAvailablePastoralSlots(pastorId || null),
        fetchMyPastoralRequests(profileId),
      ]);
      setAttendants(nextAttendants);
      setSlots(nextSlots);
      setRequestOptions([
        { value: '', label: 'Sem vincular pedido' },
        ...requests.map((item) => ({
          value: item.id,
          label: `${item.motivo?.trim() || 'Pedido'} · ${formatPastoralRequestDate(item.created_at)}`,
        })),
      ]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar horários.');
      setAttendants([]);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [pastorId, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSlots = useMemo(
    () => (tipo === 'all' ? slots : slots.filter((slot) => slot.tipo_atendimento === tipo)),
    [slots, tipo]
  );

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, AvailablePastoralSlot[]>();

    for (const slot of filteredSlots) {
      const key = slot.data_hora_inicio.slice(0, 10);
      const list = groups.get(key) ?? [];
      list.push(slot);
      groups.set(key, list);
    }

    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [filteredSlots]);

  const handleBook = async () => {
    if (!slotId) {
      await appAlert('Horário', 'Selecione um horário disponível.');
      return;
    }

    setSaving(true);

    try {
      const result = await bookPastoralSlot(slotId, requestId || null);
      await appAlert(result.success ? 'Agendado' : 'Não foi possível agendar', result.message);

      if (result.success) {
        setSlotId('');
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const accent = vigilance ? MINIMAL_UI.accent : '#C4B5FD';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, vigilance && styles.titleVigilance]}>Agendar atendimento</Text>
      <Text style={[styles.hint, vigilance && styles.hintVigilance]}>
        Escolha o atendente e um horário publicado como disponível.
      </Text>

      {loading ? (
        <ActivityIndicator color={accent} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          {/* Proteção aplicada: Gestor não tem visibilidade do Super Administrador */}
          <DropdownSelect
            options={[
              { value: '', label: 'Todos os atendentes' },
              ...attendants.map((item) => ({ value: item.id, label: item.full_name })),
            ]}
            selectedValue={pastorId}
            onValueChange={setPastorId}
            modalTitle="Atendente"
            variant={vigilance ? 'minimal' : 'vigilance'}
          />

          <SegmentChipRow
            variant={vigilance ? 'vigilance' : 'default'}
            compact={vigilance}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'presencial', label: 'Presencial' },
              { value: 'online', label: 'Online' },
            ]}
            selectedValue={tipo}
            onSelect={(value) => setTipo(value as PastoralAttendanceType | 'all')}
          />

          {filteredSlots.length === 0 ? (
            <Text style={[styles.hint, vigilance && styles.hintVigilance]}>
              Nenhum horário disponível no momento.
            </Text>
          ) : (
            slotsByDay.map(([day, daySlots]) => (
              <View key={day} style={styles.dayBlock}>
                <Text style={[styles.dayTitle, vigilance && styles.slotTitleVigilance]}>
                  {new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </Text>
                {daySlots.map((slot) => {
                  const selected = slot.id === slotId;

                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[styles.slot, selected && styles.slotSelected, vigilance && styles.slotVigilance]}
                      onPress={() => setSlotId(slot.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.slotTitle, vigilance && styles.slotTitleVigilance]}>
                        {formatPastoralSlotTimeRange(slot.data_hora_inicio, slot.data_hora_fim)}
                      </Text>
                      <Text style={[styles.slotMeta, vigilance && styles.hintVigilance]}>
                        {slot.pastor_name} · {PASTORAL_ATTENDANCE_TYPE_LABEL[slot.tipo_atendimento]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}

          <DropdownSelect
            options={requestOptions}
            selectedValue={requestId}
            onValueChange={setRequestId}
            modalTitle="Pedido vinculado"
            variant={vigilance ? 'minimal' : 'vigilance'}
          />

          <TouchableOpacity
            style={[styles.submit, vigilance && styles.submitVigilance, saving && styles.submitDisabled]}
            onPress={() => void handleBook()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Confirmar agendamento</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  title: {
    color: '#EDE9FE',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  titleVigilance: {
    color: '#1E3A5F',
  },
  hint: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
  hintVigilance: {
    color: '#64748B',
  },
  error: {
    color: '#FCA5A5',
    textAlign: 'center',
  },
  dayBlock: {
    gap: 8,
  },
  dayTitle: {
    color: '#C4B5FD',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  slot: {
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.35)',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  slotVigilance: {
    borderColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: '#FFFFFF',
  },
  slotSelected: {
    borderColor: '#3A96DD',
    backgroundColor: 'rgba(58, 150, 221, 0.12)',
  },
  slotTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
  },
  slotTitleVigilance: {
    color: '#1E3A5F',
  },
  slotMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
  submit: {
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitVigilance: {
    backgroundColor: '#3A96DD',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
