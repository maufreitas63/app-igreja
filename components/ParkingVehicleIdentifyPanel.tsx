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
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';

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

const PARKING_VEHICLE_SURFACE = '#FFFFFF';
const PARKING_VEHICLE_ICON_COLOR = '#1B4F8A';
const PARKING_VEHICLE_BORDER_COLOR = VIGILANCE_SCALES_UI.accent;

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
      <VehicleDetailRow label="Proprietário" value={ownerName} />
      <VehicleDetailRow label="Placa" value={formatVehicleFieldValue(result.vehicle.placa)} />
      <VehicleDetailRow label="Marca" value={formatVehicleFieldValue(result.vehicle.marca)} />
      <VehicleDetailRow label="Modelo" value={formatVehicleFieldValue(result.vehicle.modelo)} />
      <VehicleDetailRow label="Cor" value={formatVehicleFieldValue(result.vehicle.cor)} />

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Telefone</Text>
        <View style={styles.phoneValueRow}>
          <Text style={styles.detailValue} numberOfLines={1}>
            {formatVehicleFieldValue(contactPhone)}
          </Text>
          <TouchableOpacity
            style={[styles.whatsappButton, !canOpenWhatsapp && styles.whatsappButtonDisabled]}
            onPress={() => onOpenWhatsapp(contactPhone)}
            disabled={!canOpenWhatsapp}
            activeOpacity={0.85}
            accessibilityLabel="Abrir WhatsApp do proprietário"
          >
            <FontAwesome name="whatsapp" size={18} color={canOpenWhatsapp ? '#25D366' : '#64748B'} />
          </TouchableOpacity>
        </View>
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
            <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} size="small" />
          ) : (
            <FontAwesome name="search" size={18} color={PARKING_VEHICLE_ICON_COLOR} />
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
    backgroundColor: PARKING_VEHICLE_SURFACE,
    padding: 12,
    gap: 8,
  },
  sectionBoxFill: {
    flex: 1,
    minHeight: 0,
  },
  sectionTitle: {
    color: VIGILANCE_SCALES_UI.accent,
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
    borderColor: PARKING_VEHICLE_BORDER_COLOR,
    backgroundColor: PARKING_VEHICLE_SURFACE,
    paddingHorizontal: 12,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: PARKING_VEHICLE_SURFACE,
    borderWidth: 1,
    borderColor: PARKING_VEHICLE_BORDER_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: VIGILANCE_SCALES_UI.accent,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: PARKING_VEHICLE_SURFACE,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailLabel: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    minWidth: 88,
    opacity: 0.88,
  },
  detailValue: {
    flex: 1,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 17,
  },
  phoneValueRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 0,
  },
  whatsappButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PARKING_VEHICLE_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VIGILANCE_SCALES_UI.border,
    flexShrink: 0,
  },
  whatsappButtonDisabled: {
    opacity: 0.55,
    borderColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: PARKING_VEHICLE_SURFACE,
  },
  newSearchButton: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  newSearchText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});
