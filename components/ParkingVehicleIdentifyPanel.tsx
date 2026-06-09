import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  formatVehicleFieldValue,
  type VehicleLookupResult,
} from '@/lib/profileVehicleLookup';

type Props = {
  placaQuery: string;
  loading: boolean;
  error: string | null;
  result: VehicleLookupResult | null;
  onChangePlaca: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  onOpenWhatsapp: (phone: string | null) => void;
  /** Preenche a altura do card e rola o resultado do proprietário se necessário. */
  fillAvailableHeight?: boolean;
};

const VehicleDetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

export function ParkingVehicleIdentifyPanel({
  placaQuery,
  loading,
  error,
  result,
  onChangePlaca,
  onSearch,
  onReset,
  onOpenWhatsapp,
  fillAvailableHeight = false,
}: Props) {
  const ownerName = result?.owner?.full_name?.trim() || 'Proprietário não cadastrado';
  const contactPhone = result?.contactPhone?.trim() || null;
  const canOpenWhatsapp = Boolean(contactPhone);

  const resultBody = result ? (
    <View style={styles.resultCard}>
      <View style={styles.ownerBlock}>
        <Text style={styles.ownerLabel}>Proprietário</Text>
        <Text style={styles.ownerName} numberOfLines={2}>
          {ownerName}
        </Text>
      </View>

      <VehicleDetailRow label="Placa" value={formatVehicleFieldValue(result.vehicle.placa)} />
      <VehicleDetailRow label="Marca" value={formatVehicleFieldValue(result.vehicle.marca)} />
      <VehicleDetailRow label="Modelo" value={formatVehicleFieldValue(result.vehicle.modelo)} />
      <VehicleDetailRow label="Cor" value={formatVehicleFieldValue(result.vehicle.cor)} />

      <View style={styles.phoneRow}>
        <View style={styles.phoneTextBlock}>
          <Text style={styles.detailLabel}>Telefone</Text>
          <Text style={styles.phoneValue} numberOfLines={1}>
            {formatVehicleFieldValue(contactPhone)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.whatsappButton, !canOpenWhatsapp && styles.whatsappButtonDisabled]}
          onPress={() => onOpenWhatsapp(contactPhone)}
          disabled={!canOpenWhatsapp}
          activeOpacity={0.85}
          accessibilityLabel="Abrir WhatsApp do proprietário"
        >
          <FontAwesome name="whatsapp" size={20} color={canOpenWhatsapp ? '#25D366' : '#64748B'} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.newSearchButton} onPress={onReset} activeOpacity={0.85}>
        <Text style={styles.newSearchText}>Nova busca</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <View style={[styles.sectionBox, fillAvailableHeight && styles.sectionBoxFill]}>
      <Text style={styles.sectionTitle}>Identificar veículo</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Número da placa"
          placeholderTextColor="#64748b"
          value={placaQuery}
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={onChangePlaca}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={[styles.searchButton, loading && styles.searchButtonDisabled]}
          onPress={onSearch}
          disabled={loading}
          activeOpacity={0.85}
          accessibilityLabel="Buscar veículo pela placa"
        >
          {loading ? (
            <ActivityIndicator color="#020617" size="small" />
          ) : (
            <FontAwesome name="search" size={18} color="#020617" />
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {resultBody ? (
        fillAvailableHeight ? (
          <ScrollView
            style={styles.resultScroll}
            contentContainerStyle={styles.resultScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            {resultBody}
          </ScrollView>
        ) : (
          resultBody
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    padding: 12,
    gap: 8,
  },
  sectionBoxFill: {
    flex: 1,
    minHeight: 0,
  },
  sectionTitle: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
    flexShrink: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    paddingHorizontal: 12,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 0,
  },
  resultScroll: {
    flex: 1,
    minHeight: 0,
  },
  resultScrollContent: {
    flexGrow: 1,
    paddingBottom: 2,
  },
  resultCard: {
    gap: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  ownerBlock: {
    gap: 2,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  ownerLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ownerName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    minWidth: 64,
  },
  detailValue: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 17,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  phoneTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  phoneValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  whatsappButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.35)',
  },
  whatsappButtonDisabled: {
    opacity: 0.55,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  newSearchButton: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  newSearchText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
});
