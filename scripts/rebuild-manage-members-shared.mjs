import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const source = execSync('git show ba15f5c^:app/manage-members.tsx', {
  cwd: root,
  encoding: 'utf8',
});
const lines = source.split(/\r?\n/);

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
import { upsertFamilyMember } from '@/lib/upsertFamilyMember';
import Toast from 'react-native-toast-message';
`;

let sharedBlock = lines.slice(80, 379).join('\n');
sharedBlock = sharedBlock
  .replace(/^const OPCOES_PARENTESCO = \[\.\.\.FAMILY_RELATIONSHIP_OPTIONS\];\r?\n\r?\n/, '')
  .replace(/^type ManageMembersData = \{[\s\S]*?^};\r?\n\r?\n/m, '')
  .replace(/^type ManagedMember = \{[\s\S]*?^};\r?\n\r?\n/m, '');

const tail = `
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

const out = `${sharedImports}\n${sharedBlock}${tail}`;
fs.writeFileSync(path.join(root, 'lib/manageMembers/shared.ts'), out);
console.log('Wrote lib/manageMembers/shared.ts', out.split(/\r?\n/).length, 'lines');
