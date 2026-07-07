import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcPath = path.join(root, 'app/manage-members.tsx');
const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);

const sharedImports = `import { resolveKidsTeensStatusFromBirthDate } from '@/lib/kidsTeensStatus';
import { getAppParameterValue } from '@/lib/appParameters';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import {
  hasAnyProfileAddress,
  inheritFamilyAddressToAcceptedMember,
  loadAcceptorAddressForFamilyScreen,
  resolveAcceptorAuthUserId,
} from '@/lib/inheritFamilyAddress';
import { formatFullName, normalizeFullNameKey } from '@/lib/fullName';
import { formatBrazilDateInput, formatBrazilPhoneInput } from '@/lib/inputMasks';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { dedupeFamilyMembers } from '@/lib/familyAudienceMembers';
import { FAMILY_RELATIONSHIP_OPTIONS } from '@/lib/familyRelationshipOptions';
import { ensureProfilesForMembers, upsertProfileForManagedMember } from '@/lib/memberProfiles';
import { applyProfileBirthDates } from '@/lib/profileBirthDates';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_FAMILY_ID,
  normalizeFamilyCode,
  resolveCurrentFamilyId,
  resolveFamilyIdForAuthUser,
  resolveFamilyIdForPhone,
} from '@/lib/family';
import { resolveProfileIdByPhone } from '@/lib/resolveProfileByPhone';
import Toast from 'react-native-toast-message';

`;

const sharedBlock = lines.slice(80, 379).join('\n');
const sharedExports = `
export const OPCOES_PARENTESCO = [...FAMILY_RELATIONSHIP_OPTIONS];
export type ManageMembersData = {
  familyId: string;
  members: ManagedMember[];
  profileName: string;
  profilePhone: string | null;
  acceptorProfileId: string | null;
  idadeKids: number | null;
  idadeTeens: number | null;
  showVidaTmp: boolean;
};
export type ManagedMember = {
  birth_date: string | null;
  family_id: string;
  full_name: string;
  id: string;
  phone: string | null;
  relationship: string;
  accepted?: boolean | null;
};
export {
  formatPhone,
  formatDate,
  normalizeMemberName,
  normalizeMemberPhoneDigits,
  phoneDigitsMatch,
  convertDateToISO,
  formatDisplayDate,
  getBirthDateElapsedCode,
  getMemberRoomStatus,
  loadManageMembersData,
  showFamilyInconsistencyToast,
  showFamilyWarningToast,
  SELF_MEMBER_BLOCK_MESSAGE,
  ALREADY_IN_FAMILY_TOAST_MESSAGE,
};
`;

fs.mkdirSync(path.join(root, 'lib/manageMembers'), { recursive: true });
fs.writeFileSync(path.join(root, 'lib/manageMembers/shared.ts'), sharedImports + sharedBlock + sharedExports);
fs.writeFileSync(path.join(root, 'lib/manageMembers/index.ts'), `export * from './shared';\nexport * from './membersClassStyles';\n`);

const uiBlock = lines.slice(1288, 1658).join('\n');
const adaptedUi = uiBlock
  .replace(/<ScreenAccessGate status=\{accessStatus\}>\s*/g, '')
  .replace(/\s*<\/ScreenAccessGate>\s*$/g, '')
  .replace(/\bstyles\./g, 'membersClassStyles.')
  .replace(/color="#CBD5E1"/g, 'color={MEMBERS_CLASS_ICON_COLOR}')
  .replace(/color="#10b981"/g, 'color={ACCENT}')
  .replace(/color="#0f172a"/g, 'color={MINIMAL_UI.onDark}')
  .replace(/color="#FFF"/g, 'color={MINIMAL_UI.onDark}')
  .replace(/color="#FCA5A5"/g, 'color="#B91C1C"')
  .replace(/color="#94A3B8"/g, 'color={MEMBERS_CLASS_ICON_COLOR}')
  .replace(/onPress=\{returnToCaller\}/g, 'onPress={onLeaveScreen}')
  .replace(/ref=\{listRef\}/g, 'listRef={listRef}')
  .replace(/SafeAreaView style=\{membersClassStyles\.container\} edges=\{\['top', 'left', 'right'\]\}/g,
    '{embedded ? (\n    <View style={membersClassStyles.container}>\n  ) : (\n    <SafeAreaView style={membersClassStyles.container} edges={[\'top\', \'left\', \'right\']}>\n  )}')
  .replace(/<\/SafeAreaView>/g, '{embedded ? </View> : </SafeAreaView>}');

