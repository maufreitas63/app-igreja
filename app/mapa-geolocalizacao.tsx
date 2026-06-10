import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { resolveReturnDashboardCardParam } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MapGeolocalizacaoNativeFallback() {
  const params = useLocalSearchParams<{ returnDashboardCard?: string | string[] }>();
  const returnDashboardCard = resolveReturnDashboardCardParam(params);
  const returnToCaller = useReturnToCallerOnLeave({
    returnDashboardCard,
    fallbackDashboardCard: 'members_list',
  });

  useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.mapGeolocation,
    deniedMessage: 'Você não tem permissão para abrir o mapa de geolocalização.',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mapa de Geolocalização</Text>
        <TouchableOpacity onPress={returnToCaller} activeOpacity={0.8}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.infoTitle}>Deploy PWA validado</Text>
        <Text style={styles.infoText}>
          O mapa com clustering está ativo para a versão web (PWA), que é o alvo de deploy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  backText: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 24,
  },
  infoTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

