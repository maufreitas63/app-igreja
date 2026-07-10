import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  activateSessionTenant,
  listSessionIgrejas,
  type SessionIgreja,
} from '@/lib/tenantSession';
import { resolveRegisteredUserLoginRoute } from '@/lib/profileOnboarding';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

export default function SelecionarIgrejaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone =
    typeof params.phone === 'string' ? decodeURIComponent(params.phone) : '';

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [churches, setChurches] = useState<SessionIgreja[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listSessionIgrejas();
      setChurches(rows);
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Igrejas',
        text2: 'Não foi possível carregar as instâncias.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = async (church: SessionIgreja) => {
    setSavingId(church.id);
    try {
      const result = await activateSessionTenant(church.id);
      if (!result.success) {
        Toast.show({ type: 'error', text1: 'Igreja', text2: result.message });
        return;
      }
      router.replace(resolveRegisteredUserLoginRoute(phone || ''));
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Igreja',
        text2: 'Falha ao ativar a instância.',
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <MinimalScreenLayout>
      <Text style={styles.title}>Selecionar igreja</Text>
      <Text style={styles.hint}>
        Seu acesso cobre mais de uma instância. Escolha onde deseja operar.
      </Text>

      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
      ) : (
        <View style={styles.list}>
          {churches.map((church) => {
            const busy = savingId === church.id;
            return (
              <TouchableOpacity
                key={church.id}
                style={styles.row}
                onPress={() => void handleSelect(church)}
                disabled={Boolean(savingId)}
                activeOpacity={0.85}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{church.name}</Text>
                  <Text style={styles.rowCode}>{church.code}</Text>
                </View>
                {busy ? (
                  <ActivityIndicator color={MINIMAL_UI.accent} />
                ) : church.is_primary ? (
                  <Text style={styles.badge}>Atual</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
          {!churches.length ? (
            <Text style={styles.empty}>Nenhuma igreja disponível para esta sessão.</Text>
          ) : null}
        </View>
      )}
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  loader: { marginTop: 24 },
  list: {
    width: '100%',
    paddingHorizontal: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowName: {
    color: MINIMAL_UI.text,
    fontSize: 16,
    fontWeight: '700',
  },
  rowCode: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
  },
  badge: {
    color: MINIMAL_UI.accent,
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 8,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
});
