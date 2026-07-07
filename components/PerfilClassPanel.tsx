import { MinisterialProfileForm } from '@/components/MinisterialProfileForm';
import { PerfilClass, type PerfilClassAction } from '@/components/PerfilClass';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import { withReturnRoute } from '@/lib/dashboardReturnNavigation';
import { loadGroupedManageScreenAccess } from '@/lib/groupedManageAccess';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

/** Container com dados e navegação — compõe o PerfilClass stateless. */
export function PerfilClassPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [manageProfile, setManageProfile] = useState(false);
  const [manageMembers, setManageMembers] = useState(false);
  const [ministerialFormVisible, setMinisterialFormVisible] = useState(false);

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
    void navigateWithScreenAccess(
      router,
      '/manage-profile',
      ACCESS_SCREEN.manageProfile,
      withReturnRoute(
        '/perfil',
        userPhone ? { phone: encodeURIComponent(userPhone) } : {}
      ),
      { method: 'push' }
    );
  }, [router, userPhone]);

  const openManageMembers = useCallback(() => {
    void navigateWithScreenAccess(
      router,
      '/manage-members',
      ACCESS_SCREEN.manageMembers,
      withReturnRoute(
        '/perfil',
        userPhone ? { phone: encodeURIComponent(userPhone) } : {}
      ),
      { method: 'push' }
    );
  }, [router, userPhone]);

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
