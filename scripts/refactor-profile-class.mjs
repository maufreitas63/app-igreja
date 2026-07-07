import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const panelPath = path.join(root, 'components/ProfileClassPanel.tsx');
const lines = fs.readFileSync(panelPath, 'utf8').split(/\r?\n/);

// --- ProfileClass.tsx body (scroll content + camera) ---
const cameraJsx = lines.slice(2120, 2164).join('\n');
const formInner = lines.slice(2189, 2762).join('\n');

const adaptUi = (src) =>
  src
    .replace(/\bstyles\./g, 'profileClassStyles.')
    .replace(/color="#10b981"/g, 'color={PROFILE_CLASS_ICON_COLOR}')
    .replace(/color="#34D399"/g, 'color={PROFILE_CLASS_ICON_COLOR}')
    .replace(/color="#CBD5E1"/g, 'color={PROFILE_CLASS_ICON_COLOR}')
    .replace(/color="#FFF"/g, 'color={MINIMAL_UI.onDark}')
    .replace(/onPress=\{\(\) => void handleOpenLgpdScreen\(\)\}/g, 'onPress={onOpenLgpdScreen}')
    .replace(/onPress=\{\(\) => void handleOpenSelfieAction\(\)\}/g, 'onPress={onOpenSelfieAction}')
    .replace(
      /onLayout=\{\(event\) => \{\s*accessPinSectionScrollYRef\.current = event\.nativeEvent\.layout\.y;\s*\}\}/,
      'onLayout={(event) => onAccessPinSectionLayout(event.nativeEvent.layout.y)}'
    )
    .replace(/\{renderAccessPinFormFields\(\)\}/, '{accessPinFormContent}')
    .replace(
      /onToggle=\{\(\) => setSecurityQuestionSectionExpanded\(\(open\) => !open\)\}/,
      'onToggle={onToggleSecurityQuestionSection}'
    )
    .replace(
      /onSaved=\{\(securityQuestion\) => \{[\s\S]*?void fetchProfile\(\{ force: true \}\);[\s\S]*?\}\}/,
      'onSaved={onSecurityQuestionSaved}'
    )
    .replace(/onChangeText=\{handleEditingValueChange\}/g, 'onChangeText={onEditingValueChange}')
    .replace(/onPress=\{\(\) => void handleSaveField\(\)\}/g, 'onPress={onSaveField}')
    .replace(/onPress=\{resetEditing\}/g, 'onPress={onCancelEditing}')
    .replace(/onPress=\{\(\) => startEditingField\(field\)\}/g, 'onPress={() => onStartEditingField(field)}')
    .replace(/onPress=\{\(\) => void handleSaveVehicle\(\)\}/g, 'onPress={onSaveVehicle}')
    .replace(/onPress=\{resetVehicleEditing\}/g, 'onPress={onCancelVehicleEditing}')
    .replace(
      /onChangeText=\{\(text\) =>\s*setVehicleForm\(\(current\) => \(\{ \.\.\.current, placa: text \}\)\)\s*\}/g,
      'onChangeText={(text) => onVehicleFormChange({ placa: text })}'
    )
    .replace(
      /onChangeText=\{\(text\) =>\s*setVehicleForm\(\(current\) => \(\{ \.\.\.current, marca: text \}\)\)\s*\}/g,
      'onChangeText={(text) => onVehicleFormChange({ marca: text })}'
    )
    .replace(
      /onChangeText=\{\(text\) =>\s*setVehicleForm\(\(current\) => \(\{ \.\.\.current, modelo: text \}\)\)\s*\}/g,
      'onChangeText={(text) => onVehicleFormChange({ modelo: text })}'
    )
    .replace(
      /onChangeText=\{\(text\) =>\s*setVehicleForm\(\(current\) => \(\{ \.\.\.current, cor: text \}\)\)\s*\}/g,
      'onChangeText={(text) => onVehicleFormChange({ cor: text })}'
    )
    .replace(/onPress=\{\(\) => startEditingVehicle\(vehicle\)\}/g, 'onPress={() => onStartEditingVehicle(vehicle)}')
    .replace(/onPress=\{\(\) => void handleDeleteVehicle\(vehicle\)\}/g, 'onPress={() => onDeleteVehicle(vehicle)}')
    .replace(/onPress=\{startNewVehicle\}/g, 'onPress={onStartNewVehicle}')
    .replace(
      /<View style=\{\{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 \}\}>/g,
      '<View style={profileClassStyles.cepLookupRow}>'
    )
    .replace(
      /<Text style=\{\{ color: '#94A3B8', fontSize: 13 \}\}>Consultando endereço do CEP…<\/Text>/g,
      '<Text style={profileClassStyles.cepLookupText}>Consultando endereço do CEP…</Text>'
    );

