import { pickRouteParam } from '@/lib/dashboardReturnNavigation';
import { resolvePublishedDashboardHref } from '@/lib/frozenPublication';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Deep links antigos `/(tabs)/dashboard?dashboardCard=` redirecionam para a rota dedicada.
 * O carrossel do Painel não é mais hospedeiro de telas publicadas.
 */
export default function DashboardScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const requestedDashboardCard = pickRouteParam(params.dashboardCard);
  const phone = pickRouteParam(params.phone);

  useFocusEffect(
    useCallback(() => {
      router.replace(
        resolvePublishedDashboardHref(
          requestedDashboardCard,
          phone ? { phone } : undefined
        )
      );
      return undefined;
    }, [phone, requestedDashboardCard, router])
  );

  return (
    <View style={styles.loading}>
      <ActivityIndicator color="#1B4F8A" />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
