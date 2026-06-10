import { usePwaInstall } from '@/hooks/usePwaInstall';
import { APP_WATERMARK_IMAGE } from '@/lib/appWatermark';
import { Image } from 'expo-image';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

const BUTTON_SIZE = 44;
const LOGO_SIZE = 30;
const SQUIRCLE_RADIUS = Math.round(BUTTON_SIZE * 0.27);

export function PwaInstallButton() {
  const { install, isVisible } = usePwaInstall();

  if (Platform.OS !== 'web' || !isVisible) {
    return null;
  }

  return (
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
});
