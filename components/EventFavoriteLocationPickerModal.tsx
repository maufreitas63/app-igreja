import type { EventFavoriteLocation } from '@/lib/eventFavoriteLocationsApi';
import { MaterialIcons } from '@expo/vector-icons';
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

type Props = {
  visible: boolean;
  locations: EventFavoriteLocation[];
  loading: boolean;
  schemaMissing: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (location: EventFavoriteLocation) => void;
};

export function EventFavoriteLocationPickerModal({
  visible,
  locations,
  loading,
  schemaMissing,
  error,
  onClose,
  onSelect,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Locais favoritos</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar seleção de locais favoritos"
              hitSlop={8}
            >
              <MaterialIcons name="close" size={22} color="#CBD5E1" />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color="#A5B4FC" />
            </View>
          ) : null}

          {!loading && schemaMissing ? (
            <Text style={styles.hintText}>
              A tabela de locais favoritos ainda não foi criada no Supabase.
            </Text>
          ) : null}

          {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!loading && !schemaMissing && !error && locations.length === 0 ? (
            <Text style={styles.hintText}>Nenhum local favorito cadastrado.</Text>
          ) : null}

          {!loading && locations.length > 0 ? (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {locations.map((location) => (
                <Pressable
                  key={location.id}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  onPress={() => onSelect(location)}
                  accessibilityRole="button"
                  accessibilityLabel={`Usar local favorito ${location.name}`}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>{location.name}</Text>
                    {location.address.trim() ? (
                      <Text style={styles.optionMeta} numberOfLines={2}>
                        {location.address}
                      </Text>
                    ) : null}
                    <Text style={styles.optionCapacity}>{location.capacity} vagas</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sheet: {
    maxHeight: '78%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.45)',
    backgroundColor: '#0f172a',
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  centerBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionPressed: {
    borderColor: '#A5B4FC',
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  optionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  optionMeta: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  optionCapacity: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700',
  },
});
