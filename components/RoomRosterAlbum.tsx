import {
  formatRosterAge,
  loadRoomRosterAlbum,
  releaseRoomRegistration,
  rosterInitials,
  setRoomRegistrationEntry,
} from '@/lib/roomRosterAlbum';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import type { RoomInscribedChild } from '@/types/checkin';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

export type RoomRosterView = 'list' | 'album';

type Props = {
  eventId: string | null;
  roomKey: 'KIDS' | 'TEENS' | null;
  roomLabel: string;
  showGrid: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAttendanceChanged: () => Promise<void> | void;
};

const AVATAR_COLORS: [string, string][] = [
  ['#1D4ED8', '#38BDF8'],
  ['#7C3AED', '#C4B5FD'],
  ['#0F766E', '#5EEAD4'],
  ['#B45309', '#FCD34D'],
  ['#BE123C', '#FDA4AF'],
];

const statusMeta = (status: RoomInscribedChild['checkinStatus']) => {
  if (status === 'in_room') {
    return { label: 'Na sala', color: '#166534', background: '#DCFCE7' };
  }
  if (status === 'released') {
    return { label: 'Liberado', color: '#1E3A8A', background: '#E2E8F0' };
  }
  return { label: 'Aguardando', color: '#854D0E', background: '#FEF3C7' };
};

const avatarColors = (name: string): [string, string] => {
  const index = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] ?? AVATAR_COLORS[0];
};

