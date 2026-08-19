import { CameraView, useCameraPermissions } from 'expo-camera';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput, TouchableOpacity,
  View
} from 'react-native';
import {
  buildLgpdDeclineMessage,
  buildLgpdTermsText,
  DEFAULT_LGPD_ENTITY_NAME,
  loadLgpdEntityName,
  loadLgpdTermsText,
} from '@/lib/lgpdTerms';
import { reserveNextFamilyId } from '@/lib/family';
import { completeInitialProfileRegistration } from '@/lib/completeInitialProfileRegistration';
import { formatFullName } from '@/lib/fullName';
import {
  isPlaceholderVisitorName,
  isProfilePendingSelfRegistration,
  loadProfileByPhone,
  resolvePostLoginRoute,
} from '@/lib/profileOnboarding';
import { formatCep, normalizeCepDigits } from '@/lib/geoMapGeocoding';
import { formatBrazilCepInput, formatBrazilDateInput } from '@/lib/inputMasks';
import { isLgpdAtivoEnabled, clearAppParameterCache, LGPD_ATIVO_PARAMETER } from '@/lib/appParameters';
import { pickSelfieFromWeb, selectSelfiePictureSize, uploadSelfieInput } from '@/lib/selfie';
import { supabase } from '@/lib/supabase';
import { invalidateProfilesMapSnapshot } from '@/lib/profilesMapCache';
import { persistProfileId, persistUserSession } from '@/lib/userSession';
import { useLgpdTermsScrollGate } from '@/hooks/useLgpdTermsScrollGate';
import { useRejectTotemPhoneFromMemberRoutes } from '@/hooks/useRejectTotemPhoneFromMemberRoutes';
import { useWebDocumentTitle } from '@/hooks/useWebDocumentTitle';
import { useEntityPrefix } from '@/context/EntityPrefixContext';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REGISTER_SURFACE = '#FFFFFF';
const REGISTER_ACCENT = VIGILANCE_SCALES_UI.accent;
const REGISTER_ICON = '#1B4F8A';
const REGISTER_INPUT_BORDER = 'rgba(28, 79, 138, 0.35)';
const REGISTER_SOFT_BORDER = 'rgba(52, 211, 153, 0.35)';
const REGISTER_SUBMIT_BG = '#3A96DD';
const REGISTER_SUBMIT_TEXT = '#FFFFFF';
const REGISTER_PLACEHOLDER = 'rgba(58, 150, 221, 0.55)';

const REGISTER_LGPD_TERMS_HEIGHT = 200;
const REGISTER_LGPD_TERMS_MARGIN_BOTTOM = 5;
const REGISTER_LGPD_HINT_LINE_HEIGHT = 16;
const REGISTER_LGPD_HINT_MARGIN_BOTTOM = 15;
const REGISTER_LGPD_CHECKBOX_ROW_HEIGHT = 24;
const REGISTER_LGPD_ROW_MARGIN_BOTTOM = 25;
const REGISTER_LGPD_SECTION_HEIGHT =
  REGISTER_LGPD_TERMS_HEIGHT +
  REGISTER_LGPD_TERMS_MARGIN_BOTTOM +
  REGISTER_LGPD_HINT_LINE_HEIGHT +
  REGISTER_LGPD_HINT_MARGIN_BOTTOM +
  REGISTER_LGPD_CHECKBOX_ROW_HEIGHT;

const formatCepInput = formatBrazilCepInput;

function readPhoneRouteParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || value === '') {
    return '';
  }
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

