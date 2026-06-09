import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import {
  isPlaceholderVisitorName,
  isProfilePendingSelfRegistration,
  loadProfileByPhone,
  resolvePostLoginRoute,
} from '@/lib/profileOnboarding';
import { formatCep, normalizeCepDigits } from '@/lib/geoMapGeocoding';
import { pickSelfieFromWeb, selectSelfiePictureSize, uploadSelfieInput } from '@/lib/selfie';
import { supabase } from '@/lib/supabase';
import { invalidateProfilesMapSnapshot } from '@/lib/profilesMapCache';
import { persistProfileId, persistUserSession } from '@/lib/userSession';
import { useRejectTotemPhoneFromMemberRoutes } from '@/hooks/useRejectTotemPhoneFromMemberRoutes';
import AsyncStorage from '@react-native-async-storage/async-storage';

const formatCepInput = (value: string) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);
  if (cleaned.length <= 5) {
    return cleaned;
  }

  return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
};

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
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | null>(null);
  const [lgpdTermsText, setLgpdTermsText] = useState(() => buildLgpdTermsText(DEFAULT_LGPD_ENTITY_NAME));
  const [entityName, setEntityName] = useState(DEFAULT_LGPD_ENTITY_NAME);
  const [existingProfileId, setExistingProfileId] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const nameInputRef = useRef<TextInput>(null);
  const router = useRouter();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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
            setFullName(savedName);
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

    void (async () => {
      try {
        const [nextTermsText, nextEntityName] = await Promise.all([
          loadLgpdTermsText(),
          loadLgpdEntityName(),
        ]);
        if (active) {
          setLgpdTermsText(nextTermsText);
          setEntityName(nextEntityName);
          setHasScrolledToBottom(false);
        }
      } catch (error) {
        console.error('Erro ao carregar termos LGPD:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const cepDigits = normalizeCepDigits(cep);
  const hasRealName = fullName.length > 3 && !isPlaceholderVisitorName(fullName);
  const isFormValid = hasRealName && birthDate.length === 10 && cepDigits !== null;

  const handleNameFocus = () => {
    if (isPlaceholderVisitorName(fullName)) {
      setFullName('');
    }
  };

  const handleNameChange = (text: string) => {
    const formatted = text.replace(/\b\w/g, (char) => char.toUpperCase());
    setFullName(formatted);
  };

  const handleCepChange = (text: string) => {
    setCep(formatCepInput(text));
  };

  const handleDateChange = (text: string) => {
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 8) cleaned = cleaned.substring(0, 8);
    let formatted = cleaned;
    if (cleaned.length > 0) {
      formatted = cleaned.substring(0, 2);
      if (cleaned.length > 2) formatted += '/' + cleaned.substring(2, 4);
      if (cleaned.length > 4) formatted += '/' + cleaned.substring(4, 8);
    }
    setBirthDate(formatted);
    if (cleaned.length === 8) Keyboard.dismiss();
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
      setHasScrolledToBottom(true);
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

      if (acceptedLGPD === true && photo) {
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

      const registeredProfile = await completeInitialProfileRegistration({
        profileId,
        fullName,
        birthDateIso: formattedDateForDB,
        phone: phoneValue,
        cep: formattedCep,
        selfieUrl: fileName,
        lgpdAccepted: acceptedLGPD,
        familyId,
        codigoMembro: familyId,
      });

      await persistUserSession(registeredProfile, phoneValue);
      await invalidateProfilesMapSnapshot();

      Alert.alert(
        'Sucesso',
        'Cadastro inicial concluído. Complete seus dados cadastrais na próxima tela.'
      );

      router.replace(resolvePostLoginRoute(registeredProfile, phoneValue));
    } catch (err: unknown) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
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
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>
            {stage === 'CONFIRM' ? 'Confirmar Registro' : `Cadastro ${entityName}`}
          </Text>
          <View style={styles.formContainer}>
            {stage === 'FORM' && (
              <>
                <TextInput
                  ref={nameInputRef}
                  style={styles.input}
                  placeholder="Nome completo"
                  placeholderTextColor="#94A3B8"
                  value={fullName}
                  onChangeText={handleNameChange}
                  onFocus={handleNameFocus}
                />
                <TextInput style={styles.input} placeholder="Data Nascimento - dd/mm/aaaa" placeholderTextColor="#94A3B8" value={birthDate} onChangeText={handleDateChange} maxLength={10} keyboardType="numeric" />
                <TextInput
                  style={styles.input}
                  placeholder="CEP da residência - 00000-000"
                  placeholderTextColor="#94A3B8"
                  value={cep}
                  onChangeText={handleCepChange}
                  maxLength={9}
                  keyboardType="numeric"
                />
                <TextInput style={styles.inputDisabled} value={`Telefone: ${phoneValue}`} editable={false} />

                <View style={styles.lgpdBox}>
                  <ScrollView scrollEventThrottle={16} onScroll={handleScroll}>
                    <Text style={styles.lgpdTitle}>Termos de Uso e Privacidade (LGPD)</Text>
                    <Text style={styles.lgpdText}>{lgpdTermsText}</Text>
                  </ScrollView>
                </View>
                <Text style={styles.hintText}>{hasScrolledToBottom ? '✅ Termos lidos.' : '↓ Role para ler tudo ↓'}</Text>

                <View style={styles.rowContainer}>
                  <TouchableOpacity style={styles.checkboxWrapper} onPress={() => handleLGPDChoice(true)} disabled={!isFormValid}>
                    <View style={[styles.checkbox, acceptedLGPD === true && styles.checkboxCheckedGreen, !isFormValid && {opacity: 0.3}]} />
                    <Text style={styles.checkboxLabel}>Li e aceito</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.checkboxWrapper} onPress={() => handleLGPDChoice(false)} disabled={!isFormValid}>
                    <View style={[styles.checkbox, acceptedLGPD === false && styles.checkboxCheckedRed, !isFormValid && {opacity: 0.3}]} />
                    <Text style={styles.checkboxLabel}>Li e não concordo</Text>
                  </TouchableOpacity>
                </View>

                {acceptedLGPD === true && (
                  <TouchableOpacity style={styles.btnPrimary} onPress={() => void handleOpenCamera()}>
                    <Text style={styles.btnText}>Tirar Selfie Biométrica</Text>
                  </TouchableOpacity>
                )}

                {acceptedLGPD === false && (
                  <TouchableOpacity style={styles.btnSecondary} onPress={handleRegister} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnTextSecondary}>Concluir Cadastro</Text>}
                  </TouchableOpacity>
                )}
              </>
            )}

            {stage === 'CONFIRM' && photo && (
              <View style={styles.confirmContainer}>
                <View style={styles.previewImageFrame}>
                  <Image source={{ uri: photo }} style={styles.previewImage} resizeMode="contain" />
                </View>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister} disabled={isLoading}>
                  {isLoading ? <ActivityIndicator color="#020617" /> : <Text style={styles.btnText}>Confirmar Registro</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={{marginTop: 15, alignItems: 'center'}} onPress={() => void handleOpenCamera()}>
                  <Text style={{color: '#94A3B8'}}>Repetir Foto</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, flexGrow: 1, paddingTop: 60 },
  formContainer: { flex: 1 },
  confirmContainer: { marginTop: 10 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 30, textAlign: 'center' },
  input: { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderWidth: 1, borderColor: '#10b981', padding: 20, borderRadius: 20, color: '#FFF', marginBottom: 15 },
  inputDisabled: { backgroundColor: 'rgba(15, 23, 42, 0.4)', borderWidth: 1, borderColor: '#475569', padding: 20, borderRadius: 20, color: '#FFF', marginBottom: 15 },
  lgpdBox: { backgroundColor: 'rgba(15, 23, 42, 0.5)', height: 200, padding: 15, borderRadius: 15, marginBottom: 5, borderWidth: 1, borderColor: '#334155' },
  lgpdTitle: { color: '#10b981', fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  lgpdText: { color: '#94A3B8', fontSize: 13, lineHeight: 20 },
  hintText: { color: '#64748b', textAlign: 'center', marginBottom: 15, fontSize: 12 },
  rowContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 25 },
  checkboxWrapper: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#94A3B8', marginRight: 8 },
  checkboxCheckedGreen: { backgroundColor: '#10b981', borderColor: '#10b981' },
  checkboxCheckedRed: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  checkboxLabel: { color: '#FFF', fontSize: 14 },
  btnPrimary: { backgroundColor: '#10b981', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 10 },
  btnSecondary: { backgroundColor: '#475569', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#020617', fontWeight: 'bold', fontSize: 16 },
  btnTextSecondary: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  btnCameraBottom: { 
    backgroundColor: '#10b981', 
    padding: 20, 
    borderRadius: 20, 
    alignItems: 'center', 
    position: 'absolute', 
    bottom: 40, 
    left: 20, 
    right: 20 
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
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#10b981',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
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
  },
  selfieCameraHint: {
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 14,
    fontSize: 14,
    fontWeight: '600',
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
});
