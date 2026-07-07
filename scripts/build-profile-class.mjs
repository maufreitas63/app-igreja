import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const panelPath = path.join(root, 'components/ProfileClassPanel.tsx');
const lines = fs.readFileSync(panelPath, 'utf8').split(/\r?\n/);

// ProfileClass gets camera branch (2121-2164) + main form (2166-2770), 0-indexed: 2120-2769
const uiLines = [...lines.slice(2120, 2164), ...lines.slice(2165, 2770)];

const profileClassHeader = `import { ProfileSecurityQuestionSection } from '@/components/ProfileSecurityQuestionSection';
import { AccessPinField, ACCESS_PIN_SECTION_BODY_MIN_HEIGHT, SECTION_TITLES } from '@/lib/manageProfile/shared';
import type {
  ProfileFieldRow,
  ProfileRecord,
  ProfileSection,
  ProfileSectionKey,
  ProfileVehicle,
} from '@/lib/manageProfile/shared';
import { MINIMAL_UI, MINIMAL_TYPO } from '@/lib/minimalUiTheme';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { CameraView } from 'expo-camera';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { CameraView as CameraViewType } from 'expo-camera';

export type ProfileClassProps = {
  embedded?: boolean;
  insetsBottom: number;
  isOnboardingFlow: boolean;
  isRecoveryAccessPinFlow: boolean;
  screenMode: 'FORM' | 'CAMERA';
  loading: boolean;
  columnAccessLoading: boolean;
  ghostModeActive: boolean;
  profile: ProfileRecord | null;
  displayName: string;
  displayPhone: string;
  displayBirth: string;
  displayFamily: string;
  lgpdModuleActive: boolean;
  isLgpdPending: boolean;
  profileSections: ProfileSection[];
  selfiePreviewUrl: string | null;
  selfiePreviewKey: number;
  isSelfieLoading: boolean;
  showAccessPinSection: boolean;
  accessPinSectionExpanded: boolean;
  canUseAccessPinForm: boolean;
  savingAccessPin: boolean;
  accessPinValidationMessage: string | null;
  accessPinConfirmMismatch: boolean;
  accessPinSameAsCurrent: boolean;
  currentAccessPin: string;
  newAccessPin: string;
  confirmAccessPin: string;
  showCurrentAccessPin: boolean;
  showNewAccessPin: boolean;
  showConfirmAccessPin: boolean;
  securityQuestionSectionExpanded: boolean;
  initialSecurityQuestion: string | null;
  editingFieldRow: ProfileFieldRow | null;
  editingValue: string;
  editingPlaceholder: string;
  saving: boolean;
  lookingUpCep: boolean;
  expandedSections: Record<ProfileSectionKey, boolean>;
  vehicles: ProfileVehicle[];
  loadingVehicles: boolean;
  isVehicleEditorVisible: boolean;
  editingVehicle: ProfileVehicle | null;
  vehicleForm: { placa: string; marca: string; modelo: string; cor: string };
  savingVehicle: boolean;
  deletingVehicleId: string | null;
  isCameraReady: boolean;
  pictureSize: string | null;
  scrollRef: React.RefObject<ScrollView | null>;
  cameraRef: React.RefObject<CameraViewType | null>;
  currentAccessPinRef: React.RefObject<TextInput | null>;
  newAccessPinRef: React.RefObject<TextInput | null>;
  confirmAccessPinRef: React.RefObject<TextInput | null>;
  saveAccessPinRef: React.RefObject<View | null>;
  onLeaveScreen: () => void;
  onOpenLgpd: () => void;
  onOpenSelfie: () => void;
  onCameraReady: () => void;
  onCameraMountError: (message: string) => void;
  onCancelCamera: () => void;
  onCaptureSelfie: () => void;
  onToggleAccessPinSection: () => void;
  onAccessPinSectionLayout: (y: number) => void;
  onAccessPinFieldChange: (
    text: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    nextRef?: React.RefObject<TextInput | null>,
    onComplete?: () => void
  ) => void;
  onToggleCurrentPinVisible: () => void;
  onToggleNewPinVisible: () => void;
  onToggleConfirmPinVisible: () => void;
  onSaveAccessPin: () => void;
  onAccessPinFocus: () => void;
  onFocusSaveAccessPin: () => void;
  onToggleSecurityQuestionSection: () => void;
  onSecurityQuestionSaved: (question: string) => void;
  onEditingValueChange: (value: string) => void;
  onSaveField: () => void;
  onCancelEdit: () => void;
  onToggleSection: (key: ProfileSectionKey) => void;
  onStartEditingField: (field: ProfileFieldRow) => void;
  onVehicleFormChange: (field: 'placa' | 'marca' | 'modelo' | 'cor', value: string) => void;
  onSaveVehicle: () => void;
  onCancelVehicleEdit: () => void;
  onStartNewVehicle: () => void;
  onStartEditingVehicle: (vehicle: ProfileVehicle) => void;
  onDeleteVehicle: (vehicle: ProfileVehicle) => void;
  renderAccessPinFormFields: () => React.ReactNode;
};

/** Visualização pura de Dados Cadastrais — padrão vigilance_scales / minimalista. */
export function ProfileClass(props: ProfileClassProps) {
  const {
    embedded = false,
    insetsBottom,
    isOnboardingFlow,
    isRecoveryAccessPinFlow,
    screenMode,
    loading,
    columnAccessLoading,
    ghostModeActive,
    profile,
    displayName,
    displayPhone,
    displayBirth,
    displayFamily,
    lgpdModuleActive,
    isLgpdPending,
    profileSections,
    selfiePreviewUrl,
    selfiePreviewKey,
    isSelfieLoading,
    showAccessPinSection,
    accessPinSectionExpanded,
    onOpenLgpd,
    onOpenSelfie,
    onLeaveScreen,
    scrollRef,
    cameraRef,
    isCameraReady,
    pictureSize,
    onCameraReady,
    onCameraMountError,
    onCancelCamera,
    onCaptureSelfie,
    showAccessPinSection: _s,
    ...rest
  } = props;

`;

// Fix the destructuring - the script approach is getting too complex. 
// Simpler: just wrap uiLines in function with props spread

const profileClassBody = `export function ProfileClass(props: ProfileClassProps) {
  const p = props;
`;

fs.writeFileSync(path.join(root, 'components/ProfileClass.tsx'), '// placeholder - manual build needed\n');
console.log('Script needs manual completion');
