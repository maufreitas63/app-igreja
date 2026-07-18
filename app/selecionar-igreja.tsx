import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
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
      const result = await activateSessionTenant(church.id, church);
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
      <Text className="w-full text-center text-minimal-section text-minimal-blue-dark bg-minimal-bg px-3 py-2.5">
        Selecionar igreja
      </Text>
      <Text className="mb-4 px-4 text-center text-sm text-minimal-muted">
        Seu acesso cobre mais de uma instância. Escolha onde deseja operar.
      </Text>

      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} className="mt-6" />
      ) : (
        <View className="w-full gap-2.5 px-4">
          {churches.map((church) => {
            const busy = savingId === church.id;
            return (
              <TouchableOpacity
                key={church.id}
                className="flex-row items-center justify-between border border-minimal-border bg-minimal-bg px-3.5 py-3.5"
                onPress={() => void handleSelect(church)}
                disabled={Boolean(savingId)}
                activeOpacity={0.85}
              >
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="text-base font-bold text-minimal-text">{church.name}</Text>
                  <Text className="text-[13px] text-minimal-muted">{church.code}</Text>
                </View>
                {busy ? (
                  <ActivityIndicator color={MINIMAL_UI.accent} />
                ) : church.is_primary ? (
                  <Text className="ml-2 text-xs font-bold text-minimal-accent">Atual</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
          {!churches.length ? (
            <Text className="mt-3 text-center text-minimal-muted">
              Nenhuma igreja disponível para esta sessão.
            </Text>
          ) : null}
        </View>
      )}
    </MinimalScreenLayout>
  );
}
