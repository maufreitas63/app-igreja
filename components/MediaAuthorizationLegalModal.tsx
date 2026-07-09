import { FontAwesome } from '@expo/vector-icons';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MEDIA_AUTHORIZATION_LEGAL_INFO } from '@/lib/mediaAuthorization';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function MediaAuthorizationLegalModal({ visible, onClose }: Props) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar explicação" />
        <View style={styles.panel}>
          <View style={styles.header}>
            <FontAwesome name="info-circle" size={20} color={MINIMAL_UI.icon} />
            <Text style={styles.title}>Por que este aceite tem validade jurídica?</Text>
          </View>
          <Text style={styles.body}>{MEDIA_AUTHORIZATION_LEGAL_INFO}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Entendi</Text>
          </Pressable>
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
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: MINIMAL_UI.blue,
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: MINIMAL_UI.icon,
  },
});
