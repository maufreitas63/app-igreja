import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useEntityPrefix } from '@/context/EntityPrefixContext';
import { useLgpdScreenAccess } from '@/hooks/useLgpdScreenAccess';
import { useLgpdTermsScrollGate } from '@/hooks/useLgpdTermsScrollGate';
import { useRejectTotemPhoneFromMemberRoutes } from '@/hooks/useRejectTotemPhoneFromMemberRoutes';
import { useWebDocumentTitle } from '@/hooks/useWebDocumentTitle';
import { isLgpdAtivoEnabled } from '@/lib/appParameters';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { isMinimalPresentationRoute } from '@/lib/dashboardReturnNavigation';
import { traceClick } from '@/lib/devClickTrace';
import {
  buildLgpdDeclineMessage,
  buildLgpdTermsText,
  DEFAULT_LGPD_ENTITY_NAME,
  loadLgpdEntityName,
  loadLgpdTermsText,
} from '@/lib/lgpdTerms';
import { MINIMAL_UI, MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
import {
  buildAppIndexRoute,
  loadProfileByPhone,
  resolveRegisteredUserSessionRoute,
} from '@/lib/profileOnboarding';
import {
  pickSelfieFromWeb,
  saveProfileSelfieUrl,
  selectSelfiePictureSize,
  uploadSelfieInput,
} from '@/lib/selfie';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type LgpdStage = 'FORM' | 'CAMERA' | 'CONFIRM';

const normalizePhone = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

async function loadProfileId(phoneParam: string | null): Promise<string | null> {
  if (!phoneParam) {
    return resolveEffectiveProfileId();
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
  const isMinimalPresentation = isMinimalPresentationRoute(params.presentation);
  useRejectTotemPhoneFromMemberRoutes(phoneParam);

  const { status: accessStatus, sessionProfileId } = useLgpdScreenAccess();

  useEffect(() => {
    traceClick('lgpd', 'screen-mounted', {
      phoneParam,
      isMinimalPresentation,
      presentation: params.presentation,
    });
  }, [isMinimalPresentation, params.presentation, phoneParam]);

  useEffect(() => {
    traceClick('lgpd', 'access-status', { accessStatus });
  }, [accessStatus]);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acceptedLGPD, setAcceptedLGPD] = useState<boolean | null>(null);
  const [lgpdTermsText, setLgpdTermsText] = useState(() => buildLgpdTermsText(DEFAULT_LGPD_ENTITY_NAME));
  const [entityName, setEntityName] = useState(DEFAULT_LGPD_ENTITY_NAME);
  const [stage, setStage] = useState<LgpdStage>('FORM');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const {
    hasScrolledToBottom,
    resetScrollGate,
    onTermsViewportLayout,
    onTermsContentSizeChange,
    onTermsScroll,
  } = useLgpdTermsScrollGate();
  const { prefix: entityPrefix } = useEntityPrefix();

  const useMinimalTheme = isMinimalPresentation;

  useWebDocumentTitle(`Termos LGPD — ${entityPrefix}`);

  const navigateAfterLgpd = useCallback(async () => {
    const lgpdAtivo = await isLgpdAtivoEnabled();

    if (!lgpdAtivo) {
      if (phoneParam) {
        router.replace(buildAppIndexRoute(phoneParam));
      } else {
        router.replace(buildAppIndexRoute(''));
      }
      return;
    }

    if (isMinimalPresentation) {
      router.replace('/(tabs)');
      return;
    }

    if (!phoneParam) {
      router.replace({ pathname: '/manage-profile' });
      return;
    }

    const profile = await loadProfileByPhone(phoneParam);
    const route = resolveRegisteredUserSessionRoute(profile, phoneParam, lgpdAtivo);

    if (route) {
      router.replace(route);
    }
  }, [isMinimalPresentation, phoneParam, router]);

  const goBack = useCallback(() => {
    traceClick('lgpd', 'go-back', { isMinimalPresentation, phoneParam });

    if (isMinimalPresentation) {
      router.replace('/(tabs)');
      return;
    }

    router.replace({
      pathname: '/manage-profile',
      params: phoneParam ? { phone: encodeURIComponent(phoneParam) } : {},
    });
  }, [isMinimalPresentation, phoneParam, router]);

  const leaveAfterProfileError = useCallback(
    (title: string, message: string) => {
      if (isMinimalPresentation) {
        traceClick('lgpd', 'profile-error-minimal-stay', { title, message });
        Alert.alert(title, message);
        return;
      }

      Alert.alert(title, message, [{ text: 'OK', onPress: () => goBack() }]);
    },
    [goBack, isMinimalPresentation]
  );

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
    if (isMinimalPresentation) {
      return;
    }

    let active = true;

    void (async () => {
      try {
        const lgpdAtivo = await isLgpdAtivoEnabled();

        if (!active || lgpdAtivo) {
          return;
        }

        if (phoneParam) {
          router.replace(buildAppIndexRoute(phoneParam));
        } else {
          router.replace(buildAppIndexRoute(''));
        }
      } catch (error) {
        console.error('Erro ao verificar LGPD_Ativo:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [isMinimalPresentation, phoneParam, router]);

  useEffect(() => {
    if (accessStatus !== 'allowed') {
      return;
    }

    let active = true;

    void (async () => {
      setLoadingProfile(true);

      try {
        const nextProfileId = phoneParam ? await loadProfileId(phoneParam) : sessionProfileId;

        if (!active) {
          return;
        }

        const resolvedProfileId = nextProfileId ?? sessionProfileId;

        if (!resolvedProfileId) {
          traceClick('lgpd', 'profile-not-found', { phoneParam, sessionProfileId });
          leaveAfterProfileError('Erro', 'Perfil não encontrado.');
          return;
        }

        traceClick('lgpd', 'profile-loaded', { profileId: resolvedProfileId });
        setProfileId(resolvedProfileId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível carregar o perfil.';
        leaveAfterProfileError('Erro', message);
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [accessStatus, leaveAfterProfileError, phoneParam, sessionProfileId]);

  const handleLGPDChoice = (choice: boolean) => {
    if (!hasScrolledToBottom) {
      Alert.alert('Atenção', 'Role os termos até o final para confirmar a leitura.');
      return;
    }

    if (choice === false) {
      Alert.alert('Privacidade', buildLgpdDeclineMessage(entityName));
    }

    setAcceptedLGPD(choice);
    setPhoto(null);
    setStage('FORM');
  };

  const handleOpenCamera = async () => {
    if (Platform.OS === 'web') {
      try {
        const selectedSelfie = await pickSelfieFromWeb();
        if (!selectedSelfie) {
          return;
        }

        setPhoto(selectedSelfie);
        setStage('CONFIRM');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Não foi possível carregar a selfie selecionada.';
        Alert.alert('Erro', message);
      }
      return;
    }

    if (cameraPermission?.granted) {
      setIsCameraReady(false);
      setPictureSize(null);
      setStage('CAMERA');
      return;
    }

    const permissionResponse = await requestCameraPermission();

    if (!permissionResponse.granted) {
      Alert.alert(
        'Permissão necessária',
        'Para tirar a selfie biométrica, permita o uso da câmera no dispositivo.'
      );
      return;
    }

    setIsCameraReady(false);
    setPictureSize(null);
    setStage('CAMERA');
  };

  const handleCameraReady = async () => {
    setIsCameraReady(true);

    try {
      const availableSizes = await cameraRef.current?.getAvailablePictureSizesAsync?.();
      if (Array.isArray(availableSizes) && availableSizes.length > 0) {
        setPictureSize(selectSelfiePictureSize(availableSizes));
      }
    } catch (error) {
      console.warn('Não foi possível carregar os tamanhos de foto da câmera.', error);
    }
  };

  const handleSaveDecline = useCallback(async () => {
    if (!profileId) {
      Alert.alert('Erro', 'Perfil não encontrado.');
      return;
    }

    setSaving(true);

    try {
      await updateLgpdAccepted(profileId, false);
      Alert.alert('Sucesso', 'Preferência de LGPD registrada.');
      await navigateAfterLgpd();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível salvar a preferência de LGPD.';
      Alert.alert('Erro', message);
    } finally {
      setSaving(false);
    }
  }, [navigateAfterLgpd, profileId]);

  const handleConfirmAccept = useCallback(async () => {
    if (!photo) {
      Alert.alert('Atenção', 'Tire a selfie biométrica antes de confirmar.');
      return;
    }

    if (!profileId) {
      Alert.alert('Erro', 'Perfil não encontrado.');
      return;
    }

    setSaving(true);

    try {
      const fileName = await uploadSelfieInput(photo);
      await saveProfileSelfieUrl(profileId, fileName);
      await updateLgpdAccepted(profileId, true);
      Alert.alert('Sucesso', 'Termos aceitos e selfie registrada.');
      await navigateAfterLgpd();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível concluir o consentimento LGPD.';
      Alert.alert('Erro', message);
    } finally {
      setSaving(false);
    }
  }, [navigateAfterLgpd, photo, profileId]);

  const renderCameraStage = () => (
    <View style={styles.cameraRoot}>
      <View style={styles.selfieCameraShell}>
        <Text style={[styles.selfieCameraHint, useMinimalTheme && styles.selfieCameraHintMinimal]}>
          Afaste um pouco o rosto e centralize-o dentro do quadro.
        </Text>
        <View style={[styles.selfieCameraFrame, useMinimalTheme && styles.selfieCameraFrameMinimal]}>
          <CameraView
            style={[styles.camera, { transform: [{ scaleX: -1 }] }]}
            ref={cameraRef}
            facing="front"
            mirror={false}
            zoom={0}
            pictureSize={pictureSize ?? undefined}
            {...(Platform.OS === 'android' ? { ratio: '4:3' as const } : {})}
            onCameraReady={() => void handleCameraReady()}
            onMountError={(event) => {
              type MountErr = { message?: string; nativeEvent?: { message?: string } };
              const e = event as MountErr;
              const message = e.message ?? e.nativeEvent?.message ?? '';
              Alert.alert('Erro na câmera', message || 'Não foi possível abrir a câmera.');
              setStage('FORM');
            }}
          />
        </View>
      </View>
      <TouchableOpacity
        style={[styles.btnCameraBottom, !isCameraReady && styles.btnCameraDisabled]}
        disabled={!isCameraReady}
        onPress={async () => {
          const pic = await cameraRef.current?.takePictureAsync({ quality: 0.1 });
          if (pic) {
            setPhoto(pic.uri);
            setStage('CONFIRM');
          }
        }}
      >
        <Text style={styles.btnText}>{isCameraReady ? 'Capturar Selfie' : 'Preparando câmera...'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFormStage = () => (
    <>
      {useMinimalTheme ? (
        <Text style={styles.sectionTitle}>Termos de Uso e Privacidade (LGPD)</Text>
      ) : (
        <Text style={styles.title}>Termos de Uso e Privacidade (LGPD)</Text>
      )}

      {loadingProfile ? (
        <ActivityIndicator color={useMinimalTheme ? VIGILANCE_SCALES_UI.accent : '#10b981'} style={styles.loader} />
      ) : stage === 'CONFIRM' && photo ? (
        <View style={styles.confirmContainer}>
          <View style={[styles.previewImageFrame, useMinimalTheme && styles.previewImageFrameMinimal]}>
            <Image source={{ uri: photo }} style={styles.previewImage} resizeMode="contain" />
          </View>
          <TouchableOpacity
            style={[styles.btnPrimary, useMinimalTheme && styles.btnPrimaryMinimal]}
            onPress={() => void handleConfirmAccept()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={useMinimalTheme ? '#FFFFFF' : '#020617'} />
            ) : (
              <Text style={[styles.btnText, useMinimalTheme && styles.btnTextOnPrimary]}>Confirmar</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.repeatPhotoButton} onPress={() => void handleOpenCamera()}>
            <Text style={[styles.repeatPhotoText, useMinimalTheme && styles.repeatPhotoTextMinimal]}>
              Repetir Foto
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.formContainer}>
          <View
            style={[styles.lgpdBox, useMinimalTheme && styles.lgpdBoxMinimal]}
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
              {!useMinimalTheme ? (
                <Text style={styles.lgpdTitle}>Termos de Uso e Privacidade (LGPD)</Text>
              ) : null}
              <Text style={[styles.lgpdText, useMinimalTheme && styles.lgpdTextMinimal]}>{lgpdTermsText}</Text>
            </ScrollView>
          </View>
          <Text style={[styles.hintText, useMinimalTheme && styles.hintTextMinimal]}>
            {hasScrolledToBottom ? '✅ Termos lidos.' : '↓ Role para ler tudo ↓'}
          </Text>

          <View style={styles.rowContainer}>
            <TouchableOpacity style={styles.checkboxWrapper} onPress={() => handleLGPDChoice(true)}>
              <View
                style={[
                  styles.checkbox,
                  useMinimalTheme && styles.checkboxMinimal,
                  acceptedLGPD === true && styles.checkboxCheckedGreen,
                  acceptedLGPD === true && useMinimalTheme && styles.checkboxCheckedGreenMinimal,
                ]}
              />
              <Text style={[styles.checkboxLabel, useMinimalTheme && styles.checkboxLabelMinimal]}>
                Li e aceito
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkboxWrapper} onPress={() => handleLGPDChoice(false)}>
              <View
                style={[
                  styles.checkbox,
                  useMinimalTheme && styles.checkboxMinimal,
                  acceptedLGPD === false && styles.checkboxCheckedRed,
                ]}
              />
              <Text style={[styles.checkboxLabel, useMinimalTheme && styles.checkboxLabelMinimal]}>
                Li e não concordo
              </Text>
            </TouchableOpacity>
          </View>

          {acceptedLGPD === true ? (
            <TouchableOpacity
              style={[styles.btnPrimary, useMinimalTheme && styles.btnPrimaryMinimal]}
              onPress={() => void handleOpenCamera()}
            >
              <Text style={[styles.btnText, useMinimalTheme && styles.btnTextOnPrimary]}>
                Tirar Selfie Biométrica
              </Text>
            </TouchableOpacity>
          ) : null}

          {acceptedLGPD === false ? (
            <TouchableOpacity
              style={[styles.btnSecondary, useMinimalTheme && styles.btnSecondaryMinimal]}
              onPress={() => void handleSaveDecline()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={useMinimalTheme ? VIGILANCE_SCALES_UI.accent : '#FFF'} />
              ) : (
                <Text style={[styles.btnTextSecondary, useMinimalTheme && styles.btnTextSecondaryMinimal]}>
                  Concluir
                </Text>
              )}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.backLink} onPress={goBack} disabled={saving}>
            <Text style={[styles.backLinkText, useMinimalTheme && styles.backLinkTextMinimal]}>Voltar</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const renderContent = () => (stage === 'CAMERA' ? renderCameraStage() : renderFormStage());

  return (
    <ScreenAccessGate status={accessStatus}>
      {isMinimalPresentation ? (
        <MinimalScreenLayout scroll={false}>
          <View style={styles.minimalRoot}>{renderContent()}</View>
        </MinimalScreenLayout>
      ) : (
        <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
          <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.body}>{renderContent()}</View>
          </SafeAreaView>
        </LinearGradient>
      )}
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  minimalRoot: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    backgroundColor: MINIMAL_UI.background,
  },
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
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
    marginBottom: 8,
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
  lgpdBoxMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderColor: VIGILANCE_SCALES_UI.border,
  },
  lgpdTitle: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  lgpdTitleMinimal: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  lgpdText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
  },
  lgpdTextMinimal: {
    color: VIGILANCE_SCALES_UI.accent,
    opacity: 0.88,
  },
  hintText: {
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 12,
  },
  hintTextMinimal: {
    color: VIGILANCE_SCALES_UI.accent,
    opacity: 0.72,
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
  checkboxMinimal: {
    borderColor: VIGILANCE_SCALES_UI.accent,
  },
  checkboxCheckedGreen: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkboxCheckedGreenMinimal: {
    backgroundColor: VIGILANCE_SCALES_UI.accent,
    borderColor: VIGILANCE_SCALES_UI.accent,
  },
  checkboxCheckedRed: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  checkboxLabel: {
    color: '#FFF',
    fontSize: 14,
  },
  checkboxLabelMinimal: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  btnPrimary: {
    backgroundColor: '#10b981',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  btnPrimaryMinimal: {
    backgroundColor: '#3A96DD',
    borderWidth: 2,
    borderColor: '#1B4F8A',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 51,
  },
  btnSecondary: {
    backgroundColor: '#475569',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  btnSecondaryMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 2,
    borderColor: VIGILANCE_SCALES_UI.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 51,
  },
  btnText: {
    color: '#020617',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnTextOnPrimary: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  btnTextSecondary: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnTextSecondaryMinimal: {
    color: VIGILANCE_SCALES_UI.accent,
    fontWeight: '800',
    fontSize: 15,
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
  backLinkTextMinimal: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  confirmContainer: {
    marginTop: 10,
    flex: 1,
  },
  previewImageFrame: {
    width: '72%',
    maxWidth: 280,
    aspectRatio: 3 / 4,
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#10b981',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  previewImageFrameMinimal: {
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: MINIMAL_UI.background,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  repeatPhotoButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  repeatPhotoText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  repeatPhotoTextMinimal: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  cameraRoot: {
    flex: 1,
    backgroundColor: '#020617',
  },
  camera: {
    flex: 1,
  },
  selfieCameraShell: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  selfieCameraHint: {
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 14,
    fontSize: 14,
    fontWeight: '600',
  },
  selfieCameraHintMinimal: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  selfieCameraFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 28,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
    backgroundColor: '#020617',
  },
  selfieCameraFrameMinimal: {
    borderColor: VIGILANCE_SCALES_UI.accent,
  },
  btnCameraBottom: {
    backgroundColor: '#10b981',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  btnCameraDisabled: {
    opacity: 0.6,
  },
});
