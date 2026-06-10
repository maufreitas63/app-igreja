import { FamilyRegistrationForm } from '@/components/forms/FamilyRegistrationForm';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

export default function FamilyRegistrationScreen() {
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.nativeFallback}>
        <Text style={styles.nativeTitle}>Cadastro de família</Text>
        <Text style={styles.nativeBody}>
          Este formulário está disponível na versão web (PWA) do aplicativo. Abra o link no navegador do
          celular ou computador para preencher o cadastro da sua família.
        </Text>
      </View>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <FamilyRegistrationForm />
    </div>
  );
}

const styles = StyleSheet.create({
  nativeFallback: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  nativeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  nativeBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
});
