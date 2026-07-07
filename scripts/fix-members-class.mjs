import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcPath = path.join(root, 'scripts/.manage-members-source.tsx');
const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);

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
import { DEFAULT_FAMILY_ID } from '@/lib/family';
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
  formatDate,
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

const panelTail = `
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

  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.manageMembers,
    deniedMessage: 'Você não tem permissão para abrir Gerenciar família.',
  });
  const listRef = useRef<FlatList<ManagedMember>>(null);

${lines.slice(399, 1287).join('\n')}
${panelTail}`;

fs.writeFileSync(path.join(root, 'components/MembersClassPanel.tsx'), panelFile);

// Fix MembersClass UI from source
const uiLines = lines.slice(1288, 1657);
let uiBody = uiLines.join('\n');
uiBody = uiBody
  .replace(/^  return \(\s*\n\s*<ScreenAccessGate[^>]*>\s*\n/m, '')
  .replace(/\s*<\/ScreenAccessGate>\s*\n\s*\);\s*$/m, '')
  .replace(/^\s*<SafeAreaView[^>]*>\s*\n/m, '')
  .replace(/\s*<\/SafeAreaView>\s*\n(?=\s*<\/)/m, '')
  .replace(/\bstyles\./g, 'membersClassStyles.')
  .replace(/ref=\{listRef\}/g, 'ref={listRef}')
  .replace(/color="#CBD5E1"/g, 'color={MEMBERS_CLASS_ICON_COLOR}')
  .replace(/color="#10b981"/g, 'color={ACCENT}')
  .replace(/color="#0f172a"/g, 'color={MINIMAL_UI.onDark}')
  .replace(/color="#FFF"/g, 'color={MINIMAL_UI.onDark}')
  .replace(/color="#FCA5A5"/g, 'color="#B91C1C"')
  .replace(/color="#94A3B8"/g, 'color={MEMBERS_CLASS_ICON_COLOR}')
  .replace(/onPress=\{returnToCaller\}/g, 'onPress={onLeaveScreen}')
  .replace(/setMemberFormSectionExpanded\(\(open\) => !open\)/g, 'onToggleMemberFormSection()')
  .replace(/onChangeText=\{\(value\) => \{\s*setName\(value\);[\s\S]*?\}\}/g, 'onChangeText={onNameChange}')
  .replace(/onBlur=\{\(\) => setName\(\(current\) => formatFullName\(current\)\)\}/g, 'onBlur={onNameBlur}')
  .replace(/onChangeText=\{\(value\) => setBirthDate\(formatDate\(value\)\)\}/g, 'onChangeText={(value) => onBirthDateChange(formatDate(value))}')
  .replace(/onPress=\{\(\) => setParentesco\(opcao\)\}/g, 'onPress={() => onParentescoChange(opcao)}')
  .replace(/onPhotoChange=\{setPendingMemberPhoto\}/g, 'onPhotoChange={onPendingMemberPhotoChange}')
  .replace(/onChangeText=\{setMedicalFoodAlerts\}/g, 'onChangeText={onMedicalFoodAlertsChange}')
  .replace(/onPress=\{addMember\}/g, 'onPress={onAddMember}')
  .replace(/onPress=\{\(\) => void confirmDeleteEditingMember\(\)\}/g, 'onPress={() => void onConfirmDeleteEditingMember()}')
  .replace(/onPress=\{resetForm\}/g, 'onPress={onResetForm}')
  .replace(/onPress=\{\(\) => void handleToggleMemberAccepted\(item\)\}/g, 'onPress={() => void onToggleMemberAccepted(item)}')
  .replace(/onPress=\{\(\) => startEditingMember\(item\)\}/g, 'onPress={() => onStartEditingMember(item)}')
  .replace(/onPress=\{\(\) => handleSelectProfileFromNameSearch\(profile\)\}/g, 'onPress={() => onSelectProfileFromNameSearch(profile)}')
  .replace(/paddingBottom: insets\.bottom \+ 10/g, 'paddingBottom: insetsBottom + 10');

// Simplify phone field - use onPhoneChange and onPhoneBlur
uiBody = uiBody.replace(
  /onChangeText=\{\(value\) => \{[\s\S]*?onPhoneChange\(formatted\);[\s\S]*?\}\}\s*onBlur=\{\(\) => \{[\s\S]*?\}\}\s*\/>/m,
  `onChangeText={onPhoneChange}
                  onBlur={onPhoneBlur}
                />`
);

const membersClassFile = `import { MemberPhotoPicker } from '@/components/MemberPhotoPicker';
import {
  OPCOES_PARENTESCO,
  formatDisplayDate,
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
import { canSearchProfileByName } from '@/lib/lookupProfileByPhoneForMember';
import { type ProfileMemberLookup } from '@/lib/lookupProfileByPhoneForMember';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
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
${uiBody.trim()}
    </Root>
  );
}
`;

fs.writeFileSync(path.join(root, 'components/MembersClass.tsx'), membersClassFile);

// Fix shared.ts duplicate exports
let shared = fs.readFileSync(path.join(root, 'lib/manageMembers/shared.ts'), 'utf8');
shared = shared
  .replace(/^const OPCOES_PARENTESCO/m, 'export const OPCOES_PARENTESCO')
  .replace(/^type ManageMembersData/m, 'export type ManageMembersData')
  .replace(/^type ManagedMember/m, 'export type ManagedMember')
  .replace(/\nexport const OPCOES_PARENTESCO[\s\S]*$/m, '');
fs.writeFileSync(path.join(root, 'lib/manageMembers/shared.ts'), shared);

console.log('Fixed MembersClassPanel, MembersClass, shared.ts');