const profileClassFile = `import { ProfileSecurityQuestionSection } from '@/components/ProfileSecurityQuestionSection';
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
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { Image } from 'expo-image';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
  securityQuestionSectionExpanded: boolean;
  onToggleSecurityQuestionSection: () => void;
  onSecurityQuestionSaved: (securityQuestion: string) => void;
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
  securityQuestionSectionExpanded,
  onToggleSecurityQuestionSection,
  onSecurityQuestionSaved,
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
${adaptUi(cameraJsx)
  .replace(/SafeAreaView style=\{profileClassStyles\.cameraScreen\} edges=\{\['top', 'left', 'right', 'bottom'\]\}/, '')
  .replace(/^  if \(screenMode === 'CAMERA'\) \{\n    return \(\n      /, '')
  .replace(/setScreenMode\('FORM'\)/g, 'onCancelCamera()')
  .replace(/void handleCameraReady\(\)/g, 'void onCameraReady()')
  .replace(/void handleSelfieSelected\(picture\.uri\)/g, 'void onCaptureSelfie()')
  .replace(/setScreenMode\('FORM'\);\n              \}\}/, "onCameraMountError(event.nativeEvent.message || 'Não foi possível abrir a câmera.');\n              }}")
  .split('\n')
  .slice(2, -2)
  .join('\n')}
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
${adaptUi(formInner).split('\n').map((l) => l.replace(/^        /, '        ')).join('\n')}
      </ScrollView>

      <View style={[profileClassStyles.footerContainer, { paddingBottom: insetsBottom + 10 }]}>
        <TouchableOpacity style={profileClassStyles.backButton} onPress={onLeaveScreen}>
          <Text style={profileClassStyles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </RootWrapper>
  );
}
`;

fs.writeFileSync(path.join(root, 'components/ProfileClass.tsx'), profileClassFile);

// --- ProfileClassPanel refactor ---
const header = `import { ProfileClass } from '@/components/ProfileClass';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { useGhostMode } from '@/context/GhostModeContext';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { changePhoneEverywhere } from '@/lib/changePhone';
import { confirmDialog } from '@/lib/confirmDialog';
import {
  deleteSelfieFile,
  hasExistingSelfieRecord,
  pickSelfieFromWeb,
  resolveSelfiePreviewUrl,
  resolveSelfieStorageFileName,
  saveProfileSelfieUrl,
  selectSelfiePictureSize,
  uploadSelfieInput,
} from '@/lib/selfie';
import { invalidateProfilesMapSnapshot, PROFILE_GEO_FIELDS } from '@/lib/profilesMapCache';
import { syncProfileAddressFromCep } from '@/lib/syncProfileAddressFromCep';
import { formatFullName } from '@/lib/fullName';
import {
  buildAppIndexRoute,
  buildDashboardFamilyAgendaRoute,
  buildRegisterRoute,
  isPlaceholderVisitorName,
  isProfileIncompleteForOnboarding,
  isProfilePendingSelfRegistration,
} from '@/lib/profileOnboarding';
import { isLgpdAtivoEnabled, isProfileLgpdPending } from '@/lib/appParameters';
import { reconcileRejectedMemberFamilyCode } from '@/lib/rejectedMemberFamilyCode';
import { ACCESS_PIN_LENGTH, isValidAccessPin, updateProfileAccessPin } from '@/lib/accessPin';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { supabase } from '@/lib/supabase';
import {
  ACCESS_SCREEN,
  canUpdateProfileColumn,
  canViewProfileColumn,
  isProfileColumnAccessLoaded,
  loadProfileColumnAccess,
  sessionHasAccess,
  type ProfileColumnAccess,
} from '@/lib/accessControl';
import {
  AccessPinField,
  DEFAULT_EXPANDED_SECTIONS,
  ONBOARDING_EXPANDED_SECTIONS,
  buildFieldRows,
  buildSections,
  formatBooleanValue,
  formatDisplayDateLike,
  formatCep,
  formatDate,
  formatPhone,
  loadProfile,
  normalizeCep,
  normalizePhone,
  parseBooleanInput,
  toIsoDate,
  type ProfileFieldRow,
  type ProfileRecord,
  type ProfileSectionKey,
  type ProfileVehicle,
} from '@/lib/manageProfile/shared';
import { profileClassStyles } from '@/lib/manageProfile/profileClassStyles';

export type ProfileClassPanelProps = {
  embedded?: boolean;
  phoneParam?: string | null;
  returnRoute?: string | null;
  returnDashboardCard?: string | null;
  isOnboardingFlow?: boolean;
  isRecoveryAccessPinFlow?: boolean;
  recoveryPinParam?: string;
  onBack?: () => void;
};

`;

