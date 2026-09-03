import type { MapMarker, ProfileForMap } from '@/lib/profilesMapMarkersTypes';
import { MAP_PIN_COLOR } from '@/lib/profilesMapMarkersTypes';
import { formatShortName } from '@/lib/formatShortName';
import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

type ProfilesMapCanvasProps = {
  center: [number, number];
  markers: MapMarker[];
  highlightedProfileId?: string | null;
  onSelectProfile: (profile: ProfileForMap) => void;
  pinsInteractive?: boolean;
};

/**
 * Mapa nativo (Android/iOS) — paridade com Leaflet no PWA.
 * Usa Google Maps no Android quando a API key estiver no app.config.
 *
 * Clustering: `react-native-map-clustering` (2023) usa findNodeHandle/getNode e
 * não é compatível com a New Architecture do SDK 54. O mapa nativo usa
 * `react-native-maps` 1.20. O cluster permanece só no Leaflet da web.
 */
export function ProfilesMapCanvas({
  center,
  markers,
  highlightedProfileId = null,
  onSelectProfile,
  pinsInteractive = true,
}: ProfilesMapCanvasProps) {
  const mapRef = useRef<MapView | null>(null);

  const initialRegion = useMemo<Region>(
    () => ({
      latitude: center[0],
      longitude: center[1],
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    }),
    [center]
  );

  useEffect(() => {
    if (!markers.length) {
      return;
    }

    const coords = markers.map((marker) => ({
      latitude: marker.coord.lat,
      longitude: marker.coord.lng,
    }));

    requestAnimationFrame(() => {
      try {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
          animated: true,
        });
      } catch {
        // fitToCoordinates pode falhar se o mapa ainda não montou.
      }
    });
  }, [markers]);

  useEffect(() => {
    if (!highlightedProfileId) {
      return;
    }

    const target = markers.find((marker) => marker.profile.id === highlightedProfileId);
    if (!target) {
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: target.coord.lat,
        longitude: target.coord.lng,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      350
    );
  }, [highlightedProfileId, markers]);

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {markers.map((marker) => {
          const isHighlighted = highlightedProfileId === marker.profile.id;
          const pinColor = isHighlighted
            ? MAP_PIN_COLOR.highlighted
            : marker.profile.isSmallGroupHost
              ? MAP_PIN_COLOR.smallGroup
            : marker.profile.isVisitantesOnly
              ? MAP_PIN_COLOR.visitante
              : MAP_PIN_COLOR.member;

          return (
            <Marker
              key={marker.profile.id}
              coordinate={{
                latitude: marker.coord.lat,
                longitude: marker.coord.lng,
              }}
              pinColor={pinColor}
              title={formatShortName(marker.profile.full_name)}
              description={marker.profile.roleLabel}
              onPress={() => {
                if (!pinsInteractive) {
                  return;
                }
                onSelectProfile(marker.profile);
              }}
              tracksViewChanges={false}
            />
          );
        })}
      </MapView>
      {!markers.length ? (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>Nenhum pin para exibir.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 280,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    pointerEvents: 'none',
  },
  emptyText: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
});
