import { CloseButton } from '@/components/minimal/CloseFooterBar';
import { FontAwesome } from '@expo/vector-icons';
import {
  ALIANCA_PREMIACAO_INFO_SECTIONS,
  ALIANCA_PREMIACAO_INFO_TITLE,
} from '@/lib/alianca/aliancaPremiacaoInfo';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AliancaPremiacaoInfoModal({ visible, onClose }: Props) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar explicação" />
        <View style={styles.panel}>
          <View style={styles.header}>
            <FontAwesome name="info-circle" size={20} color={MINIMAL_UI.icon} />
            <Text style={styles.title}>{ALIANCA_PREMIACAO_INFO_TITLE}</Text>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            {ALIANCA_PREMIACAO_INFO_SECTIONS.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.body}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
          <CloseButton onPress={onClose} />
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
    maxHeight: '88%',
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
  scroll: {
    flexGrow: 0,
    maxHeight: 420,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 8,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: MINIMAL_UI.blue,
  },
});
