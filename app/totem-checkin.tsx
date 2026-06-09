import { useCheckin } from '@/hooks/useCheckin';
import { TOTEM_CHECKIN_ALREADY_CONFIRMED_MESSAGE } from '@/lib/checkinStatus';
import {
  getActiveEventSelect,
  ensureEventsTotemAtivoColumn,
  TOTEM_COLUMN_SQL_HINT,
  withDefaultTotemAtivo,
} from '@/lib/eventsColumnSupport';
import { isEventCalendarToday } from '@/lib/checkInVisibility';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { isEventPublished, isEventVisibleForCheckIn } from '@/lib/eventVisibility';
import { EXIT_SESSION_UI } from '@/lib/sessionExitUi';
import { signOutAndReturnToLogin } from '@/lib/userSession';
import { lockPastEvents } from '@/lib/lockPastEvents';
import { supabase } from '@/lib/supabase';
import { getWebCameraProbe, requestWebCameraForTotem } from '@/lib/totemWebCamera';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

type TotemEvent = {
  id: string;
  name: string;
  event_date: string | null;
  totem_ativo: boolean | null;
};

const SCAN_COOLDOWN_MS = 2500;
/** Altura da área da câmera: compacta para o gate (texto + botão) e leitura de QR. */
const TOTEM_CAMERA_FRAME_HEIGHT = 200;

type TotemEmptyReason =
  | 'column_missing'
  | 'no_totem_flag'
  | 'no_totem_today'
  | 'not_published'
  | 'date_out_of_range';

const normalizeScannedFamilyId = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('family') ?? url.searchParams.get('familia');
    if (fromQuery?.trim()) {
      return fromQuery.trim().toUpperCase();
    }
  } catch {
    // não é URL — usa o valor bruto
  }

  return trimmed.toUpperCase();
};

const totemCameraFacing = Platform.OS === 'web' ? 'front' : 'back';
const isWebTotem = Platform.OS === 'web';
const cameraViewAvailable = typeof CameraView === 'function';

