import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFamilyData } from '@/hooks/useFamilyData';

export const CheckinModal = ({ visible, onClose, userId }: { visible: boolean, onClose: () => void, userId: string }) => {
  const { family, members, loading } = useFamilyData(userId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleConfirm = async () => {
    // Em breve implementaremos a gravação no banco aqui
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {loading ? (
            <ActivityIndicator size="large" color="#8b5cf6" />
          ) : (
            <>
              <Text style={styles.title}>Check-in: {family?.name || 'Família'}</Text>
              <Text style={styles.subtitle}>Selecione quem está presente:</Text>
              
              <FlatList
                data={members}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.memberCard, selectedIds.includes(item.id) && styles.selected]}
                    onPress={() => toggleSelection(item.id)}
                  >
                    <Text style={[styles.memberName, selectedIds.includes(item.id) && styles.selectedText]}>
                      {item.nome}
                    </Text>
                  </TouchableOpacity>
                )}
              />

              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                <Text style={styles.btnText}>Confirmar Presença</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  container: { backgroundColor: '#fff', borderRadius: 20, padding: 20, maxHeight: '80%' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#666', marginBottom: 20 },
  memberCard: { padding: 15, borderBottomWidth: 1, borderColor: '#eee', borderRadius: 10, marginVertical: 5 },
  selected: { backgroundColor: '#8b5cf6' },
  memberName: { fontSize: 16 },
  selectedText: { color: '#fff', fontWeight: 'bold' },
  confirmBtn: { backgroundColor: '#8b5cf6', padding: 15, borderRadius: 10, marginTop: 20, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  cancelBtn: { marginTop: 15, alignItems: 'center' },
  cancelText: { color: '#666' }
});