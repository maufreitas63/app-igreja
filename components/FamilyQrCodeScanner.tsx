import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { getWebCameraProbe, requestWebCameraForTotem } from '@/lib/totemWebCamera';
import { FontAwesome } from '@expo/vector-icons';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onScan: (rawValue: string) => void;
};

const isWeb = Platform.OS === 'web';
const cameraFacing = isWeb ? 'front' : 'back';
const cameraViewAvailable = typeof CameraView === 'function';

/** Modal de leitura de QR Code de família (check-in nas salas). */
export function FamilyQrCodeScanner({ visible, onClose, onScan }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const emitScan = useCallback((raw: string) => {
    if (handledRef.current) {
      return;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    handledRef.current = true;
    onScanRef.current(trimmed);
  }, []);

  useEffect(() => {
    if (!visible) {
      handledRef.current = false;
      setCameraReady(false);
      setError(null);
      setStarting(false);
      return;
    }

    handledRef.current = false;
    let cancelled = false;
    setStarting(true);
    setError(null);

    void (async () => {
      try {
        if (isWeb) {
          const probe = getWebCameraProbe();
          if (!probe.canUseCamera) {
            if (!cancelled) {
              setError(probe.message ?? 'Câmera indisponível neste navegador.');
              setCameraReady(false);
            }
            return;
          }
          const webResult = await requestWebCameraForTotem();
          if (cancelled) {
            return;
          }
          if (!webResult.granted) {
            setError(webResult.message ?? 'Permissão de câmera negada.');
            setCameraReady(false);
            return;
          }
          setCameraReady(true);
          return;
        }

        let granted = permission?.granted === true;
        if (!granted) {
          const asked = await requestPermission();
          granted = asked.granted === true;
        }
        if (!granted) {
          const fallback = await Camera.requestCameraPermissionsAsync();
          granted = fallback.granted === true;
        }
        if (cancelled) {
          return;
        }
        if (!granted) {
          setError('Permita a câmera para ler o QR Code da família.');
          setCameraReady(false);
          return;
        }
        setCameraReady(true);
      } catch {
        if (!cancelled) {
          setError('Não foi possível abrir a câmera.');
          setCameraReady(false);
        }
      } finally {
        if (!cancelled) {
          setStarting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [permission?.granted, requestPermission, visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Ler QR Code da família</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Fechar leitor"
            style={styles.close}
          >
            <FontAwesome name="times" size={18} color={MINIMAL_UI.onDark} />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Aponte a câmera para o QR apresentado pelo responsável. As crianças da sala ativa serão
          registradas automaticamente.
        </Text>

        <View style={styles.cameraFrame}>
          {starting ? (
            <ActivityIndicator color={MINIMAL_UI.onDark} size="large" />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : cameraReady && cameraViewAvailable ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing={cameraFacing}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => emitScan(data)}
            />
          ) : (
            <Text style={styles.errorText}>Câmera indisponível neste dispositivo.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: Platform.OS === 'web' ? 24 : 48,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: MINIMAL_UI.onDark,
    fontSize: 18,
    fontWeight: '800',
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  hint: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  cameraFrame: {
    flex: 1,
    minHeight: 280,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