export default function TotemCheckinScreen() {
  const [permission, requestPermission, refreshCameraPermission] = useCameraPermissions();
  const { lookupTotemCheckin, confirmTotemCheckin, loading } = useCheckin();

  const [events, setEvents] = useState<TotemEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [emptyReason, setEmptyReason] = useState<TotemEmptyReason | null>(null);
  const [totemCompatMode, setTotemCompatMode] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'neutral' | 'success' | 'error' | 'warning'>(
    'neutral'
  );
  const [scanEnabled, setScanEnabled] = useState(true);
  const [isRequestingCameraPermission, setIsRequestingCameraPermission] = useState(false);
  const [cameraPermissionBlocked, setCameraPermissionBlocked] = useState(false);
  const [cameraAccessGranted, setCameraAccessGranted] = useState(false);
  const [permissionCheckDone, setPermissionCheckDone] = useState(false);
  const [cameraMountError, setCameraMountError] = useState<string | null>(null);

  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const processingScanRef = useRef(false);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setEmptyReason(null);
    setTotemCompatMode(false);

    try {
      const columnAvailable = await ensureEventsTotemAtivoColumn();
      await lockPastEvents();

      const { data, error } = await supabase
        .from('events')
        .select(getActiveEventSelect())
        .order('event_date', { ascending: true });

      if (error) {
        throw error;
      }

      const rows = (data ?? []).map(withDefaultTotemAtivo);
      const published = rows.filter((event) => isEventPublished(event.is_locked));
      const visible = published.filter((event) => isEventVisibleForCheckIn(event));

      const pickTodayTotemEvents = (candidates: TotemEvent[]) =>
        candidates.filter((event) => isEventCalendarToday(event.event_date));

      if (!columnAvailable) {
        setTotemCompatMode(true);
        const todayCompat = pickTodayTotemEvents(visible as TotemEvent[]);

        if (!todayCompat.length) {
          setEvents([]);
          setEmptyReason(visible.length ? 'no_totem_today' : published.length ? 'date_out_of_range' : 'not_published');
          setSelectedEventId(null);
          return;
        }

        setEvents(todayCompat);
        setEmptyReason('column_missing');
        setSelectedEventId(todayCompat[0]?.id ?? null);
        return;
      }

      const totemEvents = visible.filter(
        (event) => event.totem_ativo === true || event.requer_quorum === true
      ) as TotemEvent[];
      const todayTotemEvents = pickTodayTotemEvents(totemEvents);

      if (!todayTotemEvents.length) {
        setEvents([]);
        setSelectedEventId(null);
        if (!published.length) {
          setEmptyReason('not_published');
        } else if (!visible.length) {
          setEmptyReason('date_out_of_range');
        } else if (totemEvents.length) {
          setEmptyReason('no_totem_today');
        } else {
          setEmptyReason('no_totem_flag');
        }
        return;
      }

      setEvents(todayTotemEvents);
      setSelectedEventId(todayTotemEvents[0]?.id ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar eventos.';
      setStatusMessage(message);
      setStatusTone('error');
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const handleExitSession = useCallback(() => {
    signOutAndReturnToLogin();
  }, []);

  const syncCameraPermission = useCallback(async () => {
    if (isWebTotem) {
      return null;
    }

    try {
      const response = await refreshCameraPermission();
      const granted = response.granted === true;
      setCameraAccessGranted((current) => granted || current);
      setCameraPermissionBlocked(!granted && response.canAskAgain === false);
      return response;
    } catch (error) {
      console.error('Erro ao verificar permissão da câmera:', error);
      return null;
    } finally {
      setPermissionCheckDone(true);
    }
  }, [refreshCameraPermission]);

  useEffect(() => {
    if (isWebTotem) {
      const probe = getWebCameraProbe();
      if (!probe.canUseCamera && probe.message) {
        setCameraMountError(probe.message);
      }
      setPermissionCheckDone(true);
      return;
    }

    void syncCameraPermission();
  }, [syncCameraPermission]);

  const closeTotemCamera = useCallback(() => {
    setCameraAccessGranted(false);
  }, []);

  const activateCamera = useCallback(async () => {
    if (cameraAccessGranted || permission?.granted) {
      setCameraPermissionBlocked(false);
      setCameraAccessGranted(true);
      setCameraMountError(null);
      return true;
    }

    setIsRequestingCameraPermission(true);
    setCameraMountError(null);

    try {
      if (isWebTotem) {
        const probe = getWebCameraProbe();

        if (!probe.canUseCamera) {
          setCameraMountError(probe.message ?? 'Câmera indisponível no navegador.');
          Alert.alert('Câmera indisponível', probe.message ?? 'Use localhost ou HTTPS.');
          return false;
        }

        const webResult = await requestWebCameraForTotem();

        if (webResult.granted) {
          setCameraAccessGranted(true);
          setCameraPermissionBlocked(false);
          setCameraMountError(null);
          return true;
        }

        setCameraPermissionBlocked(webResult.blocked);
        setCameraMountError(webResult.message ?? 'Permissão de câmera negada.');

        Alert.alert(
          webResult.blocked ? 'Câmera bloqueada' : 'Permissão necessária',
          webResult.message ?? 'Permita a câmera no navegador e tente novamente.'
        );
        return false;
      }

      let response = await requestPermission();

      if (!response.granted) {
        response = await Camera.requestCameraPermissionsAsync();
      }

      const granted = response.granted === true;
      setCameraAccessGranted(granted);
      setCameraPermissionBlocked(!granted && response.canAskAgain === false);

      if (!granted) {
        if (!response.canAskAgain) {
          Alert.alert(
            'Câmera bloqueada',
            'Permita a câmera nas configurações do aparelho e tente novamente.'
          );
        } else {
          Alert.alert(
            'Permissão necessária',
            'É preciso permitir a câmera para ler o QR Code no totem.'
          );
        }
      }

      return granted;
    } catch (error) {
      console.error('Erro ao ativar câmera:', error);
      Alert.alert(
        'Erro na câmera',
        isWebTotem
          ? 'Use http://localhost na porta do Expo e permita a câmera no navegador.'
          : 'Não foi possível abrir a câmera. Tente novamente.'
      );
      return false;
    } finally {
      setIsRequestingCameraPermission(false);
    }
  }, [cameraAccessGranted, permission?.granted, requestPermission]);

  useFocusEffect(
    useCallback(() => {
      if (isWebTotem) {
        return;
      }

      void syncCameraPermission();
    }, [syncCameraPermission])
  );

  const handleBarcode = useCallback(
    async (rawData: string) => {
      if (!selectedEventId || !scanEnabled || processingScanRef.current || loading) {
        return;
      }

      const familyId = normalizeScannedFamilyId(rawData);
      if (!familyId) {
        return;
      }

      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.value === familyId && now - last.at < SCAN_COOLDOWN_MS) {
        return;
      }

      lastScanRef.current = { value: familyId, at: now };
      processingScanRef.current = true;
      setScanEnabled(false);
      setStatusMessage('Validando pré-check-in...');
      setStatusTone('neutral');

      try {
        const lookup = await lookupTotemCheckin(selectedEventId, familyId);

        if (lookup.already_confirmed) {
          closeTotemCamera();
          setStatusMessage(TOTEM_CHECKIN_ALREADY_CONFIRMED_MESSAGE);
          setStatusTone('warning');
          Toast.show({
            type: 'info',
            text1: TOTEM_CHECKIN_ALREADY_CONFIRMED_MESSAGE,
            text2: 'Leitura encerrada. Ative a câmera para o próximo QR Code.',
          });
          return;
        }

        if (!lookup.can_confirm) {
          setStatusMessage(
            lookup.message ??
              'Nenhum pré-check-in encontrado. Registre a família na audiência do evento.'
          );
          setStatusTone('error');
          Toast.show({
            type: 'error',
            text1: 'Pré-check-in não encontrado',
            text2: lookup.message ?? 'Família sem inscrição pendente.',
          });
          return;
        }

        const result = await confirmTotemCheckin(selectedEventId, familyId);

        if (result.success && result.code === 'CONFIRMED') {
          closeTotemCamera();
          setStatusMessage('Confirmação realizada com sucesso');
          setStatusTone('success');
          Toast.show({
            type: 'success',
            text1: 'Confirmação realizada com sucesso',
            text2: `Família ${familyId}`,
          });
          return;
        }

        if (result.code === 'ALREADY_CONFIRMED') {
          closeTotemCamera();
          setStatusMessage(TOTEM_CHECKIN_ALREADY_CONFIRMED_MESSAGE);
          setStatusTone('warning');
          return;
        }

        setStatusMessage(result.message ?? 'Não foi possível confirmar o check-in.');
        setStatusTone('error');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao processar QR Code.';
        setStatusMessage(message);
        setStatusTone('error');
      } finally {
        processingScanRef.current = false;
        setTimeout(() => {
          setScanEnabled(true);
        }, SCAN_COOLDOWN_MS);
      }
    },
    [
      closeTotemCamera,
      confirmTotemCheckin,
      loading,
      lookupTotemCheckin,
      scanEnabled,
      selectedEventId,
    ]
  );

  const cameraGranted = isWebTotem
    ? cameraAccessGranted
    : cameraAccessGranted || permission?.granted === true;
  const showCameraGateLoading =
    !permissionCheckDone || (isRequestingCameraPermission && !cameraGranted);

  const emptyTitle =
    emptyReason === 'column_missing'
      ? 'Banco sem coluna totem_ativo'
      : emptyReason === 'not_published'
        ? 'Nenhum evento publicado'
        : emptyReason === 'date_out_of_range'
          ? 'Nenhum evento na janela de datas'
          : emptyReason === 'no_totem_today'
            ? 'Nenhum totem aberto hoje'
            : 'Nenhum evento com totem ou quórum ativo';

  const emptyText =
    emptyReason === 'column_missing'
      ? `${TOTEM_COLUMN_SQL_HINT} Depois, edite o evento de hoje na manutenção, marque Ativação de Totem = Sim e salve de novo.`
      : emptyReason === 'not_published'
        ? 'Na manutenção, ative a chave Publicação (evento visível) e salve.'
        : emptyReason === 'date_out_of_range'
          ? 'Ajuste a data do evento (hoje, futuro ou até 14 dias atrás) na manutenção.'
          : emptyReason === 'no_totem_today'
            ? 'Hoje não há evento com totem ativo. Na manutenção, confira a data de hoje e Ativação de Totem = Sim.'
            : 'O evento está publicado, mas totem_ativo e requer_quorum estão desligados. Na manutenção, marque Totem ou Requer Quórum e salve. Se já fez isso, execute scripts/events-totem-ativo-fix-nulls.sql no Supabase e salve de novo.';

  const renderSessionFooter = () => (
    <TouchableOpacity
      style={styles.exitButton}
      onPress={handleExitSession}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={EXIT_SESSION_UI.accessibilityLabel}
      accessibilityHint={EXIT_SESSION_UI.accessibilityHint}
    >
      <Text style={styles.exitButtonText}>{EXIT_SESSION_UI.button}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Totem — Check-in</Text>
      </View>

      <View style={styles.body}>
        {loadingEvents ? (
          <View style={styles.centeredBlock}>
            <ActivityIndicator color="#38bdf8" size="large" />
          </View>
        ) : !events.length ? (
          <View style={styles.centeredBlock}>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : (
          <View style={styles.mainColumn}>
            <View style={styles.topSection}>
            {totemCompatMode ? (
              <View style={styles.compatBanner}>
                <Text style={styles.compatBannerText}>
                  Modo provisório: coluna totem_ativo ausente no Supabase.
                  {`\n\n`}
                  {TOTEM_COLUMN_SQL_HINT}
                </Text>
              </View>
            ) : null}

            {selectedEvent ? (
              <View style={styles.eventInfoBox}>
                <Text style={styles.eventInfoLabel}>Evento de hoje</Text>
                <Text style={styles.eventInfoName}>{selectedEvent.name}</Text>
                {formatEventDateTimeLabel(selectedEvent.event_date) ? (
                  <Text style={styles.eventInfoWhen}>
                    {formatEventDateTimeLabel(selectedEvent.event_date)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {statusMessage ? (
              <View
                style={[
                  styles.statusBanner,
                  statusTone === 'success' && styles.statusBannerSuccess,
                  statusTone === 'error' && styles.statusBannerError,
                  statusTone === 'warning' && styles.statusBannerWarning,
                ]}
              >
                <Text style={styles.statusBannerText}>{statusMessage}</Text>
              </View>
            ) : (
              <Text style={styles.hint}>
                Aponte para o QR Code da família. Só confirma quem tiver pré-check-in na audiência.
              </Text>
            )}
            </View>

            <View style={styles.cameraFrame}>
            {cameraGranted && cameraViewAvailable ? (
              <CameraView
                key={isWebTotem ? 'totem-web-camera' : 'totem-native-camera'}
                style={[styles.camera, isWebTotem && styles.cameraWeb]}
                facing={totemCameraFacing}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onMountError={(event) => {
                  const detail =
                    ('message' in event && typeof event.message === 'string'
                      ? event.message
                      : null) ??
                    ('nativeEvent' in event &&
                    event.nativeEvent &&
                    typeof event.nativeEvent === 'object' &&
                    'message' in event.nativeEvent &&
                    typeof event.nativeEvent.message === 'string'
                      ? event.nativeEvent.message
                      : null) ??
                    'Não foi possível iniciar a câmera.';
                  setCameraMountError(detail);
                  if (isWebTotem) {
                    setCameraAccessGranted(false);
                  }
                }}
                onBarcodeScanned={
                  scanEnabled && selectedEventId
                    ? ({ data }) => {
                        void handleBarcode(data);
                      }
                    : undefined
                }
              />
            ) : (
              <View style={styles.cameraGate}>
                {showCameraGateLoading ? (
                  <>
                    <ActivityIndicator color="#38bdf8" size="large" />
                    <Text style={styles.cameraGateText}>Preparando câmera do totem...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cameraGateTitle}>Câmera do totem</Text>
                    <Text style={styles.cameraGateText}>
                      {cameraMountError
                        ? cameraMountError
                        : !cameraViewAvailable
                          ? 'Componente de câmera indisponível nesta execução web estática.'
                        : cameraPermissionBlocked
                          ? 'Acesso negado. Abra as configurações do aparelho e permita a câmera para este app.'
                          : isWebTotem
                            ? 'Toque em Ativar câmera e aceite no pop-up do navegador. Use http://localhost (não o IP da rede).'
                            : 'Toque no botão e confirme a permissão de câmera no alerta do sistema.'}
                    </Text>
                    {cameraPermissionBlocked ? (
                      <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            void activateCamera();
                            return;
                          }
                          void Linking.openSettings();
                        }}
                      >
                        <Text style={styles.primaryButtonText}>
                          {Platform.OS === 'web' ? 'Tentar novamente' : 'Abrir configurações'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.primaryButton}
                        disabled={isRequestingCameraPermission}
                        onPress={() => {
                          void activateCamera();
                        }}
                      >
                        <Text style={styles.primaryButtonText}>
                          {isRequestingCameraPermission ? 'Aguarde...' : 'Ativar câmera'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}
            {cameraGranted && !scanEnabled ? (
              <View style={styles.cameraOverlay}>
                <ActivityIndicator color="#38bdf8" size="large" />
              </View>
            ) : null}
            </View>
          </View>
        )}
      </View>

      {renderSessionFooter()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  header: {
    paddingTop: 4,
    paddingBottom: 6,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    flex: 1,
  },
  centeredBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  mainColumn: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    paddingTop: 4,
  },
  topSection: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cameraGate: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
  },
  cameraGateTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  cameraGateText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  primaryButton: {
    alignSelf: 'stretch',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  compatBanner: {
    width: '100%',
    maxWidth: 520,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  compatBannerText: {
    color: '#fde68a',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  eventInfoBox: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  eventInfoLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  eventInfoName: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  eventInfoWhen: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraFrame: {
    width: '100%',
    maxWidth: 520,
    height: TOTEM_CAMERA_FRAME_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  camera: {
    width: '100%',
    height: TOTEM_CAMERA_FRAME_HEIGHT,
  },
  cameraWeb: {
    width: '100%',
    height: TOTEM_CAMERA_FRAME_HEIGHT,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
    width: '100%',
  },
  statusBanner: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 12,
    padding: 14,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    borderWidth: 1,
    borderColor: '#475569',
  },
  statusBannerSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.45)',
  },
  statusBannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  statusBannerWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  statusBannerText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  exitButton: {
    flexShrink: 0,
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  exitButtonDisabled: {
    opacity: 0.7,
  },
  exitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
