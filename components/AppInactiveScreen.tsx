import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  message: string;
  onAdminAccessPress?: () => void;
};

/** Tela exibida quando app_ativo = nao (exceto super_admin). */
export function AppInactiveScreen({ message, onAdminAccessPress }: Props) {
  return (
    <View style={styles.container}>
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} contentFit="contain" />
      <Text style={styles.title}>Aplicativo indisponível</Text>
      <Text style={styles.message}>{message}</Text>
      {onAdminAccessPress ? (
        <TouchableOpacity
          style={styles.adminButton}
          onPress={onAdminAccessPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Acesso administrativo"
        >
          <Text style={styles.adminButtonText}>Acesso administrativo</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#0f172a',
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 26,
    color: '#cbd5e1',
    textAlign: 'center',
    maxWidth: 520,
  },
  adminButton: {
    marginTop: 28,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
  },
  adminButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
});
