import { CloseButton } from '@/components/minimal/CloseFooterBar';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
  accessibilityCloseLabel?: string;
};

/**
 * Diálogo centrado com Fechar no próprio card (não no rodapé da tela).
 * Usado pelos «Como usar» para o botão não ficar atrás do Fechar da rota.
 */
export function CenteredCloseDialog({
  visible,
  onClose,
  title,
  subtitle,
  children,
  accessibilityCloseLabel = 'Fechar',
}: Props) {
  const { height } = useWindowDimensions();
  const panelMaxHeight = Math.round(height * 0.88);
  const scrollMaxHeight = Math.max(140, panelMaxHeight - 220);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel={accessibilityCloseLabel}
        />
        <View style={[styles.panel, { maxHeight: panelMaxHeight }]}>
          <View style={styles.header}>
            <FontAwesome name="info-circle" size={20} color={MINIMAL_UI.icon} />
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={accessibilityCloseLabel}
              hitSlop={8}
              style={styles.headerClose}
            >
              <Text style={styles.headerCloseX}>×</Text>
            </Pressable>
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <ScrollView
            style={[styles.scroll, { maxHeight: scrollMaxHeight }]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            {children}
          </ScrollView>
          <View style={styles.footer}>
            <CloseButton onPress={onClose} accessibilityLabel={accessibilityCloseLabel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    ...(Platform.OS === 'web' ? { zIndex: 100000 } : null),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  panel: {
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    padding: 20,
    gap: 14,
    zIndex: 2,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: MINIMAL_UI.text,
  },
  headerClose: {
    minWidth: 28,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseX: {
    color: '#DC2626',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: MINIMAL_UI.textMuted,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 4,
  },
  footer: {
    flexShrink: 0,
  },
});
