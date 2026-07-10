import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useIgrejasAdminAccess } from '@/hooks/useIgrejasAdminAccess';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  activateSessionTenant,
  listSessionIgrejas,
  onboardIgrejaAdmin,
  type SessionIgreja,
} from '@/lib/tenantSession';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

function IgrejasAdminPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [churches, setChurches] = useState<SessionIgreja[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setChurches(await listSessionIgrejas());
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Instâncias',
        text2: 'Não foi possível listar as igrejas.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const result = await onboardIgrejaAdmin(code, name);
      if (!result?.success) {
        Toast.show({
          type: 'error',
          text1: 'Nova instância',
          text2: result?.message || 'Não foi possível criar.',
        });
        return;
      }
      Toast.show({
        type: 'success',
        text1: 'Instância criada',
        text2: result.message || `${result.code} pronta.`,
      });
      setCode('');
      setName('');
      await load();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? String((error as { message: string }).message)
            : 'Erro inesperado.';
      Toast.show({
        type: 'error',
        text1: 'Nova instância',
        text2: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSwitch = async (church: SessionIgreja) => {
    const result = await activateSessionTenant(church.id);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'Trocar igreja', text2: result.message });
      return;
    }
    Toast.show({
      type: 'success',
      text1: 'Igreja ativa',
      text2: church.name,
    });
    router.replace({
      pathname: '/(tabs)',
      params: withMinimalPresentation(),
    });
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Instâncias (igrejas)</Text>
      <Text style={styles.hint}>
        Super administrador: crie novas instâncias e alterne entre elas com o mesmo celular.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Código (ex.: IBC)</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12))}
          placeholder="CODIGO"
          placeholderTextColor={MINIMAL_UI.textMuted}
          autoCapitalize="characters"
        />
        <Text style={styles.label}>Nome da igreja</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nome oficial"
          placeholderTextColor={MINIMAL_UI.textMuted}
        />
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={() => void handleCreate()}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={MINIMAL_UI.onDark} />
          ) : (
            <Text style={styles.buttonText}>Criar instância</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>Instâncias disponíveis</Text>
      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} />
      ) : (
        <View style={styles.list}>
          {churches.map((church) => (
            <TouchableOpacity
              key={church.id}
              style={styles.row}
              onPress={() => void handleSwitch(church)}
              activeOpacity={0.85}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{church.name}</Text>
                <Text style={styles.rowCode}>{church.code}</Text>
              </View>
              {church.is_primary ? <Text style={styles.badge}>Ativa</Text> : (
                <Text style={styles.switchHint}>Usar</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function IgrejasScreen() {
  const accessStatus = useIgrejasAdminAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout>
        <IgrejasAdminPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    paddingBottom: 24,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  form: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  label: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
  },
  button: {
    marginTop: 8,
    backgroundColor: MINIMAL_UI.blueDark,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
    fontSize: 15,
  },
  section: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { color: MINIMAL_UI.text, fontWeight: '700', fontSize: 15 },
  rowCode: { color: MINIMAL_UI.textMuted, fontSize: 12 },
  badge: { color: MINIMAL_UI.accent, fontWeight: '700', fontSize: 12 },
  switchHint: { color: MINIMAL_UI.textMuted, fontSize: 12 },
});