const membersClassFile = `import { MemberPhotoPicker } from '@/components/MemberPhotoPicker';
import {
  OPCOES_PARENTESCO,
  formatDisplayDate,
  formatPhone,
  formatDate,
  getBirthDateElapsedCode,
  getMemberRoomStatus,
  type ManagedMember,
} from '@/lib/manageMembers/shared';
import {
  ACCENT,
  MEMBERS_CLASS_ICON_COLOR,
  membersClassStyles,
} from '@/lib/manageMembers/membersClassStyles';
import { formatShortName } from '@/lib/formatShortName';
import { formatFullName } from '@/lib/fullName';
import {
  canSearchProfileByName,
  canSearchProfileByPhone,
  lookupProfileByPhoneForMember,
  type ProfileMemberLookup,
} from '@/lib/lookupProfileByPhoneForMember';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type MembersClassProps = {
  embedded?: boolean;
  insetsBottom: number;
  listRef: React.RefObject<FlatList<ManagedMember> | null>;
  familyId: string;
  members: ManagedMember[];
  editingMemberId: string | null;
  memberFormSectionExpanded: boolean;
  onToggleMemberFormSection: () => void;
  name: string;
  onNameChange: (value: string) => void;
  onNameBlur: () => void;
  editingMemberIdForSearch: string | null;
  nameSearchLoading: boolean;
  nameSearchResults: ProfileMemberLookup[];
  linkedProfile: ProfileMemberLookup | null;
  profileLookupMessage: string | null;
  onSelectProfileFromNameSearch: (profile: ProfileMemberLookup) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  onPhoneBlur: () => void;
  birthDate: string;
  onBirthDateChange: (value: string) => void;
  parentesco: string;
  onParentescoChange: (value: string) => void;
  pendingMemberPhoto: string | null;
  onPendingMemberPhotoChange: (value: string | null) => void;
  medicalFoodAlerts: string;
  onMedicalFoodAlertsChange: (value: string) => void;
  adding: boolean;
  deleting: boolean;
  canUpdateFamilyMembers: boolean;
  onAddMember: () => void;
  onConfirmDeleteEditingMember: () => void;
  onResetForm: () => void;
  idadeKids: number | null;
  idadeTeens: number | null;
  showVidaTmp: boolean;
  pendingAcceptedMemberIds: string[];
  onToggleMemberAccepted: (member: ManagedMember) => void;
  onStartEditingMember: (member: ManagedMember) => void;
  onLeaveScreen: () => void;
};

export function MembersClass({
  embedded = false,
  insetsBottom,
  listRef,
  familyId,
  members,
  editingMemberId,
  memberFormSectionExpanded,
  onToggleMemberFormSection,
  name,
  onNameChange,
  onNameBlur,
  nameSearchLoading,
  nameSearchResults,
  linkedProfile,
  profileLookupMessage,
  onSelectProfileFromNameSearch,
  phone,
  onPhoneChange,
  onPhoneBlur,
  birthDate,
  onBirthDateChange,
  parentesco,
  onParentescoChange,
  pendingMemberPhoto,
  onPendingMemberPhotoChange,
  medicalFoodAlerts,
  onMedicalFoodAlertsChange,
  adding,
  deleting,
  canUpdateFamilyMembers,
  onAddMember,
  onConfirmDeleteEditingMember,
  onResetForm,
  idadeKids,
  idadeTeens,
  showVidaTmp,
  pendingAcceptedMemberIds,
  onToggleMemberAccepted,
  onStartEditingMember,
  onLeaveScreen,
}: MembersClassProps) {
  const Root = embedded ? View : SafeAreaView;
  const rootProps = embedded
    ? { style: membersClassStyles.container }
    : { style: membersClassStyles.container, edges: ['top', 'left', 'right'] as const };

  return (
    <Root {...rootProps}>
${adaptedUi
  .replace(/^  return \(/, '')
  .replace(/^\s*<ScreenAccessGate[^>]*>\s*/m, '')
  .replace(/\s*<\/ScreenAccessGate>\s*$/m, '')
  .replace(/^\s*<SafeAreaView[^>]*>/m, '')
  .replace(/\s*<\/SafeAreaView>\s*$/m, '')
  .replace(/returnToCaller/g, 'onLeaveScreen')
  .replace(/setMemberFormSectionExpanded\(\(open\) => !open\)/g, 'onToggleMemberFormSection()')
  .replace(/setName\(/g, 'onNameChange(')
  .replace(/setPhone\(/g, 'onPhoneChange(')
  .replace(/setBirthDate\(/g, 'onBirthDateChange(')
  .replace(/setParentesco\(/g, 'onParentescoChange(')
  .replace(/setMedicalFoodAlerts\(/g, 'onMedicalFoodAlertsChange(')
  .replace(/setPendingMemberPhoto/g, 'onPendingMemberPhotoChange')
  .replace(/handleSelectProfileFromNameSearch/g, 'onSelectProfileFromNameSearch')
  .replace(/addMember/g, 'onAddMember')
  .replace(/confirmDeleteEditingMember/g, 'onConfirmDeleteEditingMember')
  .replace(/resetForm/g, 'onResetForm')
  .replace(/handleToggleMemberAccepted/g, 'onToggleMemberAccepted')
  .replace(/startEditingMember/g, 'onStartEditingMember')
  .replace(/onBlur=\{\(\) => setName\(\(current\) => formatFullName\(current\)\)\}/g, 'onBlur={onNameBlur}')
  .split('\n')
  .slice(1)
  .join('\n')}
  );
}
`;

