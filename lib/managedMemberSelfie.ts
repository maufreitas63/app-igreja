import {
  findProfileIdForMember,
  upsertProfileForManagedMember,
  type MemberProfileInput,
} from '@/lib/memberProfiles';
import { uploadSelfieInput } from '@/lib/selfie';
import { supabase } from '@/lib/supabase';

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
  const { error } = await supabase
    .from('profiles')
    .update({ selfie_url: fileName })
    .eq('id', profileId);

  if (error) {
    throw error;
  }
}
