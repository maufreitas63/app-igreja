import { CloseFooterBar, CLOSE_FOOTER_DOCK_HEIGHT } from '@/components/minimal/CloseFooterBar';
import { boxShadowStyle } from '@/lib/boxShadow';
import { confirmDialog } from '@/lib/confirmDialog';
import {
  formatDeviceGeolocationPermissionError,
  formatGeolocationCoordinate,
  readPreciseDeviceGeolocation,
  requestDeviceGeolocationPermission,
} from '@/lib/deviceGeolocation';
import { resolveEventFavoriteLocationFromCep } from '@/lib/eventFavoriteLocationFromCep';
import {
  EVENT_FAVORITE_LOCATIONS_CEP_SQL_HINT,
  type EventFavoriteLocation,
  type EventFavoriteLocationInput,
} from '@/lib/eventFavoriteLocationsApi';
import { formatEventCapacityLabel, isUnlimitedEventCapacity, UNLIMITED_EVENT_CAPACITY_LABEL } from '@/lib/eventCapacity';
import { formatBrazilCepInput } from '@/lib/inputMasks';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  locations: EventFavoriteLocation[];
  loading: boolean;
  saving: boolean;
  deletingId: string | null;
  schemaMissing: boolean;
  cepColumnMissing: boolean;
  error: string | null;
  canManage: boolean;
  onClose: () => void;
  onSelect: (location: EventFavoriteLocation) => void;
  onSave: (input: EventFavoriteLocationInput, locationId?: string | null) => Promise<void>;
  onDelete: (locationId: string) => Promise<void>;
};

type FormState = {
  name: string;
  cep: string;
  address: string;
  latitude: string;
  longitude: string;
  capacity: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  name: '',
  cep: '',
  address: '',
  latitude: '',
  longitude: '',
  capacity: '',
  sortOrder: '0',
  isActive: true,
});

const formFromLocation = (location: EventFavoriteLocation): FormState => ({
  name: location.name,
  cep: location.cep ?? '',
  address: location.address,
  latitude: location.latitude === null ? '' : String(location.latitude),
  longitude: location.longitude === null ? '' : String(location.longitude),
  capacity: String(location.capacity),
  sortOrder: String(location.sort_order),
  isActive: location.is_active,
});