let logic = lines.slice(688, 2120).join('\n');
logic = logic.replace(
  'export default function ManageProfile() {',
  `export function ProfileClassPanel({
  embedded = false,
  phoneParam: phoneParamProp,
  returnRoute: returnRouteProp,
  returnDashboardCard: returnDashboardCardProp,
  isOnboardingFlow: isOnboardingFlowProp,
  isRecoveryAccessPinFlow: isRecoveryAccessPinFlowProp,
  recoveryPinParam: recoveryPinParamProp,
  onBack,
}: ProfileClassPanelProps) {`
);

logic = logic.replace(
  `  const params = useLocalSearchParams();
  const phoneParam = params.phone ? decodeURIComponent(params.phone as string) : null;
  const returnDashboardCard = resolveReturnDashboardCardParam(params);
  const explicitReturnRoute = resolveReturnRouteParam(params);
  const returnRoute = explicitReturnRoute ?? (returnDashboardCard ? null : '/perfil');
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute,
    returnDashboardCard,
    extraRouteParams: phoneParam ? { phone: encodeURIComponent(phoneParam) } : undefined,
  });
  const isOnboardingFlow = params.onboarding === '1';
  const isRecoveryAccessPinFlow = params.changeAccessPinAfterRecovery === '1';
  const recoveryPinParam = params.recoveryPin
    ? decodeURIComponent(String(params.recoveryPin))
    : '';`,
  `  const params = useLocalSearchParams();
  const phoneParam = phoneParamProp ?? (params.phone ? decodeURIComponent(params.phone as string) : null);
  const returnDashboardCard = returnDashboardCardProp ?? resolveReturnDashboardCardParam(params);
  const explicitReturnRoute = returnRouteProp ?? resolveReturnRouteParam(params);
  const returnRoute = explicitReturnRoute ?? (returnDashboardCard ? null : '/perfil');
  const returnToCaller = useReturnToCallerOnLeave(
    onBack
      ? { returnRoute: null, returnDashboardCard: null }
      : {
          returnRoute,
          returnDashboardCard,
          extraRouteParams: phoneParam ? { phone: encodeURIComponent(phoneParam) } : undefined,
        }
  );
  const isOnboardingFlow = isOnboardingFlowProp ?? params.onboarding === '1';
  const isRecoveryAccessPinFlow = isRecoveryAccessPinFlowProp ?? params.changeAccessPinAfterRecovery === '1';
  const recoveryPinParam = recoveryPinParamProp ?? (params.recoveryPin ? decodeURIComponent(String(params.recoveryPin)) : '');`
);

logic = logic.replace(
  `  const handleLeaveScreen = useCallback(() => {
    if (isRecoveryAccessPinFlow) {
      Alert.alert(
        'Defina sua nova senha',
        'Escolha uma senha de 4 dígitos, confirme nos dois campos e toque em Salvar nova senha para continuar.'
      );
      return;
    }

    returnToCaller();
  }, [isRecoveryAccessPinFlow, returnToCaller]);`,
  `  const handleLeaveScreen = useCallback(() => {
    if (isRecoveryAccessPinFlow) {
      Alert.alert(
        'Defina sua nova senha',
        'Escolha uma senha de 4 dígitos, confirme nos dois campos e toque em Salvar nova senha para continuar.'
      );
      return;
    }

    if (onBack) {
      onBack();
      return;
    }

    returnToCaller();
  }, [isRecoveryAccessPinFlow, onBack, returnToCaller]);`
);

logic = logic.replace(/\bstyles\./g, 'profileClassStyles.');

