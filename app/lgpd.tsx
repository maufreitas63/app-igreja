import {
  buildLgpdDeclineMessage,
  buildLgpdTermsText,
  DEFAULT_LGPD_ENTITY_NAME,
  loadLgpdEntityName,
  loadLgpdTermsText,
} from '@/lib/lgpdTerms';
import {
  loadProfileByPhone,
  resolveRegisteredUserSessionRoute,
} from '@/lib/profileOnboarding';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { supabase } from '@/lib/supabase';
import { useLgpdTermsScrollGate } from '@/hooks/useLgpdTermsScrollGate';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { getStoredProfileId } from '@/lib/userSession';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRejectTotemPhoneFromMemberRoutes } from '@/hooks/useRejectTotemPhoneFromMemberRoutes';

const normalizePhone = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

async function loadProfileId(phoneParam: string | null): Promise<string | null> {
  if (!phoneParam) {
    return getStoredProfileId();
  }

  const attempts = [phoneParam, normalizePhone(phoneParam)].filter(Boolean);

  for (const phoneAttempt of attempts) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phoneAttempt)
      .maybeSingle();

    if (data?.id) {
      return String(data.id);
    }
  }

  return null;
}

async function updateLgpdAccepted(profileId: string, accepted: boolean) {
  const rpcResult = await supabase.rpc('update_profile_field', {
    p_profile_id: profileId,
    p_field: 'lgpd_accepted',
    p_value: accepted,
  });

  if (!rpcResult.error && rpcResult.data) {
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ lgpd_accepted: accepted })
    .eq('id', profileId);

  if (error) {
    throw error;
  }
}