fs.writeFileSync(path.join(root, 'components/MembersClass.tsx'), membersClassFile);

const panelImports = `import { MembersClass } from '@/components/MembersClass';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { refreshEventRegistrationKidsStatus } from '@/lib/refreshEventRegistrationKidsStatus';
import { confirmDialog } from '@/lib/confirmDialog';
import { attachSelfieToManagedMemberProfile } from '@/lib/managedMemberSelfie';
import { detachMemberFromFamilyWithNewCode } from '@/lib/detachMemberFromFamily';
import {
  applyNewFamilyCodeForRejectedMember,
  findMemberForFamilyTransfer,
} from '@/lib/rejectedMemberFamilyCode';
import { acceptMemberIntoFamily } from '@/lib/acceptMemberIntoFamily';
import { syncManagedMemberProfileFamilyWithFallback } from '@/lib/syncManagedMemberProfileFamily';
import { upsertFamilyMember } from '@/lib/upsertFamilyMember';
import {
  buildProfileInFamilyMessage,
  canSearchProfileByName,
  canSearchProfileByPhone,
  hasAcceptedMemberInFamily,
  lookupProfileByPhoneForMember,
  profileBelongsToFamily,
  searchProfilesByNameForMember,
  type ProfileMemberLookup,
} from '@/lib/lookupProfileByPhoneForMember';
import { findAcceptedMemberDuplicateInFamily } from '@/lib/familyMemberMatch';
import {
  hasAnyProfileAddress,
  inheritFamilyAddressToAcceptedMember,
  loadAcceptorAddressForFamilyScreen,
  resolveAcceptorAuthUserId,
} from '@/lib/inheritFamilyAddress';
import { formatFullName } from '@/lib/fullName';
import {
  ensureProfilesForMembers,
  findProfileIdForMember,
  upsertProfileForManagedMember,
} from '@/lib/memberProfiles';
import { ACCESS_SCREEN, sessionHasAccess } from '@/lib/accessControl';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ALREADY_IN_FAMILY_TOAST_MESSAGE,
  SELF_MEMBER_BLOCK_MESSAGE,
  formatDisplayDate,
  formatPhone,
  loadManageMembersData,
  normalizeMemberName,
  phoneDigitsMatch,
  showFamilyInconsistencyToast,
  showFamilyWarningToast,
  type ManagedMember,
  type ManageMembersData,
} from '@/lib/manageMembers/shared';
`;

