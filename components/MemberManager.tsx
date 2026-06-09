import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

export type FamilyMemberListItem = {
  id: string;
  nome: string;
};

type MemberManagerProps = {
  members: FamilyMemberListItem[];
  onUpdate: () => void;
};

export const MemberManager = ({ members }: MemberManagerProps) => {
  
  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Membros da Família/Grupo</Text>
      
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <Text style={styles.memberName}>{item.nome}</Text>
            {/* Aqui entraremos com os botões de Editar/Excluir no próximo passo */}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Nenhum membro cadastrado.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 20, padding: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 10 },
  memberRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 15, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 10, 
    marginVertical: 5 
  },
  memberName: { color: '#FFF', fontSize: 16 },
  emptyText: { color: '#94A3B8', fontStyle: 'italic' }
});