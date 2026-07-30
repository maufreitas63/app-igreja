import { MinisterialProfileForm } from '@/components/MinisterialProfileForm';
import { MembersClassPanel } from '@/components/MembersClassPanel';
import { PerfilClass, type PerfilClassAction } from '@/components/PerfilClass';
import { ProfileClassPanel } from '@/components/ProfileClassPanel';
import { DiscipleshipTrailPanel } from '@/components/DiscipleshipTrailPanel';
import { loadGroupedManageScreenAccess } from '@/lib/groupedManageAccess';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  const [discipleshipTrailVisible, setDiscipleshipTrailVisible] = useState(false);
  const loadGenerationRef = useRef(0);

  const reloadAccess = useCallback(async (options?: { forceRefresh?: boolean }) => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);

    try {
      const sessionProfile = await loadEffectiveSessionProfile();
      const resolvedProfileId = sessionProfile?.id?.trim() ?? null;
      const phone = sessionProfile?.phone?.trim() ?? null;

      if (generation !== loadGenerationRef.current) {
        return;
      }

      setUserPhone(phone);
      setProfileId(resolvedProfileId);

      if (!resolvedProfileId) {
        setManageProfile(false);
        setManageMembers(false);
        return;
      }

      const access = await loadGroupedManageScreenAccess(resolvedProfileId, {
        forceRefresh: options?.forceRefresh === true,
      });

      if (generation !== loadGenerationRef.current) {
        return;
      }

      setManageProfile(access.manageProfile);
      setManageMembers(access.manageMembers);
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadAccess({ forceRefresh: true });
    }, [reloadAccess])
  );

  const openManageProfile = useCallback(() => {
    setProfileClassVisible(true);
  }, []);

  const openManageMembers = useCallback(() => {
    setMembersClassVisible(true);
  }, []);

  const openMinisterialProfile = useCallback(() => {
    setMinisterialFormVisible(true);
  }, []);

  const openDiscipleshipTrail = useCallback(() => {
    setDiscipleshipTrailVisible(true);
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

    // Sempre disponível no Perfil (como Perfil Ministerial); a tela/SQL tratam permissão e seed.
    items.push({
      key: 'discipleship-trail',
      label: 'Trilha de Discipulado',
      icon: 'school',
      onPress: openDiscipleshipTrail,
    });

    return items;
  }, [
    manageMembers,
    manageProfile,
    openDiscipleshipTrail,
    openManageMembers,
    openManageProfile,
    openMinisterialProfile,
  ]);

  if (discipleshipTrailVisible) {
    return (
      <View style={styles.embeddedPanel}>
        <View style={styles.embeddedHeader}>
          <Pressable
            onPress={() => setDiscipleshipTrailVisible(false)}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Voltar ao perfil"
          >
            <FontAwesome name="chevron-left" size={14} color={MINIMAL_UI.blueDark} />
            <Text style={styles.backButtonText}>Perfil</Text>
          </Pressable>
        </View>
        <DiscipleshipTrailPanel />
      </View>
    );
  }

  if (membersClassVisible) {
    return (
      <View style={styles.embeddedPanel}>
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
      </View>
    );
  }

  if (profileClassVisible) {
    return (
      <View style={styles.embeddedPanel}>
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
      </View>
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

const styles = StyleSheet.create({
  embeddedPanel: {
    flex: 1,
    minHeight: 0,
  },
  embeddedHeader: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '700',
  },
});