const panelBody = lines.slice(380, 1288).join('\n')
  .replace(/^export default function ManageMembers\(\) \{/m, '')
  .replace(/const insets = useSafeAreaInsets\(\);/, 'const insets = useSafeAreaInsets();')
  .trim();

const panelFile = `${panelImports}

export type MembersClassPanelProps = {
  embedded?: boolean;
  phoneParam?: string | null;
  returnRoute?: string | null;
  returnDashboardCard?: string | null;
  onBack?: () => void;
};

export function MembersClassPanel({
  embedded = false,
  phoneParam: phoneParamProp,
  returnRoute: returnRouteProp,
  returnDashboardCard: returnDashboardCardProp,
  onBack,
}: MembersClassPanelProps) {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
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
  const handleLeaveScreen = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    returnToCaller();
  }, [onBack, returnToCaller]);

${panelBody.replace(/^  const insets = useSafeAreaInsets\(\);\s*\n  const params[\s\S]*?const returnToCaller = useReturnToCallerOnLeave\(\{[\s\S]*?\}\);\s*\n  const listRef/m, '  const listRef')}

  const handleNameBlur = useCallback(() => {
    setName((current) => formatFullName(current));
  }, []);

  const handlePhoneBlur = useCallback(() => {
    const formatted = phone.trim() ? formatPhone(phone) : '';
    if (formatted !== phone) {
      setPhone(formatted);
    }

    if (editingMemberId || linkedProfile || name.trim() || !canSearchProfileByPhone(formatted)) {
      return;
    }

    void lookupProfileByPhoneForMember(formatted)
      .then((profile) => {
        if (!profile) {
          return;
        }

        applyProfileToMemberForm(profile);
        setProfileLookupMessage(
          \`Perfil encontrado pelo telefone: \${profile.full_name?.trim() || 'Sem nome'}.\`
        );
      })
      .catch((err: unknown) => {
        console.error('Erro ao buscar perfil pelo telefone:', err);
      });
  }, [applyProfileToMemberForm, editingMemberId, linkedProfile, name, phone]);

  const membersClassNode = (
    <MembersClass
      embedded={embedded}
      insetsBottom={insets.bottom}
      listRef={listRef}
      familyId={familyId}
      members={members}
      editingMemberId={editingMemberId}
      memberFormSectionExpanded={memberFormSectionExpanded}
      onToggleMemberFormSection={() => setMemberFormSectionExpanded((open) => !open)}
      name={name}
      onNameChange={(value) => {
        setName(value);
        if (linkedProfile) {
          setLinkedProfile(null);
          setProfileLookupMessage(null);
        }
      }}
      onNameBlur={handleNameBlur}
      editingMemberIdForSearch={editingMemberId}
      nameSearchLoading={nameSearchLoading}
      nameSearchResults={nameSearchResults}
      linkedProfile={linkedProfile}
      profileLookupMessage={profileLookupMessage}
      onSelectProfileFromNameSearch={handleSelectProfileFromNameSearch}
      phone={phone}
      onPhoneChange={(value) => {
        const formatted = formatPhone(value);
        setPhone(formatted);
        if (linkedProfile) {
          setLinkedProfile(null);
          setProfileLookupMessage(null);
        }
      }}
      onPhoneBlur={handlePhoneBlur}
      birthDate={birthDate}
      onBirthDateChange={(value) => setBirthDate(formatDate(value))}
      parentesco={parentesco}
      onParentescoChange={setParentesco}
      pendingMemberPhoto={pendingMemberPhoto}
      onPendingMemberPhotoChange={setPendingMemberPhoto}
      medicalFoodAlerts={medicalFoodAlerts}
      onMedicalFoodAlertsChange={setMedicalFoodAlerts}
      adding={adding}
      deleting={deleting}
      canUpdateFamilyMembers={canUpdateFamilyMembers}
      onAddMember={addMember}
      onConfirmDeleteEditingMember={() => void confirmDeleteEditingMember()}
      onResetForm={resetForm}
      idadeKids={idadeKids}
      idadeTeens={idadeTeens}
      showVidaTmp={showVidaTmp}
      pendingAcceptedMemberIds={pendingAcceptedMemberIds}
      onToggleMemberAccepted={(member) => void handleToggleMemberAccepted(member)}
      onStartEditingMember={startEditingMember}
      onLeaveScreen={handleLeaveScreen}
    />
  );

  if (embedded) {
    return membersClassNode;
  }

  return <ScreenAccessGate status={accessStatus}>{membersClassNode}</ScreenAccessGate>;
}
`;

// Remove old return block from panel body - script inserts MembersClass at end
const panelBodyClean = panelFile.replace(
  /  return \([\s\S]*$/,
  `  if (embedded) {
    return membersClassNode;
  }

  return <ScreenAccessGate status={accessStatus}>{membersClassNode}</ScreenAccessGate>;
}
`
);

// Fix: panelBody still contains old return - need different approach
// Re-read and build panel from scratch by slicing before return

const panelLogic = lines.slice(393, 1288).join('\n'); // from listRef to end of addMember

const panelFinal = `${panelImports}

export type MembersClassPanelProps = {
  embedded?: boolean;
  phoneParam?: string | null;
  returnRoute?: string | null;
  returnDashboardCard?: string | null;
  onBack?: () => void;
};

export function MembersClassPanel({
  embedded = false,
  phoneParam: phoneParamProp,
  returnRoute: returnRouteProp,
  returnDashboardCard: returnDashboardCardProp,
  onBack,
}: MembersClassPanelProps) {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
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
  const handleLeaveScreen = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    returnToCaller();
  }, [onBack, returnToCaller]);

  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.manageMembers,
    deniedMessage: 'Você não tem permissão para abrir Gerenciar família.',
  });

${panelLogic.replace(/  return \([\s\S]*/s, '').trim()}

  const handleNameBlur = useCallback(() => {
    setName((current) => formatFullName(current));
  }, []);

  const handlePhoneBlur = useCallback(() => {
    const formatted = phone.trim() ? formatPhone(phone) : '';
    if (formatted !== phone) {
      setPhone(formatted);
    }

    if (editingMemberId || linkedProfile || name.trim() || !canSearchProfileByPhone(formatted)) {
      return;
    }

    void lookupProfileByPhoneForMember(formatted)
      .then((profile) => {
        if (!profile) {
          return;
        }

        applyProfileToMemberForm(profile);
        setProfileLookupMessage(
          \`Perfil encontrado pelo telefone: \${profile.full_name?.trim() || 'Sem nome'}.\`
        );
      })
      .catch((err: unknown) => {
        console.error('Erro ao buscar perfil pelo telefone:', err);
      });
  }, [applyProfileToMemberForm, editingMemberId, linkedProfile, name, phone]);

  const membersClassNode = (
    <MembersClass
      embedded={embedded}
      insetsBottom={insets.bottom}
      listRef={listRef}
      familyId={familyId}
      members={members}
      editingMemberId={editingMemberId}
      memberFormSectionExpanded={memberFormSectionExpanded}
      onToggleMemberFormSection={() => setMemberFormSectionExpanded((open) => !open)}
      name={name}
      onNameChange={(value) => {
        setName(value);
        if (linkedProfile) {
          setLinkedProfile(null);
          setProfileLookupMessage(null);
        }
      }}
      onNameBlur={handleNameBlur}
      editingMemberIdForSearch={editingMemberId}
      nameSearchLoading={nameSearchLoading}
      nameSearchResults={nameSearchResults}
      linkedProfile={linkedProfile}
      profileLookupMessage={profileLookupMessage}
      onSelectProfileFromNameSearch={handleSelectProfileFromNameSearch}
      phone={phone}
      onPhoneChange={(value) => {
        const formatted = formatPhone(value);
        setPhone(formatted);
        if (linkedProfile) {
          setLinkedProfile(null);
          setProfileLookupMessage(null);
        }
      }}
      onPhoneBlur={handlePhoneBlur}
      birthDate={birthDate}
      onBirthDateChange={(value) => setBirthDate(formatDate(value))}
      parentesco={parentesco}
      onParentescoChange={setParentesco}
      pendingMemberPhoto={pendingMemberPhoto}
      onPendingMemberPhotoChange={setPendingMemberPhoto}
      medicalFoodAlerts={medicalFoodAlerts}
      onMedicalFoodAlertsChange={setMedicalFoodAlerts}
      adding={adding}
      deleting={deleting}
      canUpdateFamilyMembers={canUpdateFamilyMembers}
      onAddMember={addMember}
      onConfirmDeleteEditingMember={() => void confirmDeleteEditingMember()}
      onResetForm={resetForm}
      idadeKids={idadeKids}
      idadeTeens={idadeTeens}
      showVidaTmp={showVidaTmp}
      pendingAcceptedMemberIds={pendingAcceptedMemberIds}
      onToggleMemberAccepted={(member) => void handleToggleMemberAccepted(member)}
      onStartEditingMember={startEditingMember}
      onLeaveScreen={handleLeaveScreen}
    />
  );

  if (embedded) {
    return membersClassNode;
  }

  return <ScreenAccessGate status={accessStatus}>{membersClassNode}</ScreenAccessGate>;
}
`;

fs.writeFileSync(path.join(root, 'components/MembersClassPanel.tsx'), panelFinal);

fs.writeFileSync(
  path.join(root, 'app/manage-members.tsx'),
  `import { MembersClassPanel } from '@/components/MembersClassPanel';

/** Rota expo-router — delega para o container MembersClassPanel. */
export default function ManageMembersScreen() {
  return <MembersClassPanel />;
}
`
);

console.log('Refactor complete: lib/manageMembers/shared.ts, MembersClass.tsx, MembersClassPanel.tsx, manage-members.tsx');
