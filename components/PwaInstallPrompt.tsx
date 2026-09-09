import { boxShadowStyle } from '@/lib/boxShadow';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HIDDEN_PATHS = new Set([
  '/totem-checkin',
  '/cadastro-familia',
  '/autorizacao-midia-confirmar',
]);

const normalizePath = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const {
    install,
    isVisible,
    instructions,
    dismissInstructions,
    dismissBanner,
    variant,
  } = usePwaInstall();

  const hiddenByRoute = useMemo(() => {
    const path = normalizePath(pathname);
    return HIDDEN_PATHS.has(path);
  }, [pathname]);

  if (Platform.OS !== 'web' || hiddenByRoute || !isVisible || !variant) {
    return null;
  }

  const isIos = variant === 'ios' || variant === 'ios-other-browser';
  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Pressable
        accessibilityLabel="Fechar aviso de instalação"
        accessibilityRole="button"
        onPress={() => {
          dismissInstructions();
          dismissBanner();
        }}
        style={styles.backdrop}
      />
      <View style={[styles.card, { marginBottom: bottomPad }]}>
        <Pressable
          accessibilityLabel="Fechar aviso de instalação"
          accessibilityRole="button"
          hitSlop={8}
          onPress={dismissBanner}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <FontAwesome name="times" size={16} color={MINIMAL_UI.textMuted} />
        </Pressable>

        <Text style={styles.title}>Leve o app para a tela inicial</Text>
        <Text style={styles.subtitle}>
          {isIos
            ? variant === 'ios-other-browser'
              ? 'No iPhone, a instalação só funciona no Safari. Abra este site no Safari e siga os passos:'
              : 'Acesso rápido, como um aplicativo — sem loja. No Safari:'
            : 'Acesso rápido, como um aplicativo — um toque e fica na tela inicial.'}
        </Text>

        {isIos ? (
          <View style={styles.steps}>
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <View style={styles.stepIconWrap}>
                <MaterialIcons name="ios-share" size={22} color={MINIMAL_UI.blueDark} />
              </View>
              <Text style={styles.stepText}>
                Toque em <Text style={styles.stepEmphasis}>Compartilhar</Text>
                {' '}(quadrado com seta) na barra do Safari
              </Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <View style={styles.stepIconWrap}>
                <MaterialIcons name="add-box" size={22} color={MINIMAL_UI.blueDark} />
              </View>
              <Text style={styles.stepText}>
                Role e toque em{' '}
                <Text style={styles.stepEmphasis}>Adicionar à Tela de Início</Text>
              </Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>3</Text>
              </View>
              <View style={styles.stepIconWrap}>
                <FontAwesome name="check" size={16} color={MINIMAL_UI.blueDark} />
              </View>
              <Text style={styles.stepText}>
                Confirme em <Text style={styles.stepEmphasis}>Adicionar</Text>
              </Text>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityHint="Abre a instalação nativa do Chrome"
            accessibilityLabel="Instalar na tela inicial"
            accessibilityRole="button"
            onPress={() => {
              void install();
            }}
            style={({ pressed }) => [styles.installButton, pressed && styles.pressed]}
          >
            <MaterialIcons name="add-to-home-screen" size={20} color={MINIMAL_UI.onDark} />
            <Text style={styles.installButtonText}>Instalar na tela inicial</Text>
          </Pressable>
        )}

        {instructions && variant === 'android' ? (
          <Text style={styles.fallbackHint}>{instructions.message}</Text>
        ) : null}

        <Pressable
          accessibilityLabel="Agora não"
          accessibilityRole="button"
          onPress={() => {
            dismissInstructions();
            dismissBanner();
          }}
          style={({ pressed }) => [styles.laterButton, pressed && styles.pressed]}
        >
          <Text style={styles.laterButtonText}>Agora não</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: Platform.OS === 'web' ? ('fixed' as const) : 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 240,
    paddingHorizontal: 16,
    justifyContent: 'flex-end',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: MINIMAL_UI.blueDark,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 10,
    zIndex: 1,
    ...boxShadowStyle({
      color: '#0F172A',
      offsetY: 12,
      blurRadius: 32,
      opacity: 0.38,
      elevation: 18,
    }),
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 17,
    fontWeight: '800',
    paddingRight: 28,
  },
  subtitle: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    lineHeight: 20,
  },
  steps: {
    gap: 10,
    marginTop: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: MINIMAL_UI.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: MINIMAL_UI.onDark,
    fontSize: 12,
    fontWeight: '800',
  },
  stepIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    color: MINIMAL_UI.text,
    fontSize: 14,
    lineHeight: 20,
  },
  stepEmphasis: {
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  installButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.blueDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  installButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 15,
    fontWeight: '800',
  },
  fallbackHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  laterButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
  laterButtonText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
});
