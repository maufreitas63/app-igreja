import { CloseFooterBar, CLOSE_FOOTER_DOCK_HEIGHT } from '@/components/minimal/CloseFooterBar';
import { formatFullName } from '@/lib/fullName';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Member = {
  profile_id: string;
  full_name: string | null;
};

type Props = {
  visible: boolean;
  loading?: boolean;
  error?: string | null;
  members: Member[];
  onClose: () => void;
};

export function SmallGroupMembersModal({
  visible,
  loading = false,
  error = null,
  members,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Participantes</Text>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} nestedScrollEnabled>
            {loading ? (
              <ActivityIndicator color="#1E3A5F" style={styles.loader} />
            ) : error ? (
              <Text style={styles.empty}>{error}</Text>
            ) : members.length === 0 ? (
              <Text style={styles.empty}>Nenhum participante neste grupo.</Text>
            ) : (
              members.map((member) => (
                <Text key={member.profile_id} style={styles.name}>
                  {formatFullName(member.full_name) || '—'}
                </Text>
              ))
            )}
          </ScrollView>

          <CloseFooterBar onPress={onClose} accessibilityLabel="Fechar lista de participantes" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    paddingBottom: CLOSE_FOOTER_DOCK_HEIGHT,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    paddingBottom: 0,
    overflow: 'hidden',
    gap: 8,
  },
  title: {
    color: '#1E3A5F',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    minHeight: 80,
  },
  bodyContent: {
    paddingVertical: 8,
    gap: 10,
  },
  loader: {
    marginVertical: 24,
  },
  name: {
    color: '#1E3A5F',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  empty: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
