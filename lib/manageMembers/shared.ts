import { resolveKidsTeensStatusFromBirthDate } from '@/lib/kidsTeensStatus';
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
