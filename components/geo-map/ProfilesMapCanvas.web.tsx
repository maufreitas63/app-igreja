import { ClientGeoLeafletMap } from '@/components/geo-map/ClientGeoLeafletMap.web';
import type { MapMarker, ProfileForMap } from '@/lib/profilesMapMarkersTypes';
import React from 'react';

type ProfilesMapCanvasProps = {
  center: [number, number];
  markers: MapMarker[];
  highlightedProfileId?: string | null;
  onSelectProfile: (profile: ProfileForMap) => void;
  pinsInteractive?: boolean;
};

/** PWA/web — Leaflet (mantém o mapa já validado em produção). */
export function ProfilesMapCanvas(props: ProfilesMapCanvasProps) {
  return <ClientGeoLeafletMap {...props} />;
}
