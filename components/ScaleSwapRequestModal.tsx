import { pushAppBackInterceptor } from '@/lib/appBackIntercept';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  createScaleSwapRequest,
  leaderForceScaleSwap,
  listScaleSwapCandidates,
  type ScaleSwapCandidate,
} from '@/lib/scaleSwapApi';
import { formatServiceDateLabel } from '@/lib/scalesClassUtils';
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  escalaLogId: string | null;
  volunteerName: string;
  serviceDate: string;
  scaleName: string;
  mode?: 'member' | 'leader';
  onClose: () => void;
  onDone: () => void;
};

export function ScaleSwapRequestModal({
  visible,
  escalaLogId,
  volunteerName,
  serviceDate,
  scaleName,
  mode = 'member',
  onClose,
  onDone,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [candidates, setCandidates] = useState<ScaleSwapCandidate[]>([]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    return pushAppBackInterceptor(() => {
      onClose();
      return true;
    });
  }, [onClose, visible]);

  useEffect(() => {
    if (!visible || !escalaLogId) {
      setCandidates([]);
      setError(null);
      setMotivo('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void listScaleSwapCandidates(escalaLogId)
      .then((rows) => {
        if (!cancelled) {
          setCandidates(rows);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível listar os servos.');
          setCandidates([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [escalaLogId, visible]);

  const handleWhatsapp = async (phone: string | null) => {
    const whatsappPhone = normalizePhoneForWhatsApp(phone);

    if (!whatsappPhone) {
      Alert.alert('Telefone indisponível', 'Este servo não possui telefone cadastrado no perfil.');
      return;
    }

    try {
      await Linking.openURL(`https://wa.me/${whatsappPhone}`);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o Zap deste servo.');
    }
  };

  const handleSend = async (candidate: ScaleSwapCandidate) => {
    if (!escalaLogId || candidate.alreadyScheduled) {
      return;
    }

    setSendingId(candidate.profileId);

    try {
      const result =
        mode === 'leader'
          ? await leaderForceScaleSwap(escalaLogId, candidate.profileId, motivo)
          : await createScaleSwapRequest(escalaLogId, candidate.profileId, motivo);

      if (!result.success) {
        Alert.alert('Troca de escala', result.message);
        return;
      }

      Alert.alert('Troca de escala', result.message);
      onDone();
    } catch (sendError) {
      Alert.alert(
        'Troca de escala',
        sendError instanceof Error ? sendError.message : 'Não foi possível enviar a proposta.'
      );
    } finally {
      setSendingId(null);
    }
  };

  const available = candidates.filter((row) => !row.alreadyScheduled);
  const busy = candidates.filter((row) => row.alreadyScheduled);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {mode === 'leader' ? 'Intervir na escala' : 'Solicitar troca'}
          </Text>
          <Text style={styles.subtitle}>
            {scaleName} · {formatServiceDateLabel(serviceDate)} · {volunteerName}
          </Text>
          <Text style={styles.hint}>
            Apenas servos do mesmo tipo, livres nesta data. A troca vale só para este dia — o ciclo
            futuro permanece.
          </Text>

          <TextInput
            style={styles.motivo}
            placeholder="Motivo (opcional)"
            placeholderTextColor="#64748B"
            value={motivo}
            onChangeText={setMotivo}
            multiline
          />

          {loading ? (
            <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} style={styles.loader} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : available.length === 0 ? (
            <Text style={styles.empty}>Nenhum servo disponível nesta data e tipo de escala.</Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {available.map((candidate) => (
                <View key={candidate.profileId} style={styles.row}>
                  <Text style={styles.name} numberOfLines={1}>
                    {candidate.volunteerName}
                  </Text>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.iconButton, !candidate.phone && styles.iconButtonDisabled]}
                      onPress={() => void handleWhatsapp(candidate.phone)}
                      disabled={!candidate.phone}
                      accessibilityLabel="Abrir WhatsApp do servo"
                    >
                      <FontAwesome
                        name="whatsapp"
                        size={18}
                        color={candidate.phone ? '#25D366' : '#94A3B8'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sendButton}
                      onPress={() => void handleSend(candidate)}
                      disabled={sendingId !== null}
                      activeOpacity={0.85}
                    >
                      {sendingId === candidate.profileId ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.sendButtonText}>
                          {mode === 'leader' ? 'Substituir' : 'Enviar Proposta no App'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {busy.length ? (
                <Text style={styles.busyHint}>
                  {busy.length} servo(s) já escalado(s) nesta data e não aparecem como disponíveis.
                </Text>
              ) : null}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    maxHeight: '88%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 10,
  },
  title: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  motivo: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  loader: {
    marginVertical: 24,
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    paddingVertical: 12,
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    gap: 8,
    paddingBottom: 8,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  name: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  iconButtonDisabled: {
    opacity: 0.55,
  },
  sendButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: VIGILANCE_SCALES_UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  busyHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    paddingTop: 4,
  },
  closeButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontWeight: '800',
  },
});