const tail = `
  const handleOpenLgpdScreen = useCallback(() => {
    const phoneForLgpd = phoneParam?.trim() || String(profile?.phone ?? '').trim();

    router.push({
      pathname: '/lgpd',
      params: phoneForLgpd ? { phone: encodeURIComponent(phoneForLgpd) } : {},
    });
  }, [phoneParam, profile?.phone, router]);

  const handleVehicleFormChange = useCallback(
    (patch: Partial<{ placa: string; marca: string; modelo: string; cor: string }>) => {
      setVehicleForm((current) => ({ ...current, ...patch }));
    },
    []
  );

  return (
    <ProfileClass
      embedded={embedded}
      screenMode={screenMode}
      insetsBottom={insets.bottom}
      scrollRef={scrollRef}
      cameraRef={cameraRef}
      pictureSize={pictureSize}
      isCameraReady={isCameraReady}
      onCameraReady={handleCameraReady}
      onCancelCamera={() => setScreenMode('FORM')}
      onCaptureSelfie={async () => {
        const picture = await cameraRef.current?.takePictureAsync({ quality: 0.1 });
        if (picture?.uri) {
          void handleSelfieSelected(picture.uri);
        }
      }}
      onCameraMountError={(message) => {
        Alert.alert('Erro na câmera', message || 'Não foi possível abrir a câmera.');
        setScreenMode('FORM');
      }}
      isOnboardingFlow={isOnboardingFlow}
      isRecoveryAccessPinFlow={isRecoveryAccessPinFlow}
      profile={profile}
      loading={loading}
      ghostModeActive={ghostModeActive}
      columnAccessLoading={columnAccessLoading}
      profileSections={profileSections}
      expandedSections={expandedSections}
      toggleSection={toggleSection}
      selfiePreviewUrl={selfiePreviewUrl}
      selfiePreviewKey={selfiePreviewKey}
      isSelfieLoading={isSelfieLoading}
      displayName={displayName}
      displayPhone={displayPhone}
      displayBirth={displayBirth}
      displayFamily={displayFamily}
      lgpdModuleActive={lgpdModuleActive}
      isLgpdPending={isLgpdPending}
      onOpenLgpdScreen={() => void handleOpenLgpdScreen()}
      onOpenSelfieAction={() => void handleOpenSelfieAction()}
      showAccessPinSection={showAccessPinSection}
      accessPinSectionExpanded={accessPinSectionExpanded}
      toggleAccessPinSection={toggleAccessPinSection}
      onAccessPinSectionLayout={(y) => {
        accessPinSectionScrollYRef.current = y;
      }}
      accessPinFormContent={renderAccessPinFormFields()}
      securityQuestionSectionExpanded={securityQuestionSectionExpanded}
      onToggleSecurityQuestionSection={() => setSecurityQuestionSectionExpanded((open) => !open)}
      onSecurityQuestionSaved={(securityQuestion) => {
        setProfile((current) =>
          current ? { ...current, security_question: securityQuestion } : current
        );
        void fetchProfile({ force: true });
      }}
      editingFieldRow={editingFieldRow}
      editingPlaceholder={editingPlaceholder}
      editingValue={editingValue}
      saving={saving}
      lookingUpCep={lookingUpCep}
      onEditingValueChange={handleEditingValueChange}
      onSaveField={() => void handleSaveField()}
      onCancelEditing={resetEditing}
      onStartEditingField={startEditingField}
      vehicles={vehicles}
      loadingVehicles={loadingVehicles}
      isVehicleEditorVisible={isVehicleEditorVisible}
      editingVehicle={editingVehicle}
      vehicleForm={vehicleForm}
      onVehicleFormChange={handleVehicleFormChange}
      savingVehicle={savingVehicle}
      deletingVehicleId={deletingVehicleId}
      onSaveVehicle={() => void handleSaveVehicle()}
      onCancelVehicleEditing={resetVehicleEditing}
      onStartEditingVehicle={startEditingVehicle}
      onDeleteVehicle={(vehicle) => void handleDeleteVehicle(vehicle)}
      onStartNewVehicle={startNewVehicle}
      accessPinSectionExpandedForScroll={accessPinSectionExpanded}
      onLeaveScreen={handleLeaveScreen}
      showOnboardingHint={Boolean(isOnboardingFlow && isProfileIncompleteForOnboarding(profile))}
    />
  );
}
`;

// Remove duplicate display vars and handleOpenLgpd from logic - keep editingPlaceholder block
const cutFrom = logic.indexOf('  if (screenMode === \'CAMERA\')');
if (cutFrom >= 0) {
  logic = logic.slice(0, cutFrom) + tail;
}

fs.writeFileSync(panelPath, header + logic);

fs.writeFileSync(
  path.join(root, 'app/manage-profile.tsx'),
  `import { ProfileClassPanel } from '@/components/ProfileClassPanel';

/** Rota expo-router — delega para o container ProfileClassPanel. */
export default function ManageProfileScreen() {
  return <ProfileClassPanel />;
}
`
);

console.log('Done');
