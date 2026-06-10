import { usePwaInstall } from '@/hooks/usePwaInstall';
import { APP_WATERMARK_IMAGE } from '@/lib/appWatermark';
import { Image } from 'expo-image';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const BUTTON_SIZE = 44;
const LOGO_SIZE = 30;
const SQUIRCLE_RADIUS = Math.round(BUTTON_SIZE * 0.27);

export function PwaInstallButton() {
  const { install, isVisible, instructions, dismissInstructions } = usePwaInstall();

  if (Platform.OS !== 'web' || !isVisible) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        accessibilityHint="Cria um atalho na tela inicial com o logotipo da igreja"
        accessibilityLabel="Adicionar à tela inicial do celular"
        accessibilityRole="button"
        onPress={() => {
          void install();
        }}
        style={styles.button}
      >
        <View style={styles.iconShell}>
          <Image
            source={APP_WATERMARK_IMAGE}
            style={styles.logo}
            contentFit="contain"
            accessible={false}
          />
        </View>
      </TouchableOpacity>

      <Modal
        transparent
        visible={instructions !== null}
        animationType="fade"
        onRequestClose={dismissInstructions}
      >
        <Pressable style={styles.backdrop} onPress={dismissInstructions}>
          <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.title}>{instructions?.title}</Text>
            <Text style={styles.message}>{instructions?.message}</Text>
            <Pressable
              style={({ pressed }) => [styles.confirmButton, pressed && styles.buttonPressed]}
              onPress={dismissInstructions}
            >
              <Text style={styles.confirmButtonText}>Entendi</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  iconShell: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: SQUIRCLE_RADIUS,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    padding: 20,
    gap: 16,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  confirmButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  buttonPressed: {
    opacity: 0.85,
  },
  confirmButtonText: {
    color: '#022C22',
    fontSize: 15,
    fontWeight: '700',
  },
});
