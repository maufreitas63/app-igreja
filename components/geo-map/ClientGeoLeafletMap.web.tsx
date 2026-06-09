import type { MapMarker, ProfileForMap } from '@/lib/profilesMapMarkersTypes';
import React, { Component, type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type ClientGeoLeafletMapProps = {
  center: [number, number];
  markers: MapMarker[];
  onSelectProfile: (profile: ProfileForMap) => void;
};

type GeoLeafletMapComponent = React.ComponentType<ClientGeoLeafletMapProps>;

type GeoMapErrorBoundaryState = {
  error: string | null;
};

class GeoMapErrorBoundary extends Component<{ children: ReactNode }, GeoMapErrorBoundaryState> {
  state: GeoMapErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): GeoMapErrorBoundaryState {
    return { error: error.message || 'Erro ao abrir o mapa.' };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>Mapa indisponível</Text>
          <Text style={styles.stateText}>{this.state.error}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export function ClientGeoLeafletMap({
  center,
  markers,
  onSelectProfile,
}: ClientGeoLeafletMapProps) {
  const [MapComponent, setMapComponent] = useState<GeoLeafletMapComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let active = true;

    void import('./GeoLeafletMap.web')
      .then((mod) => {
        if (active) {
          setMapComponent(() => mod.GeoLeafletMap);
        }
      })
      .catch((err: unknown) => {
        console.error('Erro ao carregar GeoLeafletMap:', err);

        if (active) {
          setLoadError(
            err instanceof Error ? err.message : 'Não foi possível carregar os componentes do mapa.'
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Mapa indisponível</Text>
        <Text style={styles.stateText}>{loadError}</Text>
      </View>
    );
  }

  if (!MapComponent) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color="#38bdf8" />
        <Text style={styles.stateText}>Carregando componentes do mapa...</Text>
      </View>
    );
  }

  return (
    <GeoMapErrorBoundary>
      <MapComponent center={center} markers={markers} onSelectProfile={onSelectProfile} />
    </GeoMapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  stateBox: {
    flex: 1,
    minHeight: 360,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: '#0f172a',
  },
  stateTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
