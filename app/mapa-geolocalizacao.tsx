import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MapGeolocalizacaoNativeFallback() {
  const params = useLocalSearchParams<{ returnDashboardCard?: string | string[]; returnRoute?: string | string[] }>();
  const returnDashboardCard = resolveReturnDashboardCardParam(params);
  const returnRoute = resolveReturnRouteParam(params);
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute,
    returnDashboardCard,
    fallbackDashboardCard: 'members_list',
  });

  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.mapGeolocation,
    deniedMessage: 'Você não tem permissão para abrir o mapa de geolocalização.',
  });

  return (
    <ScreenAccessGate status={accessStatus}>
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mapa de Geolocalização</Text>
        <TouchableOpacity onPress={returnToCaller} activeOpacity={0.8}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.infoTitle}>Mapa disponível no PWA</Text>
        <Text style={styles.infoText}>
          O mapa geral com clustering e lista de membros no GPS funciona na versão web (PWA) do
          app. No aplicativo instalado (APK), use o navegador ou o PWA instalado para este recurso.
        </Text>
      </View>
    </SafeAreaView>
    </ScreenAccessGate>
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

