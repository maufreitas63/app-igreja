import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SegmentChipRow } from '@/components/ui/SegmentChipRow';
import { appAlert } from '@/lib/appAlert';
import { confirmDialog } from '@/lib/confirmDialog';
import {
  fetchMyPastoralRequests,
  formatPastoralRequestDate,
  MIN_PASTORAL_CANCELLATION_REASON_LENGTH,
} from '@/lib/pastoralRequest';
import {
  bookPastoralSlot,
  buildPastoralBookingWhatsAppMessage,
  buildPastoralCancelWhatsAppMessage,
  cancelPastoralSlot,
  fetchAvailablePastoralSlots,
  fetchMyPastoralAppointments,
  fetchPastoralAttendants,
  formatPastoralSlotTimeRange,
  PASTORAL_ATTENDANCE_TYPE_LABEL,
  type AvailablePastoralSlot,
  type MyPastoralAppointment,
  type PastoralAttendanceType,
  type PastoralAttendant,
} from '@/lib/pastoralSlotsApi';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { offerConfirmedEventToCalendar } from '@/lib/calendarIcs';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
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
  const [appointments, setAppointments] = useState<MyPastoralAppointment[]>([]);
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextAttendants, nextSlots, requests, nextAppointments] = await Promise.all([
        fetchPastoralAttendants(),
        fetchAvailablePastoralSlots(pastorId || null),
        fetchMyPastoralRequests(profileId),
        fetchMyPastoralAppointments().catch(() => [] as MyPastoralAppointment[]),
      ]);
      setAttendants(nextAttendants);
      setSlots(nextSlots);
      setAppointments(nextAppointments.filter((item) => item.status === 'reservado'));
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
      try {
        const nextAppointments = await fetchMyPastoralAppointments();
        setAppointments(nextAppointments.filter((item) => item.status === 'reservado'));
      } catch {
        setAppointments([]);
      }
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
      const slot = selectedSlot;
      const result = await bookPastoralSlot(slotId, requestId || null);

      if (result.success) {
        const profile = await loadEffectiveSessionProfile();
        const memberName = profile?.full_name?.trim() || 'Um irmão da igreja';
        const pastorName = result.pastorName || slot?.pastor_name || 'Atendente';
        const pastorPhone = result.pastorPhone || slot?.pastor_phone || null;
        const startsAt = result.startsAt || slot?.data_hora_inicio || '';
        const endsAt = result.endsAt || slot?.data_hora_fim || '';
        const tipo = result.tipo || slot?.tipo_atendimento || 'presencial';
        const startsDate = startsAt ? new Date(startsAt) : null;
        const endsDate = endsAt ? new Date(endsAt) : null;

        if (pastorPhone) {
          openWhatsAppLikeBirthdaysWithText(
            pastorPhone,
            buildPastoralBookingWhatsAppMessage({
              pastorName,
              memberName,
              startsAt,
              endsAt,
              tipo,
              slotId,
            })
          );
        }

        setSlotId('');
        await load();

        await offerConfirmedEventToCalendar({
          id: slotId,
          titulo: `Atendimento pastoral · ${pastorName}`,
          local: tipo === 'online' ? 'Online' : 'Presencial',
          eventDate:
            startsDate && !Number.isNaN(startsDate.getTime()) ? startsDate : startsAt,
          eventEndDate: endsDate && !Number.isNaN(endsDate.getTime()) ? endsDate : endsAt,
          descricao: `${memberName} confirmou atendimento ${PASTORAL_ATTENDANCE_TYPE_LABEL[tipo]} com ${pastorName}.`,
        });

        if (!pastorPhone) {
          await appAlert(
            'Agendado',
            `Não foi possível avisar ${pastorName} no WhatsApp (telefone não cadastrado).`
          );
        }

        return;
      }

      await appAlert('Não foi possível agendar', result.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (appointment: MyPastoralAppointment) => {
    const reason = (cancelReasons[appointment.id] ?? '').trim();

    if (reason.length < MIN_PASTORAL_CANCELLATION_REASON_LENGTH) {
      await appAlert(
        'Justificativa obrigatória',
        `Informe uma justificativa com pelo menos ${MIN_PASTORAL_CANCELLATION_REASON_LENGTH} caracteres.`
      );
      return;
    }

    const confirmed = await confirmDialog(
      'Cancelar agendamento',
      'O horário voltará a ficar disponível e o atendente será avisado no WhatsApp.',
      'Cancelar horário',
      'Voltar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    setCancellingId(appointment.id);

    try {
      const profile = await loadEffectiveSessionProfile();
      const memberName = profile?.full_name?.trim() || 'Um irmão da igreja';
      const result = await cancelPastoralSlot(appointment.id, reason);

      if (!result.success) {
        await appAlert('Não foi possível cancelar', result.message);
        return;
      }

      const pastorName = result.pastorName || appointment.pastor_name || 'Atendente';
      const pastorPhone = result.pastorPhone || appointment.pastor_phone || null;
      const startsAt = result.startsAt || appointment.data_hora_inicio;
      const endsAt = result.endsAt || appointment.data_hora_fim;
      const tipo = result.tipo || appointment.tipo_atendimento;

      if (pastorPhone) {
        openWhatsAppLikeBirthdaysWithText(
          pastorPhone,
          buildPastoralCancelWhatsAppMessage({
            pastorName,
            memberName,
            startsAt,
            endsAt,
            tipo,
            reason,
          })
        );
      }

      setCancelReasons((current) => {
        const next = { ...current };
        delete next[appointment.id];
        return next;
      });
      await load();

      if (!pastorPhone) {
        await appAlert(
          'Cancelado',
          `Não foi possível avisar ${pastorName} no WhatsApp (telefone não cadastrado).`
        );
      }
    } finally {
      setCancellingId(null);
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

      {appointments.length > 0 ? (
        <View style={[styles.myBox, vigilance && styles.myBoxVigilance]}>
          <Text style={[styles.myTitle, vigilance && styles.myTitleVigilance]}>
            {appointments.length === 1 ? 'Meu agendamento' : 'Meus agendamentos'}
          </Text>
          {appointments.map((appointment) => {
            const busy = cancellingId === appointment.id;
            const canCancel = appointment.can_cancel;

            return (
              <View
                key={appointment.id}
                style={[styles.appointmentCard, vigilance && styles.appointmentCardVigilance]}
              >
                <Text style={[styles.slotTitle, vigilance && styles.slotTitleVigilance]}>
                  {formatPastoralSlotTimeRange(
                    appointment.data_hora_inicio,
                    appointment.data_hora_fim
                  )}
                </Text>
                <Text style={[styles.slotMeta, vigilance && styles.hintVigilance]}>
                  {appointment.pastor_name} ·{' '}
                  {PASTORAL_ATTENDANCE_TYPE_LABEL[appointment.tipo_atendimento]}
                </Text>
                {canCancel ? (
                  <>
                    <Text style={[styles.reasonLabel, vigilance && styles.reasonLabelVigilance]}>
                      Justificativa do cancelamento
                    </Text>
                    <TextInput
                      accessibilityLabel="Justificativa do cancelamento"
                      editable={!busy}
                      multiline
                      numberOfLines={3}
                      onChangeText={(value) =>
                        setCancelReasons((current) => ({
                          ...current,
                          [appointment.id]: value,
                        }))
                      }
                      placeholder="Informe o motivo do cancelamento..."
                      placeholderTextColor={vigilance ? '#94A3B8' : '#64748B'}
                      style={[styles.reasonInput, vigilance && styles.reasonInputVigilance]}
                      textAlignVertical="top"
                      value={cancelReasons[appointment.id] ?? ''}
                    />
                    <TouchableOpacity
                      accessibilityLabel="Cancelar agendamento"
                      accessibilityRole="button"
                      disabled={busy || saving}
                      onPress={() => void handleCancel(appointment)}
                      style={[styles.cancelButton, (busy || saving) && styles.submitDisabled]}
                    >
                      {busy ? (
                        <ActivityIndicator color="#B91C1C" />
                      ) : (
                        <Text style={styles.cancelButtonText}>Cancelar agendamento</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={[styles.hint, vigilance && styles.hintVigilance]}>
                    Este horário já começou e não pode ser cancelado por aqui.
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
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
  myBox: {
    marginTop: 6,
    gap: 10,
  },
  myBoxVigilance: {
    marginTop: 8,
  },
  myTitle: {
    color: '#EDE9FE',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  myTitleVigilance: {
    color: '#1E3A5F',
  },
  appointmentCard: {
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.45)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  appointmentCardVigilance: {
    borderColor: '#3A96DD',
    backgroundColor: '#F0F7FF',
  },
  reasonLabel: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reasonLabelVigilance: {
    color: '#1E3A5F',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.45)',
    borderRadius: 10,
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#F8FAFC',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  reasonInputVigilance: {
    borderColor: '#CBD5E1',
    color: '#1E3A5F',
    backgroundColor: '#FFFFFF',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#B91C1C',
    fontWeight: '800',
  },
});
