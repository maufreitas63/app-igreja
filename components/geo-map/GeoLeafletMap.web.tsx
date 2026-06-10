import { MAP_PIN_COLOR, type MapMarker, type ProfileForMap } from '@/lib/profilesMapMarkersTypes';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import React, { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';

type GeoLeafletMapProps = {
  center: [number, number];
  markers: MapMarker[];
  highlightedProfileId?: string | null;
  onSelectProfile: (profile: ProfileForMap) => void;
};

const pinIconCache = new Map<string, L.DivIcon>();

const createPinIcon = (color: string, size: number, emphasized = false) => {
  const cacheKey = `${color}-${size}-${emphasized ? '1' : '0'}`;
  const cached = pinIconCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const borderWidth = emphasized ? 3 : 2;
  const shadow = emphasized
    ? `0 0 0 2px #0f172a, 0 0 10px ${color}`
    : '0 0 0 1px rgba(255,255,255,0.35)';

  const icon = L.divIcon({
    className: 'geo-pin-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:${borderWidth}px solid ${emphasized ? '#ffffff' : '#0f172a'};box-shadow:${shadow};"></div>`,
  });

  pinIconCache.set(cacheKey, icon);

  return icon;
};

const pinIconForMarker = (profile: ProfileForMap, highlightedProfileId: string | null) => {
  if (highlightedProfileId && profile.id === highlightedProfileId) {
    return createPinIcon(MAP_PIN_COLOR.highlighted, 18, true);
  }

  return createPinIcon(
    profile.isVisitantesOnly ? MAP_PIN_COLOR.visitante : MAP_PIN_COLOR.member,
    12,
    false
  );
};

const FitAllMarkersBounds = ({ markers }: { markers: MapMarker[] }) => {
  const map = useMap();

  useEffect(() => {
    if (!markers.length) {
      return;
    }

    const fitAllPins = () => {
      map.invalidateSize();

      const bounds = L.latLngBounds(markers.map((marker) => [marker.coord.lat, marker.coord.lng]));
      map.fitBounds(bounds, {
        padding: [36, 36],
        maxZoom: 15,
        animate: false,
      });
    };

    fitAllPins();
    const timer = window.setTimeout(fitAllPins, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [map, markers]);

  return null;
};

export function GeoLeafletMap({
  center,
  markers,
  highlightedProfileId = null,
  onSelectProfile,
}: GeoLeafletMapProps) {
  const leafletCenter = useMemo<[number, number]>(() => center, [center[0], center[1]]);

  return (
    <div style={mapShellStyle}>
      <MapContainer
        center={leafletCenter}
        zoom={11}
        minZoom={8}
        maxZoom={18}
        scrollWheelZoom
        preferCanvas
        style={mapStyle}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitAllMarkersBounds markers={markers} />
        {markers.map(({ profile, coord }) => (
          <Marker
            key={profile.id}
            position={[coord.lat, coord.lng]}
            icon={pinIconForMarker(profile, highlightedProfileId)}
            zIndexOffset={profile.id === highlightedProfileId ? 1000 : 0}
            eventHandlers={{
              click: () => onSelectProfile(profile),
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}

const mapShellStyle: React.CSSProperties = {
  flex: 1,
  width: '100%',
  height: '100%',
  minHeight: 360,
  backgroundColor: '#0f172a',
};

const mapStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 360,
};