export default function LgpdScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const phoneParam = params.phone ? decodeURIComponent(params.phone as string) : null;
  useRejectTotemPhoneFromMemberRoutes(phoneParam);

  useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.lgpd,
    deniedMessage: 'Você não tem permissão para abrir os termos de privacidade.',
    skipCheck: Boolean(phoneParam),
  });

  const [profileId, setProfileId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acceptedLGPD, setAcceptedLGPD] = useState<boolean | null>(null);
  const [lgpdTermsText, setLgpdTermsText] = useState(() => buildLgpdTermsText(DEFAULT_LGPD_ENTITY_NAME));
  const [entityName, setEntityName] = useState(DEFAULT_LGPD_ENTITY_NAME);
  const {
    hasScrolledToBottom,
    resetScrollGate,
    onTermsViewportLayout,
    onTermsContentSizeChange,
    onTermsScroll,
  } = useLgpdTermsScrollGate();

  const navigateAfterLgpd = useCallback(async () => {
    if (!phoneParam) {
      router.replace({ pathname: '/manage-profile' });
      return;
    }

    const profile = await loadProfileByPhone(phoneParam);
    const route = resolveRegisteredUserSessionRoute(profile, phoneParam);

    if (route) {
      router.replace(route);
    }
  }, [phoneParam, router]);

  const goBackToManageProfile = useCallback(() => {
    router.replace({
      pathname: '/manage-profile',
      params: phoneParam ? { phone: encodeURIComponent(phoneParam) } : {},
    });
  }, [phoneParam, router]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [nextTermsText, nextEntityName] = await Promise.all([
          loadLgpdTermsText(),
          loadLgpdEntityName(),
        ]);

        if (!active) {
          return;
        }

        setLgpdTermsText(nextTermsText);
        setEntityName(nextEntityName);
        resetScrollGate();
      } catch (error) {
        console.error('Erro ao carregar termos LGPD:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [resetScrollGate]);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoadingProfile(true);

      try {
        const nextProfileId = await loadProfileId(phoneParam);

        if (!active) {
          return;
        }

        if (!nextProfileId) {
          Alert.alert('Erro', 'Perfil não encontrado.');
          goBackToManageProfile();
          return;
        }

        setProfileId(nextProfileId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível carregar o perfil.';
        Alert.alert('Erro', message);
        goBackToManageProfile();
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [goBackToManageProfile, phoneParam]);

  const handleLGPDChoice = (choice: boolean) => {
    if (!hasScrolledToBottom) {
      Alert.alert('Atenção', 'Role os termos até o final para confirmar a leitura.');
      return;
    }

    if (choice === false) {
      Alert.alert('Privacidade', buildLgpdDeclineMessage(entityName));
    }

    setAcceptedLGPD(choice);
  };

  const handleSaveChoice = useCallback(async () => {
    if (acceptedLGPD === null) {
      Alert.alert('Atenção', 'Selecione se você aceita ou não os termos.');
      return;
    }

    if (!profileId) {
      Alert.alert('Erro', 'Perfil não encontrado.');
      return;
    }

    setSaving(true);

    try {
      await updateLgpdAccepted(profileId, acceptedLGPD);
      Alert.alert(
        'Sucesso',
        acceptedLGPD
          ? 'Termos aceitos.'
          : 'Preferência de LGPD registrada.'
      );
      await navigateAfterLgpd();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a preferência de LGPD.';
      Alert.alert('Erro', message);
    } finally {
      setSaving(false);
    }
  }, [acceptedLGPD, navigateAfterLgpd, profileId]);

  return (
    <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.body}>
          <Text style={styles.title}>Termos de Uso e Privacidade (LGPD)</Text>

          {loadingProfile ? (
            <ActivityIndicator color="#10b981" style={styles.loader} />
          ) : (
            <View style={styles.formContainer}>
              <View
                style={styles.lgpdBox}
                onLayout={(event) => onTermsViewportLayout(event.nativeEvent.layout.height)}
              >
                <ScrollView
                  scrollEventThrottle={16}
                  onScroll={onTermsScroll}
                  onScrollEndDrag={onTermsScroll}
                  onMomentumScrollEnd={onTermsScroll}
                  onContentSizeChange={(_, height) => onTermsContentSizeChange(height)}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.lgpdTitle}>Termos de Uso e Privacidade (LGPD)</Text>
                  <Text style={styles.lgpdText}>{lgpdTermsText}</Text>
                </ScrollView>
              </View>
              <Text style={styles.hintText}>
                {hasScrolledToBottom ? '✅ Termos lidos.' : '↓ Role para ler tudo ↓'}
              </Text>

              <View style={styles.rowContainer}>
                <TouchableOpacity style={styles.checkboxWrapper} onPress={() => handleLGPDChoice(true)}>
                  <View style={[styles.checkbox, acceptedLGPD === true && styles.checkboxCheckedGreen]} />
                  <Text style={styles.checkboxLabel}>Li e aceito</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.checkboxWrapper} onPress={() => handleLGPDChoice(false)}>
                  <View style={[styles.checkbox, acceptedLGPD === false && styles.checkboxCheckedRed]} />
                  <Text style={styles.checkboxLabel}>Li e não concordo</Text>
                </TouchableOpacity>
              </View>

              {acceptedLGPD === true ? (
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => void handleSaveChoice()}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#020617" />
                  ) : (
                    <Text style={styles.btnText}>Confirmar</Text>
                  )}
                </TouchableOpacity>
              ) : null}

              {acceptedLGPD === false ? (
                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => void handleSaveChoice()}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.btnTextSecondary}>Concluir</Text>
                  )}
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.backLink}
                onPress={goBackToManageProfile}
                disabled={saving}
              >
                <Text style={styles.backLinkText}>Voltar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  formContainer: {
    flex: 1,
    gap: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  loader: {
    marginTop: 40,
  },
  lgpdBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    height: 240,
    padding: 15,
    borderRadius: 15,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  lgpdTitle: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  lgpdText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
  },
  hintText: {
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 12,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 25,
  },
  checkboxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    marginRight: 8,
  },
  checkboxCheckedGreen: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkboxCheckedRed: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  checkboxLabel: {
    color: '#FFF',
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: '#10b981',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  btnSecondary: {
    backgroundColor: '#475569',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  btnText: {
    color: '#020617',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnTextSecondary: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  backLink: {
    marginTop: 18,
    alignItems: 'center',
  },
  backLinkText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});
