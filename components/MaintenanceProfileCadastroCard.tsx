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
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
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
  minimal?: boolean;
};

const ACCENT = '#3A96DD';

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

function SectionHeading({ children, minimal }: { children: string; minimal: boolean }) {
  return minimal ? (
    <Text style={styles.sectionLabelMinimal}>{children}</Text>
  ) : (
    <SectionLabel variant="maintenance">{children}</SectionLabel>
  );
}

export function MaintenanceProfileCadastroCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
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
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <Text style={minimal ? styles.sectionTitle : maintenancePanelStyles.panelTitle}>
        Cadastro de Usuário
      </Text>
      {!minimal ? <View style={maintenancePanelStyles.panelSubtitleSpacer} /> : null}

      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}
      {statusMessage ? (
        <Text style={[styles.successText, minimal && styles.successTextMinimal]}>
          {statusMessage}
        </Text>
      ) : null}

      <SectionHeading minimal={minimal}>Buscar usuário</SectionHeading>
      <View style={[styles.searchRow, minimal && styles.searchRowMinimal]}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Nome (mín. 2 letras)"
          placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
          style={[styles.searchInput, minimal && styles.searchInputMinimal]}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[
            styles.searchClearButton,
            minimal && styles.searchClearButtonMinimal,
            searchQuery.length === 0 && styles.searchClearButtonDisabled,
          ]}
          onPress={clearSearchQuery}
          disabled={searchQuery.length === 0 || deletingUser || savingCep}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Limpar busca de usuário"
        >
          <MaterialIcons name="close" size={20} color={minimal ? MINIMAL_UI.icon : '#94A3B8'} />
        </TouchableOpacity>
      </View>

      {searching ? <CardLoadingState lines={2} compact minimal={minimal} /> : null}

      {searchQuery.trim().length >= 2 && !searching ? (
        <ScrollView
          horizontal={false}
          style={[styles.resultsScroll, minimal && styles.resultsScrollMinimal]}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {(searchResults ?? []).length ? (
            (searchResults ?? []).map((option) => {
              const isSelected = option.id === selectedProfileId;

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.resultRow,
                    minimal && styles.resultRowMinimal,
                    isSelected && styles.resultRowSelected,
                    minimal && isSelected && styles.resultRowSelectedMinimal,
                  ]}
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
                  <Text style={[styles.resultName, minimal && styles.resultNameMinimal]}>
                    {formatShortName(option.fullName)}
                  </Text>
                  <Text style={[styles.resultMeta, minimal && styles.resultMetaMinimal]}>
                    {[option.phone, option.memberCode].filter(Boolean).join(' · ') || option.fullName}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
              Nenhum perfil encontrado.
            </Text>
          )}
        </ScrollView>
      ) : (
        <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
          Digite pelo menos 2 letras para buscar.
        </Text>
      )}

      {loadingProfile ? (
        <CardLoadingState lines={4} minimal={minimal} />
      ) : profile ? (
        <ScrollView
          style={[styles.detailScroll, minimal && styles.detailScrollMinimal]}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.selectedTitle, minimal && styles.selectedTitleMinimal]}>
            {selectedPickerOption?.fullName ?? profile.full_name ?? 'Usuário selecionado'}
          </Text>

          <Text style={[styles.groupTitle, minimal && styles.groupTitleMinimal]}>
            Dados pessoais
          </Text>
          {personalFields.map((field) => (
            <View key={field.key} style={[styles.fieldRow, minimal && styles.fieldRowMinimal]}>
              <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>
                {field.label}
              </Text>
              <Text style={[styles.fieldValue, minimal && styles.fieldValueMinimal]}>
                {formatDisplayValue(field.key, profile[field.key])}
              </Text>
            </View>
          ))}

          <Text style={[styles.groupTitle, minimal && styles.groupTitleMinimal]}>Endereço</Text>

          <View style={[styles.addressFormBlock, minimal && styles.addressFormBlockMinimal]}>
            <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>CEP</Text>
            <View style={styles.cepInputWrap}>
              <TextInput
                value={cepDraft}
                onChangeText={handleCepDraftChange}
                placeholder="00000-000"
                placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
                keyboardType="number-pad"
                style={[
                  styles.addressInput,
                  minimal && styles.addressInputMinimal,
                  cepDraft.length > 0 && styles.addressInputWithClear,
                ]}
              />
              {cepDraft.length > 0 ? (
                <TouchableOpacity
                  style={styles.cepClearButton}
                  onPress={clearCepDraft}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar CEP"
                >
                  <MaterialIcons name="close" size={18} color={minimal ? MINIMAL_UI.icon : '#94A3B8'} />
                </TouchableOpacity>
              ) : null}
            </View>

            {shouldPreviewCepAddress && loadingCepPreview ? (
              <ActivityIndicator
                color={minimal ? MINIMAL_UI.accent : ACCENT}
                size="small"
                style={styles.previewLoader}
              />
            ) : shouldPreviewCepAddress && cepPreview ? (
              <View style={[styles.cepPreviewBox, minimal && styles.cepPreviewBoxMinimal]}>
                <Text style={[styles.cepPreviewTitle, minimal && styles.cepPreviewTitleMinimal]}>
                  Endereço que será gravado:
                </Text>
                <Text style={[styles.cepPreviewText, minimal && styles.cepPreviewTextMinimal]}>
                  {[cepPreview.street, cepPreview.neighborhood, cepPreview.city, cepPreview.state]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>Número</Text>
            <TextInput
              value={addressNumberDraft}
              onChangeText={setAddressNumberDraft}
              placeholder="Ex.: 120, s/n"
              placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
              style={[styles.addressInput, minimal && styles.addressInputMinimal]}
              autoCapitalize="characters"
            />

            <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>
              Complemento
            </Text>
            <TextInput
              value={addressComplementDraft}
              onChangeText={setAddressComplementDraft}
              placeholder="Apto, bloco, casa…"
              placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
              style={[styles.addressInput, minimal && styles.addressInputMinimal]}
            />

            <TouchableOpacity
              style={[
                styles.saveCepButton,
                minimal && styles.saveCepButtonMinimal,
                savingCep && styles.saveCepButtonDisabled,
              ]}
              onPress={() => void handleSaveCep()}
              disabled={savingCep}
              activeOpacity={0.85}
            >
              {savingCep ? (
                <ActivityIndicator color={minimal ? MINIMAL_UI.onDark : '#0F172A'} size="small" />
              ) : (
                <>
                  <FontAwesome
                    name="map-marker"
                    size={14}
                    color={minimal ? MINIMAL_UI.onDark : '#0F172A'}
                  />
                  <Text style={[styles.saveCepButtonText, minimal && styles.saveCepButtonTextMinimal]}>
                    Salvar CEP e endereço
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {addressReadOnlyFields.map((field) => (
            <View key={field.key} style={[styles.fieldRow, minimal && styles.fieldRowMinimal]}>
              <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>
                {field.label}
              </Text>
              <Text style={[styles.fieldValue, minimal && styles.fieldValueMinimal]}>
                {formatDisplayValue(field.key, profile[field.key])}
              </Text>
            </View>
          ))}

          <View style={[styles.fieldRow, minimal && styles.fieldRowMinimal]}>
            <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>
              Senha de acesso (PIN)
            </Text>
            <Text style={[styles.fieldValue, minimal && styles.fieldValueMinimal]}>
              {formatAccessPinDisplay(profile.access_pin ?? selectedPickerOption?.accessPin)}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.deleteUserButton,
              minimal && styles.deleteUserButtonMinimal,
              (deletingUser || savingCep) && styles.deleteUserButtonDisabled,
            ]}
            onPress={() => void handleDeleteUser()}
            disabled={deletingUser || savingCep}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Excluir usuário selecionado"
          >
            {deletingUser ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <>
                <FontAwesome name="trash-o" size={14} color="#DC2626" />
                <Text style={styles.deleteUserButtonText}>Excluir usuário</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : selectedProfileId ? (
        <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
          Perfil não carregado.
        </Text>
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
    color: '#3A96DD',
    fontSize: 17,
    fontWeight: '800',
  },
  panelSubtitle: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
  },
  sectionLabel: {
    color: '#3A96DD',
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
    color: '#3A96DD',
    backgroundColor: '#FFFFFF',
  },
  searchClearButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.45)',
    backgroundColor: '#FFFFFF',
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
    borderColor: 'rgba(148, 163, 184, 0.35)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  resultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: '#FFFFFF',
  },
  resultRowSelected: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: '#00008B',
  },
  resultName: {
    color: '#3A96DD',
    fontWeight: '700',
    fontSize: 14,
  },
  resultMeta: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    marginTop: 2,
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
    color: 'rgba(58, 150, 221, 0.82)',
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
    borderColor: 'rgba(191, 219, 254, 1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1E40AF',
    backgroundColor: '#FFFFFF',
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
    color: 'rgba(58, 150, 221, 0.82)',
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
    borderColor: '#DC2626',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
  },
  deleteUserButtonDisabled: {
    opacity: 0.65,
  },
  deleteUserButtonText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 13,
  },
  panelMinimal: {
    ...CONTAIN_WIDTH,
    paddingHorizontal: 0,
    paddingVertical: 4,
    borderRadius: 0,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'visible',
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    ...CONTAIN_WIDTH,
  },
  sectionLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  successTextMinimal: {
    color: '#16A34A',
  },
  searchRowMinimal: {
    ...CONTAIN_WIDTH,
  },
  searchInputMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 12,
    color: MINIMAL_UI.text,
  },
  searchClearButtonMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 12,
  },
  resultsScrollMinimal: {
    ...CONTAIN_WIDTH,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  resultRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  resultRowSelectedMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
    borderLeftColor: MINIMAL_UI.blueDark,
  },
  resultNameMinimal: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
  },
  resultMetaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  hintTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  detailScrollMinimal: {
    ...CONTAIN_WIDTH,
  },
  selectedTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  groupTitleMinimal: {
    color: MINIMAL_UI.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 13,
    fontWeight: '700',
  },
  fieldRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
  },
  fieldLabelMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  fieldValueMinimal: {
    color: MINIMAL_UI.text,
  },
  addressFormBlockMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
  },
  addressInputMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    color: MINIMAL_UI.text,
    borderRadius: 12,
  },
  cepPreviewBoxMinimal: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
  },
  cepPreviewTitleMinimal: {
    color: '#15803D',
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 12,
  },
  cepPreviewTextMinimal: {
    color: '#166534',
  },
  saveCepButtonMinimal: {
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  saveCepButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
  deleteUserButtonMinimal: {
    borderRadius: 12,
  },
});