export default function RegisterScreen() {
  const params = useLocalSearchParams();
  const phoneValue = readPhoneRouteParam(params.phone as string | string[] | undefined);
  useRejectTotemPhoneFromMemberRoutes(phoneValue);

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cep, setCep] = useState('');
  const [acceptedLGPD, setAcceptedLGPD] = useState<boolean | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [stage, setStage] = useState<'FORM' | 'CAMERA' | 'CONFIRM'>('FORM');
  const {
    hasScrolledToBottom,
    resetScrollGate,
    onTermsViewportLayout,
    onTermsContentSizeChange,
    onTermsScroll,
  } = useLgpdTermsScrollGate();
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | null>(null);
  const [lgpdTermsText, setLgpdTermsText] = useState(() => buildLgpdTermsText(DEFAULT_LGPD_ENTITY_NAME));
  const [entityName, setEntityName] = useState(DEFAULT_LGPD_ENTITY_NAME);
  const [existingProfileId, setExistingProfileId] = useState<string | null>(null);
  const [lgpdModuleActive, setLgpdModuleActive] = useState(true);
  const [loadingLgpdSetting, setLoadingLgpdSetting] = useState(true);
  const cameraRef = useRef<CameraView>(null);
  const nameInputRef = useRef<TextInput>(null);
  const router = useRouter();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { prefix: entityPrefix } = useEntityPrefix();

  const webDocumentTitle =
    stage === 'CAMERA'
      ? `Selfie biométrica — Cadastro · ${entityPrefix}`
      : stage === 'CONFIRM'
        ? `Confirmar cadastro · ${entityPrefix}`
        : lgpdModuleActive
          ? `Termos LGPD — Cadastro · ${entityPrefix}`
          : `Cadastro · ${entityPrefix}`;
  useWebDocumentTitle(webDocumentTitle);

  useEffect(() => {
    const timer = setTimeout(() => nameInputRef.current?.focus(), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!phoneValue) {
      setExistingProfileId(null);
      return;
    }

    let active = true;

    void (async () => {
      try {
        const profile = await loadProfileByPhone(phoneValue);

        if (!active) {
          return;
        }

        if (profile && isProfilePendingSelfRegistration(profile)) {
          setExistingProfileId(String(profile.id));

          const savedName = typeof profile.full_name === 'string' ? profile.full_name.trim() : '';
          if (savedName && !isPlaceholderVisitorName(savedName)) {
            setFullName(formatFullName(savedName));
          }

          const savedCep = typeof profile.cep === 'string' ? profile.cep.trim() : '';
          if (savedCep) {
            setCep(formatCepInput(savedCep));
          }

          return;
        }

        setExistingProfileId(null);
      } catch (error) {
        console.error('Erro ao carregar perfil para cadastro:', error);

        if (active) {
          setExistingProfileId(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [phoneValue]);

  useEffect(() => {
    let active = true;

    const loadLgpdSetting = async () => {
      setLoadingLgpdSetting(true);
      try {
        clearAppParameterCache(LGPD_ATIVO_PARAMETER);
        const lgpdAtivo = await isLgpdAtivoEnabled();

        if (active) {
          setLgpdModuleActive(lgpdAtivo);
          if (!lgpdAtivo) {
            setAcceptedLGPD(null);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar LGPD_Ativo:', error);
      } finally {
        if (active) {
          setLoadingLgpdSetting(false);
        }
      }
    };

    void loadLgpdSetting();

    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      void (async () => {
        try {
          clearAppParameterCache(LGPD_ATIVO_PARAMETER);
          const lgpdAtivo = await isLgpdAtivoEnabled();

          if (!active) {
            return;
          }

          setLgpdModuleActive(lgpdAtivo);
          if (!lgpdAtivo) {
            setAcceptedLGPD(null);
          }
        } catch (error) {
          console.error('Erro ao recarregar LGPD_Ativo:', error);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!lgpdModuleActive) {
      return;
    }

    let active = true;

    void (async () => {
      try {
        const [nextTermsText, nextEntityName] = await Promise.all([
          loadLgpdTermsText(),
          loadLgpdEntityName(),
        ]);
        if (active) {
          setLgpdTermsText(nextTermsText);
          setEntityName(nextEntityName);
          resetScrollGate();
        }
      } catch (error) {
        console.error('Erro ao carregar termos LGPD:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [lgpdModuleActive, resetScrollGate]);

  const cepDigits = normalizeCepDigits(cep);
  const hasRealName = fullName.length > 3 && !isPlaceholderVisitorName(fullName);
  const isFormValid = hasRealName && birthDate.length === 10 && cepDigits !== null;
  const showLgpdSectionA = !loadingLgpdSetting && lgpdModuleActive;
  const showLgpdSectionB = !loadingLgpdSetting && !lgpdModuleActive;

  const handleNameFocus = () => {
    if (isPlaceholderVisitorName(fullName)) {
      setFullName('');
    }
  };

  const handleNameChange = (text: string) => {
    setFullName(text);
  };

  const handleCepChange = (text: string) => {
    setCep(formatCepInput(text));
  };

  const handleDateChange = (text: string) => {
    const formatted = formatBrazilDateInput(text);
    setBirthDate(formatted);

    if (formatted.replace(/\D/g, '').length === 8) {
      Keyboard.dismiss();
    }
  };

  const handleLGPDChoice = (choice: boolean) => {
    if (!isFormValid) {
      Alert.alert('Atenção', 'Preencha Nome, Nascimento e CEP da residência primeiro.');
      return;
    }
    if (!hasScrolledToBottom) {
      Alert.alert("Atenção", "Role os termos até o final para confirmar a leitura.");
      return;
    }
    if (choice === false) {
      Alert.alert('Privacidade', buildLgpdDeclineMessage(entityName));
    }
    setAcceptedLGPD(choice);
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

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      let fileName = null;
      const [day, month, year] = birthDate.split('/');
      const formattedDateForDB = `${year}-${month}-${day}`;

      if (lgpdModuleActive && acceptedLGPD === true && photo) {
        fileName = await uploadSelfieInput(photo);
      }

      if (!hasRealName) {
        throw new Error('Informe seu nome completo (substitua o perfil temporário de visitante).');
      }

      const normalizedCepDigits = normalizeCepDigits(cep);
      if (!normalizedCepDigits) {
        throw new Error('Informe um CEP válido com 8 dígitos.');
      }

      const formattedCep = formatCep(normalizedCepDigits);
      const familyId = await reserveNextFamilyId();

      let profileId = existingProfileId;
      if (!profileId) {
        const pendingProfile = await loadProfileByPhone(phoneValue);
        profileId = pendingProfile?.id ? String(pendingProfile.id) : null;
      }

      if (!profileId) {
        throw new Error('Perfil não encontrado para concluir o cadastro inicial.');
      }

      await persistProfileId(profileId);

      const registration = await completeInitialProfileRegistration({
        profileId,
        fullName,
        birthDateIso: formattedDateForDB,
        phone: phoneValue,
        cep: formattedCep,
        selfieUrl: fileName,
        lgpdAccepted: lgpdModuleActive ? acceptedLGPD : null,
        familyId,
        codigoMembro: familyId,
      });

      await persistUserSession(registration.profile, phoneValue, registration.sessionToken);
      await invalidateProfilesMapSnapshot();

      const postLoginRoute = resolvePostLoginRoute(registration.profile, phoneValue);
      const successMessage = lgpdModuleActive
        ? registration.profile.lgpd_accepted === false
          ? 'Cadastro inicial concluído. Você está no Índice do Aplicativo. Regularize os termos LGPD em Dados Cadastrais quando desejar.'
          : 'Cadastro inicial concluído. Você está no Índice do Aplicativo.'
        : 'Cadastro concluído. Você está no Índice do Aplicativo.';

      router.replace(postLoginRoute);

      Alert.alert('Sucesso', successMessage);
    } catch (err: unknown) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {stage === 'CAMERA' ? (
        <View style={styles.container}>
          <View style={styles.selfieCameraShell}>
            <Text style={styles.selfieCameraHint}>
              Afaste um pouco o rosto e centralize-o dentro do quadro.
            </Text>
            <View style={styles.selfieCameraFrame}>
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
              if (pic) { setPhoto(pic.uri); setStage('CONFIRM'); }
            }}
          >
            <Text style={styles.btnText}>{isCameraReady ? 'Capturar Selfie' : 'Preparando câmera...'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            {stage === 'CONFIRM' ? 'Confirmar Registro' : `Cadastro ${entityName}`}
          </Text>
          {stage === 'FORM' ? (
            <Text style={styles.subtitle}>Complete seus dados para entrar no aplicativo.</Text>
          ) : null}
          <View style={styles.formContainer}>
            {stage === 'FORM' && (
              <>
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Nome completo</Text>
                  <TextInput
                    ref={nameInputRef}
                    style={styles.input}
                    placeholder="Nome completo"
                    placeholderTextColor={REGISTER_PLACEHOLDER}
                    value={fullName}
                    onChangeText={handleNameChange}
                    onFocus={handleNameFocus}
                    onBlur={() => setFullName((current) => formatFullName(current))}
                  />
                </View>
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Data de nascimento</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor={REGISTER_PLACEHOLDER}
                    value={birthDate}
                    onChangeText={handleDateChange}
                    maxLength={10}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>CEP da residência</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="00000-000"
                    placeholderTextColor={REGISTER_PLACEHOLDER}
                    value={cep}
                    onChangeText={handleCepChange}
                    maxLength={9}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.phoneConfirmedRow}>
                  <FontAwesome name="check-circle" size={18} color={REGISTER_ACCENT} />
                  <Text style={styles.phoneConfirmedText}>Celular confirmado: {phoneValue}</Text>
                </View>

                <View style={styles.registerLgpdSlot}>
                  {loadingLgpdSetting ? (
                    <View style={styles.registerLgpdLoading}>
                      <ActivityIndicator color={REGISTER_ACCENT} />
                    </View>
                  ) : null}

                  {/* Seção (a) — termos, hint e checkboxes (LGPD_Ativo = sim) */}
                  <View
                    style={[
                      styles.registerLgpdSection,
                      !showLgpdSectionA && styles.registerLgpdSectionHidden,
                    ]}
                    accessibilityElementsHidden={!showLgpdSectionA}
                    importantForAccessibility={showLgpdSectionA ? 'auto' : 'no-hide-descendants'}
                  >
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
                      <TouchableOpacity
                        style={styles.checkboxWrapper}
                        onPress={() => handleLGPDChoice(true)}
                        disabled={!isFormValid}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            acceptedLGPD === true && styles.checkboxCheckedGreen,
                            !isFormValid && { opacity: 0.3 },
                          ]}
                        />
                        <Text style={styles.checkboxLabel}>Li e aceito</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.checkboxWrapper}
                        onPress={() => handleLGPDChoice(false)}
                        disabled={!isFormValid}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            acceptedLGPD === false && styles.checkboxCheckedRed,
                            !isFormValid && { opacity: 0.3 },
                          ]}
                        />
                        <Text style={styles.checkboxLabel}>Li e não concordo</Text>
                      </TouchableOpacity>
                    </View>

                    {acceptedLGPD === true && (
                      <TouchableOpacity
                        style={styles.btnPrimarySectionA}
                        onPress={() => void handleOpenCamera()}
                      >
                        <Text style={styles.btnText}>Tirar Selfie Biométrica</Text>
                      </TouchableOpacity>
                    )}

                    {acceptedLGPD === false && (
                      <TouchableOpacity
                        style={styles.btnSecondarySectionA}
                        onPress={() => void handleRegister()}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <ActivityIndicator color={REGISTER_ICON} />
                        ) : (
                          <Text style={styles.btnTextSecondary}>Concluir Cadastro</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Seção (b) — Continuar (LGPD_Ativo = nao), mesmo slot e dimensões da seção (a) */}
                  <View
                    style={[
                      styles.registerLgpdSection,
                      !showLgpdSectionB && styles.registerLgpdSectionHidden,
                    ]}
                    accessibilityElementsHidden={!showLgpdSectionB}
                    importantForAccessibility={showLgpdSectionB ? 'auto' : 'no-hide-descendants'}
                  >
                    <View style={styles.registerLgpdSectionBTopSpacer} />
                    <View style={styles.registerLgpdSectionBButtonRow}>
                      <TouchableOpacity
                        style={[
                          styles.btnPrimaryContinue,
                          (!isFormValid || isLoading) && styles.btnDisabled,
                        ]}
                        onPress={() => void handleRegister()}
                        disabled={!isFormValid || isLoading}
                        accessibilityRole="button"
                        accessibilityLabel="Continuar"
                      >
                        {isLoading ? (
                          <ActivityIndicator color={REGISTER_SUBMIT_TEXT} />
                        ) : (
                          <Text style={styles.btnText}>Continuar</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </>
            )}

            {stage === 'CONFIRM' && photo && (
              <View style={styles.confirmContainer}>
                <View style={styles.previewImageFrame}>
                  <Image source={{ uri: photo }} style={styles.previewImage} resizeMode="contain" />
                </View>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => void handleRegister()}
                  disabled={isLoading}
                >
                  {isLoading ? <ActivityIndicator color={REGISTER_SUBMIT_TEXT} /> : <Text style={styles.btnText}>Confirmar Registro</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.repeatPhotoLink} onPress={() => void handleOpenCamera()}>
                  <Text style={styles.repeatPhotoText}>Repetir Foto</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: REGISTER_SURFACE,
  },
  scroll: {
    padding: 20,
    flexGrow: 1,
    paddingTop: 40,
    paddingBottom: 40,
    backgroundColor: REGISTER_SURFACE,
  },
  formContainer: { flex: 1 },
  confirmContainer: { marginTop: 10 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: REGISTER_ACCENT,
    textAlign: 'center',
    marginBottom: 30,
  },
  fieldBlock: {
    marginBottom: 20,
    width: '100%',
  },
  fieldLabel: {
    color: REGISTER_ACCENT,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: REGISTER_SURFACE,
    borderWidth: 1,
    borderColor: REGISTER_SOFT_BORDER,
    padding: 20,
    borderRadius: 16,
    color: REGISTER_ACCENT,
    fontSize: 18,
  },
  phoneConfirmedRow: {
    width: '100%',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  phoneConfirmedText: {
    color: REGISTER_ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },
  lgpdBox: {
    backgroundColor: MINIMAL_UI.rowHover,
    height: REGISTER_LGPD_TERMS_HEIGHT,
    padding: 15,
    borderRadius: 16,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: REGISTER_INPUT_BORDER,
    overflow: 'hidden',
  },
  lgpdTitle: {
    color: MINIMAL_UI.blueDark,
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  lgpdText: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    lineHeight: 20,
  },
  hintText: {
    color: REGISTER_ACCENT,
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 12,
    minHeight: REGISTER_LGPD_HINT_LINE_HEIGHT,
  },
  registerLgpdSlot: {
    width: '100%',
    minHeight: REGISTER_LGPD_SECTION_HEIGHT,
    marginBottom: REGISTER_LGPD_ROW_MARGIN_BOTTOM,
  },
  registerLgpdLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  registerLgpdSection: {
    width: '100%',
    minHeight: REGISTER_LGPD_SECTION_HEIGHT,
  },
  registerLgpdSectionHidden: {
    display: 'none',
  },
  registerLgpdSectionBTopSpacer: {
    height:
      REGISTER_LGPD_TERMS_HEIGHT +
      REGISTER_LGPD_TERMS_MARGIN_BOTTOM +
      REGISTER_LGPD_HINT_LINE_HEIGHT +
      REGISTER_LGPD_HINT_MARGIN_BOTTOM,
  },
  registerLgpdSectionBButtonRow: {
    minHeight: REGISTER_LGPD_CHECKBOX_ROW_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    minHeight: REGISTER_LGPD_CHECKBOX_ROW_HEIGHT,
    alignItems: 'center',
  },
  checkboxWrapper: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: REGISTER_INPUT_BORDER,
    marginRight: 8,
  },
  checkboxCheckedGreen: { backgroundColor: REGISTER_ACCENT, borderColor: REGISTER_ACCENT },
  checkboxCheckedRed: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  checkboxLabel: { color: MINIMAL_UI.text, fontSize: 14, fontWeight: '600' },
  btnPrimary: {
    backgroundColor: REGISTER_SUBMIT_BG,
    borderWidth: 2,
    borderColor: REGISTER_ICON,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  btnPrimarySectionA: {
    backgroundColor: REGISTER_SUBMIT_BG,
    borderWidth: 2,
    borderColor: REGISTER_ICON,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  btnSecondarySectionA: {
    backgroundColor: MINIMAL_UI.rowHover,
    borderWidth: 2,
    borderColor: REGISTER_ICON,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  btnPrimaryContinue: {
    backgroundColor: REGISTER_SUBMIT_BG,
    borderWidth: 2,
    borderColor: REGISTER_ICON,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 220,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: REGISTER_SUBMIT_TEXT, fontWeight: 'bold', fontSize: 16 },
  btnTextSecondary: { color: REGISTER_ICON, fontWeight: 'bold', fontSize: 16 },
  repeatPhotoLink: { marginTop: 15, alignItems: 'center' },
  repeatPhotoText: { color: REGISTER_ACCENT, fontSize: 15, fontWeight: '600' },
  btnCameraBottom: {
    backgroundColor: REGISTER_SUBMIT_BG,
    borderWidth: 2,
    borderColor: REGISTER_ICON,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  btnCameraDisabled: {
    opacity: 0.6,
  },
  camera: { flex: 1 },
  previewImageFrame: {
    width: '72%',
    maxWidth: 280,
    aspectRatio: 3 / 4,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: REGISTER_ICON,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  selfieCameraShell: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 120,
    backgroundColor: REGISTER_SURFACE,
  },
  selfieCameraHint: {
    color: MINIMAL_UI.text,
    textAlign: 'center',
    marginBottom: 14,
    fontSize: 14,
    fontWeight: '600',
  },
  selfieCameraFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: REGISTER_ICON,
    backgroundColor: '#020617',
  },
});
