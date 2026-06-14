import type { LatLng } from '@/lib/geoMapGeocoding';

export type ProfileForMap = {
  id: string;
  full_name: string | null;
  phone: string | null;
  cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  /** true = pin azul (visitante); false = pin vermelho (demais papéis). */
  isVisitantesOnly: boolean;
  /** Nome do papel ACL exibido no mapa (ex.: Congregado, Membro, Visitante). */
  roleLabel: string;
};

export type MapMarker = {
  profile: ProfileForMap;
  coord: LatLng;
  cepDigits: string;
};

export const MAP_PIN_COLOR = {
  member: '#ef4444',
  visitante: '#3b82f6',
  /** Pin em destaque ao abrir o mapa a partir da Lista de Membros. */
  highlighted: '#22d3ee',
} as const;
