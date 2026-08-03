import {
  disableBiometricUnlock,
  enableBiometricUnlock,
  getBiometricAvailability,
  isBiometricUnlockEnabled,
} from '@/lib/biometricAuth';
import { getStoredProfileId, getStoredUserPhone } from '@/lib/userSession';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

type BiometricUnlockSettingsCardProps = {
  iconColor: string;
  accentColor?: string;
};

/**
 * Atalho de desbloqueio biométrico — complementar ao telefone+PIN.
 * Só aparece em iOS/Android com hardware biométrico.
 */
export function BiometricUnlockSettingsCard({
  iconColor,
  accentColor = '#1B4F8A',
}: BiometricUnlockSettingsCardProps) {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('Biometria');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') {
      setVisible(false);
      setLoading(false);
      return;
    }

    try {
      const [availability, isEnabled] = await Promise.all([
        getBiometricAvailability(),
        isBiometricUnlockEnabled(),
      ]);

      setLabel(availability.label);
      setVisible(availability.hardware);
      setEnabled(isEnabled && availability.supported);
    } catch (error) {
      console.warn('BiometricUnlockSettingsCard:', error);
      setVisible(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggle = useCallback(
    (nextValue: boolean) => {
      if (saving) {
        return;
      }

      void (async () => {
        setSaving(true);

        try {
          if (!nextValue) {
            await disableBiometricUnlock();
            setEnabled(false);
            return;
          }

          const phone = (await getStoredUserPhone())?.replace(/\D/g, '') ?? '';
          const profileId = (await getStoredProfileId())?.trim() ?? '';

          if (!phone || !profileId) {
            Alert.alert(
              'Biometria',
              'Entre novamente com celular e senha antes de ativar a biometria.'
            );
            return;
          }

          const result = await enableBiometricUnlock({ phone, profileId });
          if (!result.ok) {
            Alert.alert('Biometria', result.message ?? 'Não foi possível ativar.');
            setEnabled(false);
            return;
          }

          setEnabled(true);
          Alert.alert(
            `${result.label} ativado`,
            `Nas próximas aberturas você poderá entrar com ${result.label}. O celular e a senha continuam disponíveis.`
          );
        } catch (error) {
          console.warn('toggle biometric:', error);
          Alert.alert('Biometria', 'Não foi possível atualizar a preferência.');
        } finally {
          setSaving(false);
          void refresh();
        }
      })();
    },
    [refresh, saving]
  );

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <MaterialIcons name="fingerprint" size={22} color={iconColor} />
        <View style={styles.headerText}>
          <Text style={styles.title}>Entrar com {label}</Text>
          <Text style={styles.meta}>
            Atalho rápido neste aparelho. O acesso com celular e senha de 4 dígitos permanece ativo.
          </Text>
        </View>
      </View>

      <View style={styles.toggleRow}>
        {loading || saving ? (
          <ActivityIndicator color={accentColor} />
        ) : (
          <Switch
            accessibilityLabel={`Ativar entrada com ${label}`}
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#CBD5E1', true: accentColor }}
            thumbColor="#FFFFFF"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(28, 79, 138, 0.18)',
    backgroundColor: '#F8FBFF',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
  },
  toggleRow: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 28,
  },
});
