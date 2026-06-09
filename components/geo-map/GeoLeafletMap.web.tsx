import { MAP_PIN_COLOR, type MapMarker, type ProfileForMap } from '@/lib/profilesMapMarkersTypes';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import React, { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';

type GeoLeafletMapProps = {
  center: [number, number];
  markers: MapMarker[];
  onSelectProfile: (profile: ProfileForMap) => void;
};

const pinIconCache = new Map<string, L.DivIcon>();

const createPinIcon = (color: string) => {
  const cached = pinIconCache.get(color);

  if (cached) {
    return cached;
  }

  const icon = L.divIcon({
    className: 'geo-pin-icon',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    html: `<div style="width:12px;height:12px;border-radius:999px;background:${color};border:2px solid #0f172a;box-shadow:0 0 0 1px rgba(255,255,255,0.35);"></div>`,
  });

  pinIconCache.set(color, icon);

  return icon;
};

const pinIconForProfile = (profile: ProfileForMap) =>
  createPinIcon(profile.isVisitantesOnly ? MAP_PIN_COLOR.visitante : MAP_PIN_COLOR.member);

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

export function GeoLeafletMap({ center, markers, onSelectProfile }: GeoLeafletMapProps) {
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
            icon={pinIconForProfile(profile)}
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