function RosterAvatar({
  name,
  selfieUrl,
  size,
}: {
  name: string;
  selfieUrl?: string | null;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(selfieUrl) && !failed;
  const colors = avatarColors(name);

  if (showPhoto && selfieUrl) {
    return (
      <Image
        source={{ uri: selfieUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <LinearGradient
      colors={colors}
      style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.avatarInitials, { fontSize: size > 72 ? 28 : 18 }]}>{rosterInitials(name)}</Text>
    </LinearGradient>
  );
}

function ChildDetailModal({
  child,
  roomLabel,
  busy,
  onClose,
  onCheckIn,
  onRelease,
}: {
  child: RoomInscribedChild;
  roomLabel: string;
  busy: boolean;
  onClose: () => void;
  onCheckIn: () => void;
  onRelease: () => void;
}) {
  const ageLabel = formatRosterAge(child.birthDate, child.ageYears);
  const foodAlerts = child.medicalFoodAlerts?.trim() || '';
  const additionalNotes = child.additionalCareNotes?.trim() || '';
  const specificNeeds = child.specialNeeds?.trim() || '';
  const hasAlert = Boolean(foodAlerts || additionalNotes || specificNeeds || child.specialNeedsNotes?.trim());
  const whatsappMessage = `Olá, precisamos da sua presença na ${roomLabel.trim() || 'sala infantil'}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <RosterAvatar name={child.fullName} selfieUrl={child.selfieUrl} size={88} />
              <Text style={styles.modalName}>{child.fullName}</Text>
              <Text style={styles.modalMeta}>{ageLabel}</Text>
              <Text style={styles.modalMeta}>
                Família {child.familyId.trim() || 'sem código'}
              </Text>
            </View>

            <View
              style={[
                styles.alertBox,
                child.medicalFoodAlerts?.trim() ? styles.alertBoxDanger : null,
                !hasAlert && styles.alertBoxQuiet,
              ]}
            >
              <Text style={styles.alertTitle}>Alertas e saúde</Text>
              <View style={styles.alertRow}>
                <Text style={styles.alertLabel}>Restrição Alimentar</Text>
                <Text style={foodAlerts ? styles.alertText : styles.alertQuiet}>
                  {foodAlerts || 'Sem restrição alimentar registrada.'}
                </Text>
              </View>
              {additionalNotes ? (
                <View style={styles.alertRow}>
                  <Text style={styles.alertLabel}>Observações Adicionais</Text>
                  <Text style={styles.alertText}>{additionalNotes}</Text>
                </View>
              ) : null}
              {specificNeeds ? (
                <View style={styles.alertRow}>
                  <Text style={styles.alertLabel}>Necessidades Específicas</Text>
                  <Text style={styles.alertText}>{specificNeeds}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>Responsáveis e emergência</Text>
            {child.guardians.length ? (
              child.guardians.map((guardian) => (
                <View key={guardian.id} style={styles.guardianRow}>
                  <Text style={styles.guardianName}>{guardian.fullName}</Text>
                  {guardian.relationship ? (
                    <Text style={styles.guardianMeta}>{guardian.relationship}</Text>
                  ) : null}
                  <Text style={styles.guardianMeta}>{guardian.phone || 'Sem telefone'}</Text>
                  <Pressable
                    style={[styles.whatsappButton, !guardian.phone && styles.buttonDisabled]}
                    disabled={!guardian.phone}
                    onPress={() => openWhatsAppLikeBirthdaysWithText(guardian.phone, whatsappMessage)}
                    accessibilityRole="button"
                    accessibilityLabel={`Chamar ${guardian.fullName} no WhatsApp`}
                  >
                    <Text style={styles.whatsappText}>Chamar no WhatsApp</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <Text style={styles.emptyNote}>Nenhum responsável encontrado nesta família.</Text>
            )}

            <Text style={styles.sectionTitle}>Presença</Text>
            <View style={styles.actionRow}>
              <Pressable
                style={[
                  styles.entryButton,
                  (busy || child.checkinStatus !== 'pending') && styles.buttonDisabled,
                ]}
                disabled={busy || child.checkinStatus !== 'pending'}
                onPress={onCheckIn}
                accessibilityRole="button"
                accessibilityLabel="Registrar Entrada (Na Sala)"
              >
                <Text style={styles.entryText}>Registrar Entrada (Na Sala)</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.releaseButton,
                  (busy || child.checkinStatus !== 'in_room') && styles.buttonDisabled,
                ]}
                disabled={busy || child.checkinStatus !== 'in_room'}
                onPress={onRelease}
                accessibilityRole="button"
                accessibilityLabel="Registrar Saída (Liberado)"
              >
                <Text style={styles.releaseText}>Registrar Saída (Liberado)</Text>
              </Pressable>
            </View>
            {child.checkinStatus === 'pending' ? (
              <Text style={styles.emptyNote}>A saída fica disponível depois da entrada na sala.</Text>
            ) : null}
          </ScrollView>
          <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
            <Text style={styles.closeText}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function RoomRosterViewSwitch({
  view,
  onViewChange,
  minimal = false,
}: {
  view: RoomRosterView;
  onViewChange: (view: RoomRosterView) => void;
  minimal?: boolean;
}) {
  return (
    <View style={[styles.switchRow, minimal && styles.switchRowMinimal]}>
      <Text style={[styles.switchLabel, view === 'list' && styles.switchLabelActive]}>Lista Padrão</Text>
      <Switch
        value={view === 'album'}
        onValueChange={(album) => onViewChange(album ? 'album' : 'list')}
        trackColor={{ false: MINIMAL_UI.divider, true: MINIMAL_UI.accent }}
        thumbColor={MINIMAL_UI.background}
        accessibilityLabel={view === 'album' ? 'Álbum Visual' : 'Lista Padrão'}
      />
      <Text style={[styles.switchLabel, view === 'album' && styles.switchLabelActive]}>Álbum Visual</Text>
    </View>
  );
}

export function RoomRosterAlbum({
  eventId,
  roomKey,
  roomLabel,
  showGrid,
  selectedId,
  onSelect,
  onAttendanceChanged,
}: Props) {
  const [children, setChildren] = useState<RoomInscribedChild[]>([]);
  const [loading, setLoading] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const shouldLoad = Boolean(eventId && roomKey && (showGrid || selectedId));

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!shouldLoad || !eventId || !roomKey) {
      return;
    }

    let active = true;
    setLoading(true);
    setMessage(null);

    void loadRoomRosterAlbum(eventId, roomKey)
      .then((result) => {
        if (!active) {
          return;
        }
        setAllowed(result.allowed);
        setChildren(result.children);
        setMessage(result.allowed ? null : result.message);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setAllowed(false);
        setChildren([]);
        setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o álbum da sala.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [eventId, reloadKey, roomKey, shouldLoad]);

  const selected = children.find((child) => child.id === selectedId) ?? null;

  const runAttendance = async (child: RoomInscribedChild, action: 'in' | 'out') => {
    setBusyId(child.id);
    try {
      if (action === 'in') {
        await setRoomRegistrationEntry(child.id, true);
      } else {
        await releaseRoomRegistration(child.id);
      }
      setChildren((current) =>
        current.map((item) =>
          item.id === child.id
            ? { ...item, checkinStatus: action === 'in' ? 'in_room' : 'released' }
            : item
        )
      );
      await onAttendanceChanged();
      reload();
    } catch (error) {
      Alert.alert(
        'Erro',
        error instanceof Error ? error.message : 'Não foi possível atualizar a presença.'
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View>
      {showGrid ? (
        loading ? (
          <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
        ) : !allowed ? (
          <Text style={styles.denied}>{message}</Text>
        ) : children.length === 0 ? (
          <Text style={styles.emptyNote}>Nenhum inscrito nesta sala.</Text>
        ) : (
          <View style={styles.grid}>
            {children.map((child) => {
              const status = statusMeta(child.checkinStatus);
              const ageLabel = formatRosterAge(child.birthDate, child.ageYears);
              return (
                <Pressable
                  key={child.id}
                  style={styles.card}
                  onPress={() => onSelect(child.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ficha de ${child.fullName}`}
                >
                  <RosterAvatar name={child.fullName} selfieUrl={child.selfieUrl} size={72} />
                  <Text style={styles.cardName} numberOfLines={2}>
                    {child.fullName}
                  </Text>
                  <Text style={styles.cardMeta}>{ageLabel}</Text>
                  <Text style={styles.cardMeta}>Família {child.familyId.trim() || '—'}</Text>
                  {child.medicalFoodAlerts?.trim() ? (
                    <View style={styles.alertChip}>
                      <Text style={styles.alertChipText}>⚠️ Alerta de Saúde/Alimentação</Text>
                    </View>
                  ) : null}
                  <View style={[styles.statusBadge, { backgroundColor: status.background }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )
      ) : null}

      {selected ? (
        <ChildDetailModal
          child={selected}
          roomLabel={roomLabel}
          busy={busyId === selected.id}
          onClose={() => onSelect(null)}
          onCheckIn={() => {
            void runAttendance(selected, 'in');
          }}
          onRelease={() => {
            void runAttendance(selected, 'out');
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  switchRowMinimal: {
    backgroundColor: MINIMAL_UI.background,
  },
  switchLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  switchLabelActive: {
    color: MINIMAL_UI.text,
  },
  loader: {
    marginVertical: 24,
  },
  denied: {
    color: '#B91C1C',
    textAlign: 'center',
    padding: 16,
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 8,
  },
  card: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 148,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    backgroundColor: MINIMAL_UI.background,
    gap: 4,
  },
  cardName: {
    color: MINIMAL_UI.text,
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
  },
  cardMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  alertChip: {
    backgroundColor: '#FEE2E2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  alertChipText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    maxHeight: '90%',
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  modalHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  modalName: {
    color: MINIMAL_UI.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  modalMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
  },
  alertBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  alertBoxDanger: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  alertBoxQuiet: {
    backgroundColor: '#F8FAFC',
    borderColor: MINIMAL_UI.border,
  },
  alertTitle: {
    color: '#92400E',
    fontWeight: '800',
  },
  alertLabel: {
    color: '#92400E',
    fontWeight: '700',
    width: '46%',
    flexShrink: 0,
  },
  alertText: {
    color: '#7F1D1D',
    fontSize: 14,
    flex: 1,
    flexShrink: 1,
  },
  alertQuiet: {
    color: '#64748B',
    fontSize: 14,
    flex: 1,
    flexShrink: 1,
  },
  sectionTitle: {
    color: MINIMAL_UI.text,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
  },
  guardianRow: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 2,
  },
  guardianName: {
    color: MINIMAL_UI.text,
    fontWeight: '800',
  },
  guardianMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
  },
  whatsappButton: {
    marginTop: 8,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  whatsappText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  emptyNote: {
    color: '#64748B',
    fontSize: 13,
  },
  actionRow: {
    gap: 8,
  },
  entryButton: {
    backgroundColor: '#166534',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  entryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  releaseButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  releaseText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  closeButton: {
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeText: {
    color: MINIMAL_UI.text,
    fontWeight: '800',
  },
});
