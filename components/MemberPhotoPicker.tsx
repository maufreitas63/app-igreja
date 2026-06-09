import { pickSelfieFromWeb } from '@/lib/selfie';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type MemberPhotoPickerProps = {
  photoUri: string | null;
  onPhotoChange: (uri: string | null) => void;
  disabled?: boolean;
};

export function MemberPhotoPicker({
  photoUri,
  onPhotoChange,
  disabled = false,
}: MemberPhotoPickerProps) {
  const pickFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Permita o uso da câmera para adicionar a fotografia.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      onPhotoChange(result.assets[0].uri);
    }
  }, [onPhotoChange]);

  const pickFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria para adicionar a fotografia.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      onPhotoChange(result.assets[0].uri);
    }
  }, [onPhotoChange]);

  const pickPhoto = useCallback(async () => {
    if (disabled) {
      return;
    }

    if (Platform.OS === 'web') {
      try {
        const selected = await pickSelfieFromWeb();

        if (selected) {
          onPhotoChange(selected);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Não foi possível carregar a fotografia.';
        Alert.alert('Erro', message);
      }

      return;
    }

    Alert.alert('Fotografia do membro', 'Como deseja adicionar a foto?', [
      { text: 'Câmera', onPress: () => void pickFromCamera() },
      { text: 'Galeria', onPress: () => void pickFromGallery() },
      ...(photoUri
        ? [{ text: 'Remover foto', style: 'destructive' as const, onPress: () => onPhotoChange(null) }]
        : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  }, [disabled, onPhotoChange, photoUri, pickFromCamera, pickFromGallery]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Fotografia</Text>
      <Text style={styles.hint}>
        Opcional. Facilita identificar o membro cadastrado manualmente na família e nos eventos.
      </Text>
      <View style={styles.row}>
        <View style={styles.frame}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.image} contentFit="cover" />
          ) : (
            <MaterialIcons name="person" size={34} color="#64748B" />
          )}
        </View>
        <TouchableOpacity
          style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={() => void pickPhoto()}
          disabled={disabled}
          activeOpacity={0.85}
        >
          <MaterialIcons name="photo-camera" size={18} color="#0f172a" />
          <Text style={styles.buttonText}>
            {photoUri ? 'Alterar fotografia' : 'Adicionar fotografia'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  hint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  frame: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  button: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
});
