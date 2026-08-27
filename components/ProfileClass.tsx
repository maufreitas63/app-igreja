import {
  SECTION_TITLES,
  type ProfileFieldRow,
  type ProfileRecord,
  type ProfileSection,
  type ProfileSectionKey,
  type ProfileVehicle,
} from '@/lib/manageProfile/shared';
import { PROFILE_CLASS_ICON_COLOR, profileClassStyles } from '@/lib/manageProfile/profileClassStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { BiometricUnlockSettingsCard } from '@/components/BiometricUnlockSettingsCard';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { Image } from 'expo-image';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type ProfileClassProps = {
  embedded?: boolean;
  screenMode: 'FORM' | 'CAMERA';
  insetsBottom: number;
  scrollRef: React.RefObject<ScrollView | null>;
  cameraRef: React.RefObject<CameraView | null>;
  pictureSize: string | null;
  isCameraReady: boolean;
  onCameraReady: () => void | Promise<void>;
  onCancelCamera: () => void;
  onCaptureSelfie: () => void | Promise<void>;
  onCameraMountError: (message: string) => void;
  isOnboardingFlow: boolean;
  isRecoveryAccessPinFlow: boolean;
  profile: ProfileRecord | null;
  loading: boolean;
  ghostModeActive: boolean;
  columnAccessLoading: boolean;
  profileSections: ProfileSection[];
  expandedSections: Record<ProfileSectionKey, boolean>;
  toggleSection: (sectionKey: ProfileSectionKey) => void;
  selfiePreviewUrl: string | null;
  selfiePreviewKey: number;
  isSelfieLoading: boolean;
  displayName: string;
  displayPhone: string;
  displayBirth: string;
  displayFamily: string;
  lgpdModuleActive: boolean;
  isLgpdPending: boolean;
  onOpenLgpdScreen: () => void;
  onOpenSelfieAction: () => void;
  showAccessPinSection: boolean;
  accessPinSectionExpanded: boolean;
  toggleAccessPinSection: () => void;
  onAccessPinSectionLayout: (y: number) => void;
  accessPinFormContent: React.ReactNode;
  editingFieldRow: ProfileFieldRow | null;
  editingPlaceholder: string;
  editingValue: string;
  saving: boolean;
  lookingUpCep: boolean;
  onEditingValueChange: (value: string) => void;
  onSaveField: () => void;
  onCancelEditing: () => void;
  onStartEditingField: (field: ProfileFieldRow) => void;
  vehicles: ProfileVehicle[];
  loadingVehicles: boolean;
  isVehicleEditorVisible: boolean;
  editingVehicle: ProfileVehicle | null;
  vehicleForm: { placa: string; marca: string; modelo: string; cor: string };
  onVehicleFormChange: (patch: Partial<ProfileClassProps['vehicleForm']>) => void;
  savingVehicle: boolean;
  deletingVehicleId: string | null;
  onSaveVehicle: () => void;
  onCancelVehicleEditing: () => void;
  onStartEditingVehicle: (vehicle: ProfileVehicle) => void;
  onDeleteVehicle: (vehicle: ProfileVehicle) => void;
  onStartNewVehicle: () => void;
  accessPinSectionExpandedForScroll: boolean;
  onLeaveScreen: () => void;
  showOnboardingHint: boolean;
};

