import { ChurchRoomSettingsPanel } from '@/components/ChurchRoomSettingsPanel';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import {
  CHURCH_ROOM_SETTINGS_SQL_HINT,
  clearChurchRoomSettingsCache,
  listChurchRoomSettings,
  type ChurchRoomSetting,
} from '@/lib/churchRoomSettings';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function ConfiguracaoSalasScreen() {
  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.configuracaoSalas,
    deniedMessage: 'Apenas Líder ou Administrador pode configurar salas e atribuições.',
  });

  const [rooms, setRooms] = useState<ChurchRoomSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    clearChurchRoomSettingsCache();
    try {
      const rows = await listChurchRoomSettings({ forceRefresh: true });
      setRooms(rows);
    } catch (error) {
      console.error(error);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRooms();
    }, [loadRooms])
  );

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout>
        <Text style={styles.title}>Configuração de Salas</Text>
        <Text style={styles.subtitle}>
          Defina os nomes afetivos da instância ativa e atribua membros às salas.
        </Text>

        {loading ? (
          <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
        ) : (
          <View style={styles.body}>
            <ChurchRoomSettingsPanel rooms={rooms} onRoomsChanged={() => void loadRooms()} />
            <Text style={styles.footerHint}>{CHURCH_ROOM_SETTINGS_SQL_HINT}</Text>
          </View>
        )}
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  title: {
    ...MINIMAL_SECTION_TITLE,
    marginBottom: 4,
  },
  subtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  loader: {
    marginTop: 24,
  },
  body: {
    width: '100%',
    gap: 12,
  },
  footerHint: {
    marginTop: 20,
    fontSize: 11,
    color: MINIMAL_UI.textMuted,
    lineHeight: 15,
  },
});
