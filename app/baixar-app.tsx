import { unlockAppReleaseDownload } from '@/lib/appReleaseDownload';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function BaixarAppScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setError(null);
    setLoading(true);

    try {
      const result = await unlockAppReleaseDownload(password);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(result.url);
        return;
      }

      await Linking.openURL(result.url);
    } catch {
      setError('Não foi possível iniciar o download.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} contentFit="contain" />
        <Text style={styles.title}>Baixar o aplicativo</Text>
        <Text style={styles.subtitle}>
          Comunidade Digital para Android. Digite a senha que você recebeu para
          iniciar o download do APK.
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Senha do download"
          placeholderTextColor="rgba(58, 150, 221, 0.55)"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          onSubmitEditing={() => {
            void handleDownload();
          }}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          onPress={() => {
            void handleDownload();
          }}
          disabled={loading}
          style={[styles.button, loading ? styles.buttonDisabled : null]}
          accessibilityRole="button"
          accessibilityLabel="Baixar APK"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Baixar APK</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace('/')}
          style={styles.loginLink}
          accessibilityRole="button"
        >
          <Text style={styles.loginLinkText}>Ir para o login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  logo: {
    width: 72,
    height: 72,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1B4F8A',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(28, 79, 138, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  error: {
    marginTop: 10,
    color: '#b91c1c',
    fontWeight: '600',
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
    backgroundColor: '#3A96DD',
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  loginLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#1B4F8A',
    fontWeight: '600',
  },
});
