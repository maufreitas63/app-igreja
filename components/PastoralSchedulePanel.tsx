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

  const slotOptions = useMemo(
    () =>
      filteredSlots.map((slot) => ({
        value: slot.id,
        label: `${formatPastoralSlotTimeRange(slot.data_hora_inicio, slot.data_hora_fim)} · ${slot.pastor_name} · ${PASTORAL_ATTENDANCE_TYPE_LABEL[slot.tipo_atendimento]}`,
      })),
    [filteredSlots]
  );

  const selectedSlot = useMemo(
    () => filteredSlots.find((slot) => slot.id === slotId) ?? null,
    [filteredSlots, slotId]
  );

  useEffect(() => {
    if (slotId && !filteredSlots.some((slot) => slot.id === slotId)) {
      setSlotId('');
    }
  }, [filteredSlots, slotId]);

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
        Escolha o atendente, selecione um horário publicado e confirme o agendamento.
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
            <View style={[styles.emptyBox, vigilance && styles.emptyBoxVigilance]}>
              <Text style={[styles.emptyTitle, vigilance && styles.emptyTitleVigilance]}>
                Sem horários publicados
              </Text>
              <Text style={[styles.emptyBody, vigilance && styles.hintVigilance]}>
                Não é um calendário livre. O atendente abre os horários na manutenção
                (Coração Aberto → agenda). Quando houver vaga, eles aparecem nesta tela
                para você escolher e confirmar.
              </Text>
            </View>
          ) : (
            <>
              <DropdownSelect
                options={slotOptions}
                selectedValue={slotId}
                onValueChange={setSlotId}
                modalTitle="Horário disponível"
                placeholder="Selecione um horário disponível"
                searchable={slotOptions.length > 8}
                variant={vigilance ? 'minimal' : 'vigilance'}
              />

              {selectedSlot ? (
                <View style={[styles.selectedBox, vigilance && styles.selectedBoxVigilance]}>
                  <Text style={[styles.selectedLabel, vigilance && styles.hintVigilance]}>
                    Horário selecionado
                  </Text>
                  <Text style={[styles.slotTitle, vigilance && styles.slotTitleVigilance]}>
                    {formatPastoralSlotTimeRange(
                      selectedSlot.data_hora_inicio,
                      selectedSlot.data_hora_fim
                    )}
                  </Text>
                  <Text style={[styles.slotMeta, vigilance && styles.hintVigilance]}>
                    {selectedSlot.pastor_name} ·{' '}
                    {PASTORAL_ATTENDANCE_TYPE_LABEL[selectedSlot.tipo_atendimento]}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.hint, vigilance && styles.hintVigilance]}>
                  Abra a caixa, escolha data e horário, depois confirme.
                </Text>
              )}
            </>
          )}

          <DropdownSelect
            options={requestOptions}
            selectedValue={requestId}
            onValueChange={setRequestId}
            modalTitle="Pedido vinculado"
            variant={vigilance ? 'minimal' : 'vigilance'}
          />

          <TouchableOpacity
            style={[
              styles.submit,
              vigilance && styles.submitVigilance,
              (saving || !slotId) && styles.submitDisabled,
            ]}
            onPress={() => void handleBook()}
            disabled={saving || !slotId}
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
  emptyBox: {
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.35)',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  emptyBoxVigilance: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  emptyTitle: {
    color: '#EDE9FE',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyTitleVigilance: {
    color: '#1E3A5F',
  },
  emptyBody: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  error: {
    color: '#FCA5A5',
    textAlign: 'center',
  },
  selectedBox: {
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.45)',
    borderRadius: 10,
    padding: 12,
    gap: 4,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  selectedBoxVigilance: {
    borderColor: '#3A96DD',
    backgroundColor: '#F0F7FF',
  },
  selectedLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
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
