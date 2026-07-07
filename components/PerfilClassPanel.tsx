import { MinisterialProfileForm } from '@/components/MinisterialProfileForm';
import { MembersClassPanel } from '@/components/MembersClassPanel';
import { PerfilClass, type PerfilClassAction } from '@/components/PerfilClass';
import { ProfileClassPanel } from '@/components/ProfileClassPanel';
import { loadGroupedManageScreenAccess } from '@/lib/groupedManageAccess';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

/** Container com dados e navegação — compõe o PerfilClass stateless. */
export function PerfilClassPanel() {
  const [loading, setLoading] = useState(true);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [manageProfile, setManageProfile] = useState(false);
  const [manageMembers, setManageMembers] = useState(false);
  const [ministerialFormVisible, setMinisterialFormVisible] = useState(false);
  const [profileClassVisible, setProfileClassVisible] = useState(false);
  const [membersClassVisible, setMembersClassVisible] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);

      try {
        const phone = await getStoredUserPhone();
        const sessionProfile = phone ? await loadEffectiveSessionProfile(phone) : null;
        const resolvedProfileId = sessionProfile?.id?.trim() ?? null;

        if (!active) {
          return;
        }

        setUserPhone(phone);
        setProfileId(resolvedProfileId);

        if (!resolvedProfileId) {
          setManageProfile(false);
          setManageMembers(false);
          return;
        }

        const access = await loadGroupedManageScreenAccess(resolvedProfileId);

        if (!active) {
          return;
        }

        setManageProfile(access.manageProfile);
        setManageMembers(access.manageMembers);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const openManageProfile = useCallback(() => {
    setProfileClassVisible(true);
  }, []);

  const openManageMembers = useCallback(() => {
    setMembersClassVisible(true);
  }, []);

  const openMinisterialProfile = useCallback(() => {
    setMinisterialFormVisible(true);
  }, []);

  const actions = useMemo(() => {
    const items: PerfilClassAction[] = [];

    if (manageProfile) {
      items.push({
        key: 'manage-profile',
        label: 'Dados Cadastrais',
        icon: 'assignment-ind',
        onPress: openManageProfile,
      });
    }

    if (manageMembers) {
      items.push({
        key: 'manage-members',
        label: 'Gerenciar Família',
        icon: 'family-restroom',
        onPress: openManageMembers,
      });
    }

    items.push({
      key: 'ministerial-profile',
      label: 'Perfil Ministerial',
      icon: 'quiz',
      onPress: openMinisterialProfile,
    });

    return items;
  }, [manageMembers, manageProfile, openManageMembers, openManageProfile, openMinisterialProfile]);

  if (membersClassVisible) {
    return (
      <>
        <MembersClassPanel
          embedded
          phoneParam={userPhone}
          onBack={() => setMembersClassVisible(false)}
        />
        <MinisterialProfileForm
          visible={ministerialFormVisible}
          profileId={profileId}
          onClose={() => setMinisterialFormVisible(false)}
        />
      </>
    );
  }

  if (profileClassVisible) {
    return (
      <>
        <ProfileClassPanel
          embedded
          phoneParam={userPhone}
          onBack={() => setProfileClassVisible(false)}
        />
        <MinisterialProfileForm
          visible={ministerialFormVisible}
          profileId={profileId}
          onClose={() => setMinisterialFormVisible(false)}
        />
      </>
    );
  }

  return (
    <>
      <PerfilClass loading={loading} actions={actions} />
      <MinisterialProfileForm
        visible={ministerialFormVisible}
        profileId={profileId}
        onClose={() => setMinisterialFormVisible(false)}
      />
    </>
  );
}
