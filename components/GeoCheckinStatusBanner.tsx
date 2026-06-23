import { formatGeoDistanceMeters } from '@/lib/checkinGeofence';
import type { GeoCheckinUiStatus } from '@/hooks/useGeoCheckinMonitor';
import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  status: GeoCheckinUiStatus;
  gpsProgress: { current: number; required: number };
  distanceMeters: number | null;
  radiusMeters: number;
};

export const GeoCheckinStatusBanner = memo(function GeoCheckinStatusBanner({
  status,
  gpsProgress,
  distanceMeters,
  radiusMeters,
}: Props) {
  const label = useMemo(() => {
    if (status === 'detecting') {
      const { current, required } = gpsProgress;
      const radiusLabel = Math.round(radiusMeters);
      const distanceLabel = formatGeoDistanceMeters(distanceMeters);

      if (current > 0) {
        return `Dentro do raio — confirmando proximidade (${current}/${required} leituras)...`;
      }

      if (distanceLabel) {
        return `GPS ativo: você está a ~${distanceLabel} do local (raio ${radiusLabel} m). Aproxime-se para o check-in.`;
      }

      return `Obtendo GPS para verificar proximidade ao local (raio ${radiusLabel} m)...`;
    }

    if (status === 'syncing') {
      return 'Proximidade confirmada (sincronizando check-in...)';
    }

    if (status === 'confirmed') {
      return 'Check-in Confirmado';
    }

    return null;
  }, [distanceMeters, gpsProgress, radiusMeters, status]);

  if (!label) {
    return null;
  }

  return (
    <View
      style={[
        styles.banner,
        status === 'confirmed' && styles.bannerConfirmed,
        status === 'syncing' && styles.bannerSyncing,
      ]}
    >
      <Text style={styles.bannerText}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(14, 116, 144, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  bannerSyncing: {
    borderColor: '#FBBF24',
    backgroundColor: 'rgba(120, 53, 15, 0.28)',
  },
  bannerConfirmed: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(6, 78, 59, 0.28)',
  },
  bannerText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
