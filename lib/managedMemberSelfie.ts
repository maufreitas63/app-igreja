import {
  findProfileIdForMember,
  upsertProfileForManagedMember,
  type MemberProfileInput,
} from '@/lib/memberProfiles';
import { saveProfileSelfieUrl, uploadSelfieInput } from '@/lib/selfie';

export async function attachSelfieToManagedMemberProfile(input: {
  member: MemberProfileInput;
  familyId: string;
  profileId?: string | null;
  photo: string;
}): Promise<void> {
  const photo = input.photo.trim();

  if (!photo) {
    return;
  }

  let profileId =
    input.profileId?.trim() || (await findProfileIdForMember(input.member)) || null;

  if (!profileId) {
    profileId = await upsertProfileForManagedMember(
      input.member,
      input.familyId,
      null,
      null,
      input.profileId
    );
  }

  if (!profileId) {
    throw new Error('Não foi possível vincular a fotografia: perfil do membro não encontrado.');
  }

  const fileName = await uploadSelfieInput(photo);
  await saveProfileSelfieUrl(profileId, fileName);
}
