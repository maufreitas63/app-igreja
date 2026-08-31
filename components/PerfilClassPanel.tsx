import { DigitalIDCard } from '@/components/DigitalIDCard';
import { MeusLivrosRetiradosPanel } from '@/components/MeusLivrosRetiradosPanel';
import { MembersClassPanel } from '@/components/MembersClassPanel';
import { PerfilClass, type PerfilClassAction } from '@/components/PerfilClass';
import { ProfileClassPanel } from '@/components/ProfileClassPanel';
import { DiscipleshipTrailPanel } from '@/components/DiscipleshipTrailPanel';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { ACCESS_SCREEN, sessionHasAccess } from '@/lib/accessControl';
import { loadGroupedManageScreenAccess } from '@/lib/groupedManageAccess';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import {
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
  withReturnRoute,
} from '@/lib/dashboardReturnNavigation';
import { navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';

/** Container com dados e navegação — compõe o PerfilClass stateless. */
export function PerfilClassPanel() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
    fallbackDashboardCard: 'grouped_manage',
  });
  const [loading, setLoading] = useState(true);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [manageProfile, setManageProfile] = useState(false);
  const [manageMembers, setManageMembers] = useState(false);
  const [canOpenDiscipleshipTrail, setCanOpenDiscipleshipTrail] = useState(false);
  const [canOpenExpenseReport, setCanOpenExpenseReport] = useState(false);
  const [profileClassVisible, setProfileClassVisible] = useState(false);
  const [membersClassVisible, setMembersClassVisible] = useState(false);
  const [discipleshipTrailVisible, setDiscipleshipTrailVisible] = useState(false);
  const [digitalIdVisible, setDigitalIdVisible] = useState(false);
  const [myBooksVisible, setMyBooksVisible] = useState(false);
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

      if (!resolvedProfileId) {
        setManageProfile(false);
        setManageMembers(false);
        setCanOpenDiscipleshipTrail(false);
        setCanOpenExpenseReport(false);
        return;
      }

      const [access, trailAllowed, expenseAllowed] = await Promise.all([
        loadGroupedManageScreenAccess(resolvedProfileId, {
          forceRefresh: options?.forceRefresh === true,
        }),
        sessionHasAccess('screen', ACCESS_SCREEN.discipleshipTrail, 'view'),
        sessionHasAccess('screen', ACCESS_SCREEN.expenseReport, 'view'),
      ]);

      if (generation !== loadGenerationRef.current) {
        return;
      }

      setManageProfile(access.manageProfile);
      setManageMembers(access.manageMembers);
      setCanOpenDiscipleshipTrail(trailAllowed);
      setCanOpenExpenseReport(expenseAllowed);
      if (!trailAllowed) {
        setDiscipleshipTrailVisible(false);
      }
    } catch {
      if (generation === loadGenerationRef.current) {
        setManageProfile(false);
        setManageMembers(false);
        setCanOpenDiscipleshipTrail(false);
        setCanOpenExpenseReport(false);
      }
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

  const openDigitalIdCard = useCallback(() => {
    setDigitalIdVisible(true);
  }, []);

  const openMyBooks = useCallback(() => {
    setMyBooksVisible(true);
  }, []);

  const openManageProfile = useCallback(() => {
    setProfileClassVisible(true);
  }, []);

  const openManageMembers = useCallback(() => {
    setMembersClassVisible(true);
  }, []);

  const openExpenseReport = useCallback(() => {
    if (!canOpenExpenseReport) {
      Toast.show({
        type: 'error',
        text1: 'Acesso negado',
        text2: 'Você não tem permissão para abrir Reembolsos.',
      });
      return;
    }

    void navigateWithScreenAccess(
      router,
      '/expense-report',
      ACCESS_SCREEN.expenseReport,
      withReturnRoute('/perfil'),
      { deniedMessage: 'Você não tem permissão para abrir Reembolsos.' }
    );
  }, [canOpenExpenseReport, router]);

  const openDiscipleshipTrail = useCallback(() => {
    if (!canOpenDiscipleshipTrail) {
      Toast.show({
        type: 'error',
        text1: 'Acesso negado',
        text2: 'Você não tem permissão para abrir a Trilha de Discipulado.',
      });
      return;
    }
    setDiscipleshipTrailVisible(true);
  }, [canOpenDiscipleshipTrail]);

  const actions = useMemo(() => {
    const items: PerfilClassAction[] = [
      {
        key: 'digital-id',
        label: 'Carteirinha Digital',
        icon: 'badge',
        onPress: openDigitalIdCard,
      },
    ];

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

    // Perfil Ministerial vive na lição 5.1 da Trilha («Descobrindo meus Dons»).
    if (canOpenDiscipleshipTrail) {
      items.push({
        key: 'discipleship-trail',
        label: 'Trilha de Discipulado',
        icon: 'school',
        onPress: openDiscipleshipTrail,
      });
    }

    if (canOpenExpenseReport) {
      items.push({
        key: 'expense-report',
        label: 'Reembolsos',
        icon: 'receipt-long',
        onPress: openExpenseReport,
      });
    }

    items.push({
      key: 'my-books',
      label: 'Cantinho da Leitura',
      icon: 'menu-book',
      onPress: openMyBooks,
    });

    return items;
  }, [
    canOpenDiscipleshipTrail,
    canOpenExpenseReport,
    manageMembers,
    manageProfile,
    openDigitalIdCard,
    openDiscipleshipTrail,
    openExpenseReport,
    openManageMembers,
    openManageProfile,
    openMyBooks,
  ]);

  if (myBooksVisible) {
    return (
      <View style={styles.embeddedPanel}>
        <MeusLivrosRetiradosPanel onBack={() => setMyBooksVisible(false)} />
      </View>
    );
  }

  if (digitalIdVisible) {
    return (
      <View style={styles.embeddedPanel}>
        <View style={styles.embeddedHeader}>
          <Pressable
            onPress={() => setDigitalIdVisible(false)}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Voltar ao perfil"
          >
            <FontAwesome name="chevron-left" size={14} color={MINIMAL_UI.blueDark} />
            <Text style={styles.backButtonText}>Perfil</Text>
          </Pressable>
        </View>
        <DigitalIDCard />
      </View>
    );
  }

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
      </View>
    );
  }

  return (
    <View style={styles.hub}>
      <PerfilClass loading={loading} actions={actions} />
      <CloseFooterBar onPress={returnToCaller} />
    </View>
  );
}

const styles = StyleSheet.create({
  hub: {
    flex: 1,
    minHeight: 0,
  },
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
