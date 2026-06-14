import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { PROFILE_CADASTRO_FIELD_META } from '@/lib/maintenanceProfileCadastroApi';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { formatAccessPinDisplay } from '@/lib/accessPin';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatShortName } from '@/lib/formatShortName';
import { useMaintenanceProfileCadastro } from '@/hooks/useMaintenanceProfileCadastro';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
};

const ACCENT = '#A78BFA';

const ADDRESS_READONLY_KEYS = new Set([
  'address_street',
  'address_neighborhood',
  'address_city',
  'address_state',
]);

const formatDisplayValue = (key: string, value: string | null | undefined) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return '—';
  }

  if (key === 'birth_date') {
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }

  return trimmed;
};

export function MaintenanceProfileCadastroCard({ isActive = true, panelHeight }: Props) {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searching,
    selectedProfileId,
    selectedPickerOption,
    profile,
    loadingProfile,
    cepDraft,
    handleCepDraftChange,
    clearCepDraft,
    shouldPreviewCepAddress,
    addressNumberDraft,
    setAddressNumberDraft,
    addressComplementDraft,
    setAddressComplementDraft,
    savingCep,
    deletingUser,
    cepPreview,
    loadingCepPreview,
    error,
    statusMessage,
    selectProfile,
    saveCepAndAddress,
    deleteSelectedUser,
    clearSearchQuery,
  } = useMaintenanceProfileCadastro(isActive);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  const personalFields = useMemo(
    () => PROFILE_CADASTRO_FIELD_META.filter((field) => field.section === 'pessoal'),
    []
  );

  const addressReadOnlyFields = useMemo(
    () =>
      PROFILE_CADASTRO_FIELD_META.filter(
        (field) => field.section === 'endereco' && ADDRESS_READONLY_KEYS.has(field.key)
      ),
    []
  );

  const handleSaveCep = async () => {
    const result = await saveCepAndAddress();

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Cadastro de usuário',
      text2: result.message,
      visibilityTime: 3500,
    });
  };

  const handleDeleteUser = async () => {
    if (!profile) {
      return;
    }

    const displayName = selectedPickerOption?.fullName ?? profile.full_name ?? 'este usuário';
    const confirmed = await confirmDialog(
      'Excluir usuário',
      `Deseja excluir permanentemente ${displayName}? Esta ação remove o perfil e todas as referências dele no sistema (membros, inscrições, RD, pedidos pastorais, veículos, etc.) e não pode ser desfeita.`,
      'Excluir',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    const result = await deleteSelectedUser();

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Cadastro de usuário',
      text2: result.message,
      visibilityTime: result.success ? 3500 : 5000,
    });
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Cadastro de Usuário</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {statusMessage ? <Text style={styles.successText}>{statusMessage}</Text> : null}

      <SectionLabel variant="maintenance">Buscar usuário</SectionLabel>
      <View style={styles.searchRow}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Nome (mín. 2 letras)"
          placeholderTextColor="#64748B"
          style={styles.searchInput}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[
            styles.searchClearButton,
            searchQuery.length === 0 && styles.searchClearButtonDisabled,
          ]}
          onPress={clearSearchQuery}
          disabled={searchQuery.length === 0 || deletingUser || savingCep}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Limpar busca de usuário"
        >
          <MaterialIcons name="close" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {searching ? <CardLoadingState lines={2} compact /> : null}

      {searchQuery.trim().length >= 2 && !searching ? (
        <ScrollView
          horizontal={false}
          style={styles.resultsScroll}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {(searchResults ?? []).length ? (
            (searchResults ?? []).map((option) => {
              const isSelected = option.id === selectedProfileId;

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.resultRow, isSelected && styles.resultRowSelected]}
                  onPress={() => void selectProfile(option.id)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isSelected }}
                  accessibilityLabel={
                    isSelected
                      ? `Ocultar dados de ${formatShortName(option.fullName)}`
                      : `Exibir dados de ${formatShortName(option.fullName)}`
                  }
                >
                  <Text style={styles.resultName}>{formatShortName(option.fullName)}</Text>
                  <Text style={styles.resultMeta}>
                    {[option.phone, option.memberCode].filter(Boolean).join(' · ') || option.fullName}
                  </Text>
                  <Text style={styles.resultPin}>
                    PIN: {formatAccessPinDisplay(option.accessPin)}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.hintText}>Nenhum perfil encontrado.</Text>
          )}
        </ScrollView>
      ) : (
        <Text style={styles.hintText}>Digite pelo menos 2 letras para buscar.</Text>
      )}

      {loadingProfile ? (
        <CardLoadingState lines={4} />
      ) : profile ? (
        <ScrollView style={styles.detailScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <Text style={styles.selectedTitle}>
            {selectedPickerOption?.fullName ?? profile.full_name ?? 'Usuário selecionado'}
          </Text>

          <Text style={styles.groupTitle}>Dados pessoais</Text>
          {personalFields.map((field) => (
            <View key={field.key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Text style={styles.fieldValue}>
                {formatDisplayValue(field.key, profile[field.key])}
              </Text>
            </View>
          ))}

          <Text style={styles.groupTitle}>Endereço</Text>

          <View style={styles.addressFormBlock}>
            <Text style={styles.fieldLabel}>CEP</Text>
            <View style={styles.cepInputWrap}>
              <TextInput
                value={cepDraft}
                onChangeText={handleCepDraftChange}
                placeholder="00000-000"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                style={[styles.addressInput, cepDraft.length > 0 && styles.addressInputWithClear]}
              />
              {cepDraft.length > 0 ? (
                <TouchableOpacity
                  style={styles.cepClearButton}
                  onPress={clearCepDraft}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar CEP"
                >
                  <MaterialIcons name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {shouldPreviewCepAddress && loadingCepPreview ? (
              <ActivityIndicator color={ACCENT} size="small" style={styles.previewLoader} />
            ) : shouldPreviewCepAddress && cepPreview ? (
              <View style={styles.cepPreviewBox}>
                <Text style={styles.cepPreviewTitle}>Endereço que será gravado:</Text>
                <Text style={styles.cepPreviewText}>
                  {[cepPreview.street, cepPreview.neighborhood, cepPreview.city, cepPreview.state]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Número</Text>
            <TextInput
              value={addressNumberDraft}
              onChangeText={setAddressNumberDraft}
              placeholder="Ex.: 120, s/n"
              placeholderTextColor="#64748B"
              style={styles.addressInput}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Complemento</Text>
            <TextInput
              value={addressComplementDraft}
              onChangeText={setAddressComplementDraft}
              placeholder="Apto, bloco, casa…"
              placeholderTextColor="#64748B"
              style={styles.addressInput}
            />

            <TouchableOpacity
              style={[styles.saveCepButton, savingCep && styles.saveCepButtonDisabled]}
              onPress={() => void handleSaveCep()}
              disabled={savingCep}
              activeOpacity={0.85}
            >
              {savingCep ? (
                <ActivityIndicator color="#0F172A" size="small" />
              ) : (
                <>
                  <FontAwesome name="map-marker" size={14} color="#0F172A" />
                  <Text style={styles.saveCepButtonText}>Salvar CEP e endereço</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {addressReadOnlyFields.map((field) => (
            <View key={field.key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Text style={styles.fieldValue}>
                {formatDisplayValue(field.key, profile[field.key])}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.deleteUserButton, (deletingUser || savingCep) && styles.deleteUserButtonDisabled]}
            onPress={() => void handleDeleteUser()}
            disabled={deletingUser || savingCep}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Excluir usuário selecionado"
          >
            {deletingUser ? (
              <ActivityIndicator color="#FECACA" size="small" />
            ) : (
              <>
                <FontAwesome name="trash-o" size={14} color="#FECACA" />
                <Text style={styles.deleteUserButtonText}>Excluir usuário</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : selectedProfileId ? (
        <Text style={styles.hintText}>Perfil não carregado.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  panelTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  panelSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
  },
  sectionLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  searchClearButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchClearButtonDisabled: {
    opacity: 0.45,
  },
  inlineLoader: {
    marginVertical: 4,
  },
  resultsScroll: {
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  resultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  resultRowSelected: {
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
  },
  resultName: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
  resultMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  resultPin: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  detailLoader: {
    marginTop: 12,
  },
  detailScroll: {
    flex: 1,
    minHeight: 0,
    marginTop: 4,
  },
  selectedTitle: {
    color: '#E9D5FF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  groupTitle: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 4,
  },
  fieldRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
    gap: 2,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  fieldValue: {
    color: '#F1F5F9',
    fontSize: 14,
  },
  addressFormBlock: {
    gap: 8,
    paddingVertical: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167, 139, 250, 0.25)',
  },
  previewLoader: {
    alignSelf: 'flex-start',
    marginTop: -2,
  },
  cepPreviewBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.35)',
    backgroundColor: 'rgba(20, 83, 45, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  cepPreviewTitle: {
    color: '#86EFAC',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cepPreviewText: {
    color: '#DCFCE7',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  cepInputWrap: {
    position: 'relative',
  },
  addressInput: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.55)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    backgroundColor: 'rgba(30, 27, 75, 0.55)',
    fontSize: 15,
  },
  addressInputWithClear: {
    paddingRight: 40,
  },
  cepClearButton: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: ACCENT,
    paddingVertical: 12,
  },
  saveCepButtonDisabled: {
    opacity: 0.7,
  },
  saveCepButtonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
  },
  hintText: {
    color: '#64748B',
    fontSize: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
  },
  successText: {
    color: '#86EFAC',
    fontSize: 12,
  },
  deleteUserButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.55)',
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
    paddingVertical: 12,
  },
  deleteUserButtonDisabled: {
    opacity: 0.65,
  },
  deleteUserButtonText: {
    color: '#FECACA',
    fontWeight: '800',
    fontSize: 13,
  },
});