/** UI pura de Dados Cadastrais — tema minimal vigilance_scales. */
export function ProfileClass({
  embedded = false,
  screenMode,
  insetsBottom,
  scrollRef,
  cameraRef,
  pictureSize,
  isCameraReady,
  onCameraReady,
  onCancelCamera,
  onCaptureSelfie,
  onCameraMountError,
  isRecoveryAccessPinFlow,
  profile,
  loading,
  ghostModeActive,
  columnAccessLoading,
  profileSections,
  expandedSections,
  toggleSection,
  selfiePreviewUrl,
  selfiePreviewKey,
  isSelfieLoading,
  displayName,
  displayPhone,
  displayBirth,
  displayFamily,
  lgpdModuleActive,
  isLgpdPending,
  onOpenLgpdScreen,
  onOpenSelfieAction,
  showAccessPinSection,
  accessPinSectionExpanded,
  toggleAccessPinSection,
  onAccessPinSectionLayout,
  accessPinFormContent,
  editingFieldRow,
  editingPlaceholder,
  editingValue,
  saving,
  lookingUpCep,
  onEditingValueChange,
  onSaveField,
  onCancelEditing,
  onStartEditingField,
  vehicles,
  loadingVehicles,
  isVehicleEditorVisible,
  editingVehicle,
  vehicleForm,
  onVehicleFormChange,
  savingVehicle,
  deletingVehicleId,
  onSaveVehicle,
  onCancelVehicleEditing,
  onStartEditingVehicle,
  onDeleteVehicle,
  onStartNewVehicle,
  accessPinSectionExpandedForScroll,
  onLeaveScreen,
  showOnboardingHint,
}: ProfileClassProps) {
  const RootWrapper = embedded ? View : SafeAreaView;
  const rootWrapperProps = embedded
    ? { style: profileClassStyles.container }
    : { style: profileClassStyles.container, edges: ['top', 'left', 'right'] as const };

  if (screenMode === 'CAMERA') {
    const CameraWrapper = embedded ? View : SafeAreaView;
    const cameraWrapperProps = embedded
      ? { style: profileClassStyles.cameraScreen }
      : { style: profileClassStyles.cameraScreen, edges: ['top', 'left', 'right', 'bottom'] as const };

    return (
      <CameraWrapper {...cameraWrapperProps}>
        <View style={profileClassStyles.cameraStage}>
          <Text style={profileClassStyles.cameraHint}>Afaste um pouco o rosto e centralize-o dentro do quadro.</Text>
          <View style={profileClassStyles.cameraFrame}>
            <CameraView
              style={[profileClassStyles.cameraView, { transform: [{ scaleX: -1 }] }]}
              ref={cameraRef}
              facing="front"
              mirror={false}
              zoom={0}
              pictureSize={pictureSize ?? undefined}
              {...(Platform.OS === 'android' ? { ratio: '4:3' as const } : {})}
              onCameraReady={() => void onCameraReady()}
              onMountError={(event) => {
                onCameraMountError(event.message || 'Não foi possível abrir a câmera.');
              }}
            />
          </View>
        </View>
        <View style={profileClassStyles.cameraActions}>
          <TouchableOpacity style={profileClassStyles.cameraSecondaryButton} onPress={onCancelCamera}>
            <Text style={profileClassStyles.cameraSecondaryButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[profileClassStyles.cameraPrimaryButton, !isCameraReady && profileClassStyles.disabledButton]}
            disabled={!isCameraReady}
            onPress={() => void onCaptureSelfie()}
          >
            <Text style={profileClassStyles.cameraPrimaryButtonText}>
              {isCameraReady ? 'Capturar Selfie' : 'Preparando câmera...'}
            </Text>
          </TouchableOpacity>
        </View>
      </CameraWrapper>
    );
  }

  return (
    <RootWrapper {...rootWrapperProps}>
      <View style={profileClassStyles.header}>
        <Text style={profileClassStyles.titleCentered}>Dados Cadastrais</Text>
        {showOnboardingHint ? (
          <Text style={profileClassStyles.onboardingHint}>
            Complete as informações faltantes para finalizar seu cadastro.
          </Text>
        ) : null}
        {isRecoveryAccessPinFlow ? (
          <Text style={profileClassStyles.onboardingHint}>
            Abra a seção Senha de acesso abaixo, confira a senha enviada por e-mail e defina a nova
            senha de 4 dígitos.
          </Text>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={profileClassStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={!accessPinSectionExpandedForScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={profileClassStyles.selfieCard}>
          <View style={profileClassStyles.selfieRow}>
            {selfiePreviewUrl ? (
              <View style={profileClassStyles.selfieFrame}>
                {isSelfieLoading ? (
                  <ActivityIndicator color={PROFILE_CLASS_ICON_COLOR} />
                ) : (
                  <Image
                    key={`${selfiePreviewKey}:${selfiePreviewUrl}`}
                    source={{ uri: selfiePreviewUrl }}
                    style={profileClassStyles.selfieImage}
                    contentFit="contain"
                    cachePolicy="none"
                  />
                )}
              </View>
            ) : null}
            <View style={profileClassStyles.selfieAside}>
              <View style={profileClassStyles.selfieSummary}>
                <Text style={profileClassStyles.summaryName}>{displayName}</Text>
                <Text style={profileClassStyles.summaryMeta}>{displayPhone}</Text>
                <Text style={profileClassStyles.summaryMeta}>{displayBirth}</Text>
                <Text style={profileClassStyles.summaryBadge}>{displayFamily}</Text>
              </View>
              {lgpdModuleActive && isLgpdPending ? (
                <TouchableOpacity
                  style={profileClassStyles.lgpdActionButton}
                  onPress={onOpenLgpdScreen}
                  disabled={loading || !profile}
                >
                  <Text style={profileClassStyles.lgpdActionButtonText}>LGPD</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={[profileClassStyles.selfieActionButton, isSelfieLoading && profileClassStyles.disabledButton]}
            onPress={onOpenSelfieAction}
            disabled={isSelfieLoading || !profile}
          >
            <Text style={profileClassStyles.selfieActionText}>
              {profile?.selfie_url ? 'Atualizar Selfie' : 'Tirar Selfie'}
            </Text>
          </TouchableOpacity>
        </View>

        {showAccessPinSection ? (
          <View
            style={[
              profileClassStyles.sectionCard,
              isRecoveryAccessPinFlow && profileClassStyles.recoveryAccessPinSectionCard,
            ]}
            onLayout={(event) => onAccessPinSectionLayout(event.nativeEvent.layout.y)}
          >
            <TouchableOpacity
              style={profileClassStyles.sectionHeader}
              onPress={toggleAccessPinSection}
              activeOpacity={isRecoveryAccessPinFlow ? 1 : 0.85}
              disabled={isRecoveryAccessPinFlow}
            >
              <View>
                <Text style={profileClassStyles.sectionTitle}>Senha de acesso</Text>
                <Text style={profileClassStyles.sectionMeta}>
                  {isRecoveryAccessPinFlow
                    ? 'Informe sua nova senha de 4 dígitos'
                    : 'Alterar senha de 4 dígitos'}
                </Text>
              </View>
              {!isRecoveryAccessPinFlow ? (
                <MaterialIcons
                  name={accessPinSectionExpanded ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={PROFILE_CLASS_ICON_COLOR}
                />
              ) : null}
            </TouchableOpacity>

            {accessPinSectionExpanded ? (
              <View style={profileClassStyles.accessPinSectionBody}>
                <Text style={profileClassStyles.accessPinHint} numberOfLines={4}>
                  {isRecoveryAccessPinFlow
                    ? 'A senha enviada por e-mail aparece abaixo para conferência (somente leitura). Informe a nova senha e confirme nos dois campos.'
                    : 'Defina uma senha de 4 dígitos para entrar no app. Informe a senha atual para alterá-la.'}
                </Text>

                {accessPinFormContent}
              </View>
            ) : null}
          </View>
        ) : null}

        {!isRecoveryAccessPinFlow ? (
          <BiometricUnlockSettingsCard iconColor={PROFILE_CLASS_ICON_COLOR} />
        ) : null}

        {loading ? (
          <Text style={profileClassStyles.emptyText}>Carregando perfil...</Text>
        ) : !profile ? (
          <Text style={profileClassStyles.emptyText}>
            {ghostModeActive
              ? 'Perfil simulado não encontrado. Reexecute scripts/access-control-ghost-mode.sql no Supabase e recarregue o app.'
              : 'Perfil não encontrado.'}
          </Text>
        ) : columnAccessLoading ? (
          <Text style={profileClassStyles.emptyText}>Carregando permissões dos campos...</Text>
        ) : profileSections.length === 0 ? (
          <Text style={profileClassStyles.emptyText}>
            {ghostModeActive
              ? 'Nenhum campo visível para este usuário simulado com as permissões atuais.'
              : 'Você não tem permissão para visualizar campos deste perfil.'}
          </Text>
        ) : (
          <>
            {profileSections.map((section) => {
              const isExpanded = expandedSections[section.key];

              return (
                <View key={section.key} style={profileClassStyles.sectionCard}>
                  <TouchableOpacity
                    style={profileClassStyles.sectionHeader}
                    onPress={() => toggleSection(section.key)}
                    activeOpacity={0.85}
                  >
                    <View>
                      <Text style={profileClassStyles.sectionTitle}>{section.title}</Text>
                      <Text style={profileClassStyles.sectionMeta}>{section.fields.length} campo(s)</Text>
                    </View>
                    <MaterialIcons
                      name={isExpanded ? 'expand-less' : 'expand-more'}
                      size={22}
                      color={PROFILE_CLASS_ICON_COLOR}
                    />
                  </TouchableOpacity>

                  {isExpanded ? (
                    <View style={profileClassStyles.sectionFields}>
                      {section.fields.map((field) => {
                        const isEditing = editingFieldRow?.key === field.key;

                        return (
                          <View
                            key={field.key}
                            style={[
                              profileClassStyles.fieldRow,
                              isEditing && profileClassStyles.fieldRowEditing,
                            ]}
                          >
                            <View style={profileClassStyles.fieldInfoRow}>
                              <Text style={profileClassStyles.fieldLabel} numberOfLines={3}>
                                {field.label}
                              </Text>
                              {isEditing ? (
                                <View style={profileClassStyles.fieldInlineEditor}>
                                  <TextInput
                                    style={profileClassStyles.fieldValueInput}
                                    placeholder={editingPlaceholder}
                                    placeholderTextColor={MINIMAL_UI.textMuted}
                                    value={editingValue}
                                    editable={!saving && !lookingUpCep}
                                    autoFocus
                                    keyboardType={
                                      editingFieldRow.kind === 'phone'
                                      || editingFieldRow.kind === 'date'
                                      || editingFieldRow.key === 'cep'
                                        ? 'number-pad'
                                        : 'default'
                                    }
                                    maxLength={
                                      editingFieldRow.kind === 'date'
                                        ? 10
                                        : editingFieldRow.key === 'cep'
                                          ? 9
                                          : editingFieldRow.kind === 'phone'
                                            ? 15
                                            : undefined
                                    }
                                    multiline={editingFieldRow.kind === 'url'}
                                    onChangeText={onEditingValueChange}
                                    onSubmitEditing={() => {
                                      if (!saving && !lookingUpCep) {
                                        onSaveField();
                                      }
                                    }}
                                    returnKeyType="done"
                                  />
                                  {lookingUpCep ? (
                                    <View style={profileClassStyles.cepLookupRowInline}>
                                      <ActivityIndicator color={PROFILE_CLASS_ICON_COLOR} size="small" />
                                      <Text style={profileClassStyles.cepLookupText}>CEP…</Text>
                                    </View>
                                  ) : null}
                                </View>
                              ) : (
                                <Text style={profileClassStyles.fieldValue} numberOfLines={6}>
                                  {field.value}
                                </Text>
                              )}
                            </View>
                            {!field.readOnly ? (
                              <View
                                style={[
                                  profileClassStyles.actionsRow,
                                  isEditing && profileClassStyles.actionsRowEditing,
                                ]}
                              >
                                {isEditing ? (
                                  <>
                                    <TouchableOpacity
                                      style={[
                                        profileClassStyles.inlineSaveButton,
                                        (saving || lookingUpCep) && profileClassStyles.disabledButton,
                                      ]}
                                      onPress={onSaveField}
                                      disabled={saving || lookingUpCep}
                                      accessibilityLabel="Salvar campo"
                                    >
                                      {saving ? (
                                        <ActivityIndicator color={MINIMAL_UI.onDark} size="small" />
                                      ) : (
                                        <MaterialIcons name="check" size={18} color={MINIMAL_UI.onDark} />
                                      )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={[
                                        profileClassStyles.inlineCancelButton,
                                        saving && profileClassStyles.disabledButton,
                                      ]}
                                      onPress={onCancelEditing}
                                      disabled={saving}
                                      accessibilityLabel="Cancelar edição"
                                    >
                                      <MaterialIcons name="close" size={18} color={MINIMAL_UI.blueDark} />
                                    </TouchableOpacity>
                                  </>
                                ) : (
                                  <TouchableOpacity
                                    style={profileClassStyles.editButton}
                                    onPress={() => onStartEditingField(field)}
                                    accessibilityLabel={`Editar ${field.label}`}
                                  >
                                    <MaterialIcons name="edit" size={18} color={MINIMAL_UI.onDark} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}

            <View style={profileClassStyles.sectionCard}>
              <TouchableOpacity
                style={profileClassStyles.sectionHeader}
                onPress={() => toggleSection('vehicles')}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={profileClassStyles.sectionTitle}>{SECTION_TITLES.vehicles}</Text>
                  <Text style={profileClassStyles.sectionMeta}>
                    {vehicles.length} veículo(s)
                  </Text>
                </View>
                <MaterialIcons
                  name={expandedSections.vehicles ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={PROFILE_CLASS_ICON_COLOR}
                />
              </TouchableOpacity>

              {expandedSections.vehicles ? (
                <>
                  {isVehicleEditorVisible ? (
                    <View style={profileClassStyles.vehicleEditor}>
                      <Text style={profileClassStyles.vehicleEditorTitle}>
                        {editingVehicle ? 'Editar veículo' : 'Cadastrar novo veículo'}
                      </Text>
                      <View style={profileClassStyles.vehicleFormRow}>
                        <Text style={profileClassStyles.vehicleFormLabel}>Placa</Text>
                        <TextInput
                          style={[profileClassStyles.input, profileClassStyles.vehicleFormInput]}
                          placeholder="ABC1D23"
                          placeholderTextColor="#64748b"
                          value={vehicleForm.placa}
                          onChangeText={(text) => onVehicleFormChange({ placa: text })}
                          autoCapitalize="characters"
                        />
                      </View>
                      <View style={profileClassStyles.vehicleFormRow}>
                        <Text style={profileClassStyles.vehicleFormLabel}>Marca</Text>
                        <TextInput
                          style={[profileClassStyles.input, profileClassStyles.vehicleFormInput]}
                          placeholder="Marca"
                          placeholderTextColor="#64748b"
                          value={vehicleForm.marca}
                          onChangeText={(text) => onVehicleFormChange({ marca: text })}
                        />
                      </View>
                      <View style={profileClassStyles.vehicleFormRow}>
                        <Text style={profileClassStyles.vehicleFormLabel}>Modelo</Text>
                        <TextInput
                          style={[profileClassStyles.input, profileClassStyles.vehicleFormInput]}
                          placeholder="Modelo"
                          placeholderTextColor="#64748b"
                          value={vehicleForm.modelo}
                          onChangeText={(text) => onVehicleFormChange({ modelo: text })}
                        />
                      </View>
                      <View style={profileClassStyles.vehicleFormRow}>
                        <Text style={profileClassStyles.vehicleFormLabel}>Cor</Text>
                        <TextInput
                          style={[profileClassStyles.input, profileClassStyles.vehicleFormInput]}
                          placeholder="Cor"
                          placeholderTextColor="#64748b"
                          value={vehicleForm.cor}
                          onChangeText={(text) => onVehicleFormChange({ cor: text })}
                        />
                      </View>
                      <View style={profileClassStyles.editorActions}>
                        <TouchableOpacity
                          style={[profileClassStyles.saveButton, savingVehicle && profileClassStyles.disabledButton]}
                          onPress={onSaveVehicle}
                          disabled={savingVehicle}
                        >
                          <Text style={profileClassStyles.saveButtonText}>
                            {savingVehicle ? '...' : 'Salvar Veículo'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[profileClassStyles.cancelButton, savingVehicle && profileClassStyles.disabledButton]}
                          onPress={onCancelVehicleEditing}
                          disabled={savingVehicle}
                        >
                          <Text style={profileClassStyles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}

                  <View style={profileClassStyles.sectionFields}>
                    {loadingVehicles ? (
                      <Text style={profileClassStyles.emptyText}>Carregando veículos...</Text>
                    ) : vehicles.length === 0 ? (
                      <Text style={profileClassStyles.emptyText}>Nenhum veículo cadastrado para este perfil.</Text>
                    ) : (
                      vehicles.map((vehicle) => (
                        <View key={vehicle.id} style={profileClassStyles.vehicleRow}>
                          <View style={profileClassStyles.vehicleInfo}>
                            <View style={profileClassStyles.vehicleDetailRow}>
                              <Text style={profileClassStyles.vehicleDetailLabel}>Placa</Text>
                              <Text style={profileClassStyles.vehicleDetailValue}>{vehicle.placa}</Text>
                            </View>
                            <View style={profileClassStyles.vehicleDetailRow}>
                              <Text style={profileClassStyles.vehicleDetailLabel}>Marca</Text>
                              <Text style={profileClassStyles.vehicleDetailValue}>
                                {vehicle.marca?.trim() || '—'}
                              </Text>
                            </View>
                            <View style={profileClassStyles.vehicleDetailRow}>
                              <Text style={profileClassStyles.vehicleDetailLabel}>Modelo</Text>
                              <Text style={profileClassStyles.vehicleDetailValue}>
                                {vehicle.modelo?.trim() || '—'}
                              </Text>
                            </View>
                            <View style={profileClassStyles.vehicleDetailRow}>
                              <Text style={profileClassStyles.vehicleDetailLabel}>Cor</Text>
                              <Text style={profileClassStyles.vehicleDetailValue}>
                                {vehicle.cor?.trim() || '—'}
                              </Text>
                            </View>
                          </View>
                          <View style={profileClassStyles.vehicleActionsColumn}>
                            <TouchableOpacity
                              style={[
                                profileClassStyles.editButton,
                                (deletingVehicleId === vehicle.id || savingVehicle) && profileClassStyles.disabledButton,
                              ]}
                              onPress={() => onStartEditingVehicle(vehicle)}
                              disabled={deletingVehicleId === vehicle.id || savingVehicle}
                            >
                              <MaterialIcons name="edit" size={18} color={MINIMAL_UI.onDark} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                profileClassStyles.editButton,
                                (deletingVehicleId === vehicle.id || savingVehicle) && profileClassStyles.disabledButton,
                              ]}
                              onPress={() => onDeleteVehicle(vehicle)}
                              disabled={deletingVehicleId === vehicle.id || savingVehicle}
                              accessibilityRole="button"
                              accessibilityLabel={`Excluir veículo ${vehicle.placa}`}
                            >
                              {deletingVehicleId === vehicle.id ? (
                                <ActivityIndicator color={MINIMAL_UI.onDark} size="small" />
                              ) : (
                                <MaterialIcons name="delete-forever" size={18} color={MINIMAL_UI.onDark} />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>

                  <TouchableOpacity
                    style={profileClassStyles.newVehicleButton}
                    onPress={onStartNewVehicle}
                  >
                    <Text style={profileClassStyles.newVehicleButtonText}>Cadastrar novo veículo</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>

            {/* Seção Vincular a Familia — oculta temporariamente
            <View style={profileClassStyles.sectionCard}>
              <TouchableOpacity
                style={profileClassStyles.sectionHeader}
                onPress={() => toggleSection('family_link')}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={profileClassStyles.sectionTitle}>{SECTION_TITLES.family_link}</Text>
                  <Text style={profileClassStyles.sectionMeta}>
                    {searchedFamilyId
                      ? `${familyMembers.length} membro(s) · ${searchedFamilyId}`
                      : 'Busque pelo nome de um membro da família'}
                  </Text>
                </View>
                <MaterialIcons
                  name={expandedSections.family_link ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={PROFILE_CLASS_ICON_COLOR}
                />
              </TouchableOpacity>

              {expandedSections.family_link ? (
                <View style={profileClassStyles.familyLinkSection}>
                  <View style={profileClassStyles.familyFormRow}>
                    <TextInput
                      style={[profileClassStyles.input, profileClassStyles.familyFormInput]}
                      placeholder="Nome do membro da família"
                      placeholderTextColor="#64748b"
                      value={familySearchInput}
                      onChangeText={(text) => {
                        setFamilySearchInput(text);
                        setSearchedFamilyId('');
                        setSelectedFamilyMemberId(null);
                        setFamilyNameSearchResults([]);
                      }}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>

                  {searchingFamily ? (
                    <ActivityIndicator color={PROFILE_CLASS_ICON_COLOR} style={profileClassStyles.familyNameSearchLoader} />
                  ) : null}

                  {canSearchFamilyByMemberName(familySearchInput) && !searchingFamily && !searchedFamilyId ? (
                    <View style={profileClassStyles.familyNameSearchResults}>
                      {familyNameSearchResults.length ? (
                        familyNameSearchResults.map((result) => (
                          <TouchableOpacity
                            key={result.key}
                            style={profileClassStyles.familyNameSearchResultRow}
                            onPress={() => handleSelectFamilyNameSearchResult(result)}
                            activeOpacity={0.85}
                          >
                            <Text style={profileClassStyles.familyNameSearchResultName}>
                              {formatShortName(result.fullName)}
                            </Text>
                            <Text style={profileClassStyles.familyNameSearchResultMeta}>
                              {[result.familyId, result.phone].filter(Boolean).join(' · ')}
                            </Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <Text style={profileClassStyles.familyNameSearchEmpty}>
                          Nenhum membro encontrado com este nome.
                        </Text>
                      )}
                    </View>
                  ) : !searchedFamilyId ? (
                    <Text style={profileClassStyles.familyNameSearchHint}>
                      Digite pelo menos 2 letras para buscar.
                    </Text>
                  ) : null}

                  <Text style={profileClassStyles.familyMembersTitle}>Membros da família</Text>
                  {isSearchedFamilySameAsCurrent ? (
                    <Text style={profileClassStyles.familyMembersHint}>
                      Esta é a sua família atual. Não é possível solicitar vínculo com membros já
                      vinculados a você.
                    </Text>
                  ) : searchedFamilyId && familyMembers.length > 0 ? (
                    <Text style={profileClassStyles.familyMembersHint}>
                      Selecione um membro para solicitar o vínculo familiar.
                    </Text>
                  ) : null}

                  {loadingFamilyMembers ? (
                    <Text style={profileClassStyles.emptyText}>Carregando membros...</Text>
                  ) : !searchedFamilyId ? (
                    <Text style={profileClassStyles.emptyText}>
                      Selecione um membro na busca por nome para visualizar a família.
                    </Text>
                  ) : familyMembers.length === 0 ? (
                    <Text style={profileClassStyles.emptyText}>Nenhum membro cadastrado nesta família.</Text>
                  ) : (
                    familyMembers.map((member) => {
                      const isSelected = selectedFamilyMemberId === member.id;
                      const memberRowDisabled = isSearchedFamilySameAsCurrent;

                      return (
                        <TouchableOpacity
                          key={member.id}
                          style={[
                            profileClassStyles.familyMemberRow,
                            isSelected && profileClassStyles.familyMemberRowSelected,
                            memberRowDisabled && profileClassStyles.familyMemberRowDisabled,
                          ]}
                          onPress={() => {
                            if (memberRowDisabled) {
                              return;
                            }

                            setSelectedFamilyMemberId(member.id);
                          }}
                          activeOpacity={memberRowDisabled ? 1 : 0.85}
                          disabled={memberRowDisabled}
                        >
                          <View style={profileClassStyles.familyMemberInfo}>
                            <Text style={profileClassStyles.familyMemberName} numberOfLines={1}>
                              {member.full_name}
                            </Text>
                            <Text style={profileClassStyles.familyMemberMeta} numberOfLines={1}>
                              {member.relationship?.trim() || 'Parentesco não informado'}
                              {member.phone ? ` · ${member.phone}` : ''}
                            </Text>
                          </View>
                          <View
                            style={[
                              profileClassStyles.familyMemberSelector,
                              isSelected && profileClassStyles.familyMemberSelectorChecked,
                            ]}
                          >
                            {isSelected ? (
                              <MaterialIcons name="check" size={14} color="#0f172a" />
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}

                  <TouchableOpacity
                    style={[
                      profileClassStyles.familyManageButton,
                      (!searchedFamilyId ||
                        !selectedFamilyMemberId ||
                        requestingFamilyLink ||
                        isSearchedFamilySameAsCurrent) &&
                        profileClassStyles.disabledButton,
                    ]}
                    onPress={() => void handleRequestFamilyLink()}
                    disabled={
                      !searchedFamilyId ||
                      !selectedFamilyMemberId ||
                      requestingFamilyLink ||
                      isSearchedFamilySameAsCurrent
                    }
                    activeOpacity={0.85}
                  >
                    {requestingFamilyLink ? (
                      <ActivityIndicator color="#6EE7B7" size="small" />
                    ) : (
                      <Text style={profileClassStyles.familyManageButtonText}>Solicitar vínculo familiar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            */}
          </>
        )}
      </ScrollView>

      <View style={[profileClassStyles.footerContainer, { paddingBottom: insetsBottom + 10 }]}>
        <TouchableOpacity style={profileClassStyles.backButton} onPress={onLeaveScreen}>
          <Text style={profileClassStyles.backButtonText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </RootWrapper>
  );
}