const parseOptionalCoordinate = (value: string) => {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export function EventFavoriteLocationPickerModal({
  visible,
  locations,
  loading,
  saving,
  deletingId,
  schemaMissing,
  cepColumnMissing,
  error,
  canManage,
  onClose,
  onSelect,
  onSave,
  onDelete,
}: Props) {
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setMode('list');
      setEditingId(null);
      setForm(emptyForm());
      setFormError(null);
      setCepLoading(false);
      setGeoLoading(false);
    }
  }, [visible]);

  const activeLocations = useMemo(
    () => locations.filter((location) => location.is_active),
    [locations]
  );

  const patchForm = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFormError(null);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setMode('form');
  };

  const openEditForm = (location: EventFavoriteLocation) => {
    setEditingId(location.id);
    setForm(formFromLocation(location));
    setFormError(null);
    setMode('form');
  };

  const handleLookupCep = async () => {
    setCepLoading(true);
    setFormError(null);

    try {
      const resolved = await resolveEventFavoriteLocationFromCep(form.cep);
      patchForm({
        cep: resolved.cep,
        address: resolved.address,
        latitude: resolved.latitude === null ? '' : String(resolved.latitude),
        longitude: resolved.longitude === null ? '' : String(resolved.longitude),
      });
    } catch (lookupError) {
      setFormError(
        lookupError instanceof Error
          ? lookupError.message
          : 'Não foi possível consultar o CEP.'
      );
    } finally {
      setCepLoading(false);
    }
  };

  const handleUseCurrentGeolocation = async () => {
    const hasExistingCoordinates =
      form.latitude.trim().length > 0 || form.longitude.trim().length > 0;

    const confirmed = await confirmDialog(
      'Usar localização atual',
      hasExistingCoordinates
        ? 'Deseja atualizar latitude e longitude com base na posição atual do aparelho? As coordenadas existentes serão substituídas.'
        : 'Deseja preencher latitude e longitude com base na posição atual do aparelho?',
      'Atualizar',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    setGeoLoading(true);
    setFormError(null);

    try {
      const permission = await requestDeviceGeolocationPermission();

      if (permission !== 'granted') {
        setFormError(formatDeviceGeolocationPermissionError(permission));
        return;
      }

      const reading = await readPreciseDeviceGeolocation();

      if (!reading) {
        setFormError(
          'Não foi possível obter a localização. Verifique se o GPS está ativo e tente novamente em área aberta.'
        );
        return;
      }

      patchForm({
        latitude: formatGeolocationCoordinate(reading.latitude),
        longitude: formatGeolocationCoordinate(reading.longitude),
      });
    } finally {
      setGeoLoading(false);
    }
  };

  const buildPayload = (): EventFavoriteLocationInput | null => {
    const name = form.name.trim();
    const capacity = Number.parseInt(form.capacity.replace(/\D/g, ''), 10);
    const sortOrder = Number.parseInt(form.sortOrder.replace(/\D/g, ''), 10) || 0;
    const latitude = parseOptionalCoordinate(form.latitude);
    const longitude = parseOptionalCoordinate(form.longitude);

    if (!name) {
      setFormError('Informe o nome do local.');
      return null;
    }

    if (!Number.isFinite(capacity) || capacity <= 0) {
      setFormError('Informe a capacidade com um número maior que zero.');
      return null;
    }

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setFormError('Latitude e longitude devem ser números válidos.');
      return null;
    }

    return {
      name,
      cep: form.cep.trim() || null,
      address: form.address.trim(),
      latitude,
      longitude,
      capacity,
      sort_order: sortOrder,
      is_active: form.isActive,
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    try {
      await onSave(payload, editingId);
      setMode('list');
      setEditingId(null);
      setForm(emptyForm());
    } catch {
      // erro tratado no hook
    }
  };

  const handleDelete = async () => {
    if (!editingId) {
      return;
    }

    const confirmed = await confirmDialog(
      'Apagar local favorito',
      `Remover "${form.name.trim() || 'este local'}"? Esta ação não pode ser desfeita.`,
      'Apagar',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    try {
      await onDelete(editingId);
      setMode('list');
      setEditingId(null);
      setForm(emptyForm());
    } catch {
      // erro tratado no hook
    }
  };

  const handleDeleteFromList = async (location: EventFavoriteLocation) => {
    const confirmed = await confirmDialog(
      'Apagar local favorito',
      `Remover "${location.name}"? Esta ação não pode ser desfeita.`,
      'Apagar',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    try {
      await onDelete(location.id);
    } catch {
      // erro tratado no hook
    }
  };

  const renderFieldLabel = (label: string) => <Text style={styles.fieldLabel}>{label}</Text>;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'list' ? 'Locais favoritos' : editingId ? 'Editar local' : 'Novo local'}
            </Text>
            <View style={styles.headerActions}>
              {mode === 'list' && canManage ? (
                <Pressable
                  style={styles.headerActionButton}
                  onPress={openCreateForm}
                  accessibilityRole="button"
                  accessibilityLabel="Cadastrar novo local favorito"
                >
                  <MaterialIcons name="add" size={18} color={MINIMAL_UI.icon} />
                  <Text style={styles.headerActionText}>Novo</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.sheetBody}>
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={MINIMAL_UI.accent} />
            </View>
          ) : null}

          {!loading && schemaMissing ? (
            <Text style={styles.hintText}>
              A tabela de locais favoritos ainda não foi criada no Supabase.
            </Text>
          ) : null}

          {!loading && cepColumnMissing ? (
            <Text style={styles.warningText}>{EVENT_FAVORITE_LOCATIONS_CEP_SQL_HINT}</Text>
          ) : null}

          {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!loading && mode === 'list' ? (
            <>
              {!schemaMissing && activeLocations.length === 0 ? (
                <Text style={styles.hintText}>Nenhum local favorito ativo cadastrado.</Text>
              ) : null}

              {locations.length > 0 ? (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                  {locations.map((location) => {
                    const isDeleting = deletingId === location.id;

                    return (
                      <View key={location.id} style={styles.optionRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.option,
                            !location.is_active && styles.optionInactive,
                            pressed && location.is_active && styles.optionPressed,
                          ]}
                          onPress={() => {
                            if (location.is_active) {
                              onSelect(location);
                            }
                          }}
                          disabled={!location.is_active || isDeleting}
                          accessibilityRole="button"
                          accessibilityLabel={`Usar local favorito ${location.name}`}
                        >
                          <View style={styles.optionTextWrap}>
                            <Text style={styles.optionTitle}>{location.name}</Text>
                            {location.cep ? (
                              <Text style={styles.optionMeta}>CEP {location.cep}</Text>
                            ) : null}
                            {location.address.trim() ? (
                              <Text style={styles.optionMeta} numberOfLines={2}>
                                {location.address}
                              </Text>
                            ) : null}
                            <Text style={styles.optionCapacity}>
                              {formatEventCapacityLabel(location.capacity)}
                            </Text>
                            {!location.is_active ? (
                              <Text style={styles.optionInactiveLabel}>Inativo</Text>
                            ) : null}
                          </View>
                          {location.is_active ? (
                            <MaterialIcons name="chevron-right" size={20} color={MINIMAL_UI.textMuted} />
                          ) : null}
                        </Pressable>

                        {canManage ? (
                          <View style={styles.optionActions}>
                            <Pressable
                              style={styles.iconButton}
                              onPress={() => openEditForm(location)}
                              accessibilityRole="button"
                              accessibilityLabel={`Editar ${location.name}`}
                            >
                              <MaterialIcons name="edit" size={18} color={MINIMAL_UI.accent} />
                            </Pressable>
                            <Pressable
                              style={styles.iconButton}
                              onPress={() => void handleDeleteFromList(location)}
                              disabled={isDeleting}
                              accessibilityRole="button"
                              accessibilityLabel={`Apagar ${location.name}`}
                            >
                              {isDeleting ? (
                                <ActivityIndicator color={MINIMAL_UI.blueDark} size="small" />
                              ) : (
                                <MaterialIcons name="delete-outline" size={18} color={MINIMAL_UI.blueDark} />
                              )}
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>
              ) : null}
            </>
          ) : null}

          {!loading && mode === 'form' && canManage ? (
            <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
              <View style={styles.localCapacityRow}>
                <View style={styles.localColumn}>
                  <View style={styles.nameGeoRow}>
                    <TextInput
                      style={[styles.input, styles.nameInput]}
                      placeholder="Ex.: Templo principal"
                      placeholderTextColor={MINIMAL_UI.textMuted}
                      value={form.name}
                      onChangeText={(text) => patchForm({ name: text })}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.geoTargetButton,
                        (pressed || geoLoading) && styles.geoTargetButtonPressed,
                      ]}
                      onPress={() => void handleUseCurrentGeolocation()}
                      disabled={geoLoading}
                      accessibilityRole="button"
                      accessibilityLabel="Usar localização atual do aparelho"
                    >
                      {geoLoading ? (
                        <ActivityIndicator color={MINIMAL_UI.accent} size="small" />
                      ) : (
                        <MaterialIcons name="gps-fixed" size={20} color={MINIMAL_UI.icon} />
                      )}
                    </Pressable>
                  </View>
                </View>
                <View style={styles.capacityColumn}>
                  <TextInput
                    style={[styles.input, styles.capacityInput]}
                    placeholder="Capacidade *"
                    placeholderTextColor={MINIMAL_UI.textMuted}
                    value={form.capacity}
                    keyboardType="number-pad"
                    onChangeText={(text) => patchForm({ capacity: text.replace(/\D/g, '') })}
                  />
                  {isUnlimitedEventCapacity(form.capacity) ? (
                    <Text style={styles.unlimitedHint}>{UNLIMITED_EVENT_CAPACITY_LABEL}</Text>
                  ) : null}
                </View>
              </View>

              {renderFieldLabel('CEP')}
              <View style={styles.cepRow}>
                <TextInput
                  style={[styles.input, styles.cepInput]}
                  placeholder="11677-042"
                  placeholderTextColor={MINIMAL_UI.textMuted}
                  value={form.cep}
                  keyboardType="number-pad"
                  onChangeText={(text) => patchForm({ cep: formatBrazilCepInput(text) })}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.lookupButton,
                    (pressed || cepLoading) && styles.lookupButtonPressed,
                  ]}
                  onPress={() => void handleLookupCep()}
                  disabled={cepLoading || cepColumnMissing}
                >
                  {cepLoading ? (
                    <ActivityIndicator color={MINIMAL_UI.accent} size="small" />
                  ) : (
                    <Text style={styles.lookupButtonText}>Buscar</Text>
                  )}
                </Pressable>
              </View>

              {renderFieldLabel('Endereço')}
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Preenchido automaticamente pelo CEP"
                placeholderTextColor={MINIMAL_UI.textMuted}
                value={form.address}
                multiline
                onChangeText={(text) => patchForm({ address: text })}
              />

              <View style={styles.coordRow}>
                <View style={styles.coordField}>
                  {renderFieldLabel('Latitude')}
                  <TextInput
                    style={styles.input}
                    placeholder="-23.6206"
                    placeholderTextColor={MINIMAL_UI.textMuted}
                    value={form.latitude}
                    keyboardType="decimal-pad"
                    onChangeText={(text) => patchForm({ latitude: text })}
                  />
                </View>
                <View style={styles.coordField}>
                  {renderFieldLabel('Longitude')}
                  <TextInput
                    style={styles.input}
                    placeholder="-45.4131"
                    placeholderTextColor={MINIMAL_UI.textMuted}
                    value={form.longitude}
                    keyboardType="decimal-pad"
                    onChangeText={(text) => patchForm({ longitude: text })}
                  />
                </View>
              </View>

              <View style={styles.coordRow}>
                <View style={styles.coordField}>
                  {renderFieldLabel('Ordem')}
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={MINIMAL_UI.textMuted}
                    value={form.sortOrder}
                    keyboardType="number-pad"
                    onChangeText={(text) => patchForm({ sortOrder: text.replace(/\D/g, '') })}
                  />
                </View>
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Ativo</Text>
                <Switch
                  value={form.isActive}
                  onValueChange={(isActive) => patchForm({ isActive })}
                  trackColor={{ false: MINIMAL_UI.divider, true: MINIMAL_UI.accent }}
                  thumbColor={MINIMAL_UI.background}
                />
              </View>

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <View style={styles.formActions}>
                {editingId ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      (pressed || deletingId === editingId) && styles.actionPressed,
                    ]}
                    onPress={() => void handleDelete()}
                    disabled={saving || deletingId === editingId}
                  >
                    {deletingId === editingId ? (
                      <ActivityIndicator color="#FCA5A5" size="small" />
                    ) : (
                      <Text style={styles.deleteButtonText}>Apagar</Text>
                    )}
                  </Pressable>
                ) : (
                  <View />
                )}
                <View style={styles.formActionsRight}>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.actionPressed]}
                    onPress={() => {
                      setMode('list');
                      setEditingId(null);
                      setForm(emptyForm());
                      setFormError(null);
                    }}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      (pressed || saving) && styles.actionPressed,
                    ]}
                    onPress={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={MINIMAL_UI.onDark} size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Salvar</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          ) : null}
          </View>
          <CloseFooterBar onPress={onClose} accessibilityLabel="Fechar locais favoritos" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: CLOSE_FOOTER_DOCK_HEIGHT,
  },
  sheet: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    maxHeight: '86%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    paddingTop: 16,
    paddingHorizontal: 0,
    overflow: 'hidden',
    gap: 12,
    ...boxShadowStyle({
      color: '#0F172A',
      offsetY: 8,
      blurRadius: 24,
      opacity: 0.08,
      elevation: 4,
    }),
  },
  sheetBody: {
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minWidth: 0,
    paddingHorizontal: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  headerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: MINIMAL_UI.background,
  },
  headerActionText: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    color: MINIMAL_UI.blueDark,
    flex: 1,
    minWidth: 0,
  },
  centerBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  hintText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  warningText: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    lineHeight: 17,
  },
  errorText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    maxHeight: 420,
    width: '100%',
    minWidth: 0,
  },
  listContent: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    width: '100%',
    minWidth: 0,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 0,
  },
  optionInactive: {
    opacity: 0.55,
  },
  optionPressed: {
    borderColor: MINIMAL_UI.accent,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  optionTitle: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '700',
  },
  optionMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  optionCapacity: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  unlimitedHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  optionInactiveLabel: {
    color: MINIMAL_UI.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  optionActions: {
    justifyContent: 'center',
    gap: 6,
    flexShrink: 0,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.background,
  },
  formScroll: {
    maxHeight: 520,
    width: '100%',
    minWidth: 0,
  },
  formContent: {
    gap: 8,
    paddingBottom: 4,
  },
  fieldLabel: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    color: MINIMAL_UI.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  localCapacityRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    width: '100%',
    minWidth: 0,
  },
  localColumn: {
    flex: 1,
    minWidth: 0,
  },
  nameGeoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
  },
  geoTargetButton: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.rowHover,
    flexShrink: 0,
  },
  geoTargetButtonPressed: {
    opacity: 0.85,
  },
  capacityColumn: {
    width: 112,
    flexShrink: 0,
    gap: 6,
  },
  capacityInput: {
    width: '100%',
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  cepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cepInput: {
    flex: 1,
    minWidth: 0,
  },
  lookupButton: {
    minWidth: 78,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.rowHover,
    flexShrink: 0,
  },
  lookupButtonPressed: {
    opacity: 0.85,
  },
  lookupButtonText: {
    color: MINIMAL_UI.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  coordRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    minWidth: 0,
  },
  coordField: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  switchLabel: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
    width: '100%',
    minWidth: 0,
  },
  formActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  primaryButton: {
    minWidth: 92,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.blueDark,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    minWidth: 92,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: MINIMAL_UI.background,
  },
  secondaryButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    minWidth: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: MINIMAL_UI.background,
  },
  deleteButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
  },
  actionPressed: {
    opacity: 0.85,
  },
});
