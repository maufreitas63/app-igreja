import { extractIsbnFromBarcode, ISBN_CAMERA_BARCODE_TYPES } from '@/lib/isbnBarcode';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { getWebCameraProbe } from '@/lib/totemWebCamera';
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
import Toast from 'react-native-toast-message';

type Props = {
  visible: boolean;
  onClose: () => void;
  onIsbn: (isbn: string) => void;
};

const isWeb = Platform.OS === 'web';
const cameraViewAvailable = typeof CameraView === 'function';

export function IsbnBarcodeScanner({ visible, onClose, onIsbn }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nativeReady, setNativeReady] = useState(false);
  const [webHostReady, setWebHostReady] = useState(false);
  const hostRef = useRef<View>(null);
  const stopWebScanRef = useRef<(() => void) | null>(null);
  const handledRef = useRef(false);
  const onIsbnRef = useRef(onIsbn);
  onIsbnRef.current = onIsbn;

  const emitIsbn = useCallback((raw: string) => {
    if (handledRef.current) {
      return;
    }
    const isbn = extractIsbnFromBarcode(raw);
    if (!isbn) {
      return;
    }
    handledRef.current = true;
    onIsbnRef.current(isbn);
  }, []);

  const stopWebScan = useCallback(() => {
    stopWebScanRef.current?.();
    stopWebScanRef.current = null;
  }, []);

  const requestPermissionRef = useRef(requestPermission);
  requestPermissionRef.current = requestPermission;
  const permissionGrantedRef = useRef(permission?.granted === true);
  permissionGrantedRef.current = permission?.granted === true;

  useEffect(() => {
    if (!visible) {
      handledRef.current = false;
      setNativeReady(false);
      setWebHostReady(false);
      setError(null);
      setStarting(false);
      stopWebScan();
      return;
    }

    handledRef.current = false;

    if (isWeb) {
      return;
    }

    let cancelled = false;
    setStarting(true);
    setError(null);
    void (async () => {
      try {
        let granted = permissionGrantedRef.current;
        if (!granted) {
          const asked = await requestPermissionRef.current();
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
          setError('Permita a câmera para bipar o código de barras do ISBN.');
          setNativeReady(false);
          return;
        }
        setNativeReady(true);
      } catch {
        if (!cancelled) {
          setError('Não foi possível abrir a câmera.');
          setNativeReady(false);
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
  }, [visible, stopWebScan]);

  useEffect(() => {
    if (!visible || !isWeb || !webHostReady) {
      return;
    }

    const probe = getWebCameraProbe();
    if (!probe.canUseCamera) {
      setError(probe.message ?? 'Câmera indisponível neste navegador.');
      return;
    }

    const node = hostRef.current as unknown as HTMLElement | null;
    if (!node) {
      setError('Não foi possível abrir o visor da câmera.');
      return;
    }

    let cancelled = false;
    setStarting(true);
    setError(null);
    void (async () => {
      try {
        const { canDetectBarcodesInBrowser, startWebIsbnScan } = await import(
          '@/lib/webIsbnBarcodeScanner'
        );
        if (cancelled) {
          return;
        }
        if (!canDetectBarcodesInBrowser()) {
          setError(
            'Este navegador não lê código de barras. Use Chrome ou Edge, ou digite o ISBN.'
          );
          return;
        }
        stopWebScan();
        stopWebScanRef.current = await startWebIsbnScan(node, emitIsbn);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível iniciar a leitura do código de barras.'
          );
        }
      } finally {
        if (!cancelled) {
          setStarting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      stopWebScan();
    };
  }, [visible, webHostReady, emitIsbn, stopWebScan]);

  const handlePhotoFallback = useCallback(() => {
    if (!isWeb) {
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      void (async () => {
        try {
          const { detectIsbnFromImageFile } = await import('@/lib/webIsbnBarcodeScanner');
          const raw = await detectIsbnFromImageFile(file);
          if (!raw) {
            Toast.show({
              type: 'error',
              text1: 'Não encontrei o código de barras na foto. Tente de novo ou digite o ISBN.',
            });
            return;
          }
          emitIsbn(raw);
        } catch {
          Toast.show({
            type: 'error',
            text1: 'Não foi possível ler a foto do código de barras.',
          });
        }
      })();
    };
    input.click();
  }, [emitIsbn]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Bipar ISBN</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar leitor" style={styles.close}>
            <FontAwesome name="times" size={18} color={MINIMAL_UI.onDark} />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Aponte a câmera para o código de barras do ISBN na contracapa do livro.
        </Text>

        <View style={styles.stage}>
          {isWeb ? (
            <View
              ref={hostRef}
              style={styles.camera}
              onLayout={() => setWebHostReady(true)}
            />
          ) : nativeReady && cameraViewAvailable ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: [...ISBN_CAMERA_BARCODE_TYPES] }}
              onBarcodeScanned={({ data }) => emitIsbn(data)}
            />
          ) : (
            <View style={styles.placeholder}>
              {starting ? (
                <ActivityIndicator color={MINIMAL_UI.onDark} />
              ) : (
                <FontAwesome name="barcode" size={36} color={MINIMAL_UI.onDark} />
              )}
            </View>
          )}
          {starting ? (
            <View style={styles.overlay}>
              <ActivityIndicator color={MINIMAL_UI.onDark} />
              <Text style={styles.overlayText}>Abrindo câmera…</Text>
            </View>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          {isWeb ? (
            <TouchableOpacity style={styles.secondary} onPress={handlePhotoFallback}>
              <FontAwesome name="camera" size={14} color={MINIMAL_UI.text} />
              <Text style={styles.secondaryText}>Usar foto</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.primary} onPress={onClose}>
            <Text style={styles.primaryText}>Digitar ISBN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: MINIMAL_UI.onDark,
    fontSize: 20,
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
    color: '#93C5FD',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  stage: {
    flex: 1,
    minHeight: 280,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  camera: {
    flex: 1,
    width: '100%',
    minHeight: 280,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(2,6,23,0.35)',
  },
  overlayText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
  },
  error: {
    marginTop: 12,
    color: '#FCA5A5',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    paddingVertical: 12,
    backgroundColor: MINIMAL_UI.background,
  },
  secondaryText: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
    fontSize: 14,
  },
  primary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  primaryText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '800',
    fontSize: 14,
  },
});
