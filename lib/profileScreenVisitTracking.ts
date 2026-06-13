import { ACCESS_SCREEN } from '@/lib/accessControl';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { getStoredProfileId } from '@/lib/userSession';

const ROUTE_SCREEN_LABELS: Record<string, string> = {
  [ACCESS_SCREEN.manageProfile]: 'Dados Cadastrais',
  [ACCESS_SCREEN.manageMembers]: 'Lista de Membros',
  [ACCESS_SCREEN.pastoral]: 'Coração Aberto',
  [ACCESS_SCREEN.pastoralHistory]: 'Histórico Pastoral',
  [ACCESS_SCREEN.financial]: 'Financeiro',
  [ACCESS_SCREEN.expenseReport]: 'Relatório de Despesas',
  [ACCESS_SCREEN.mapGeolocation]: 'Mapa de Geolocalização',
  [ACCESS_SCREEN.lgpd]: 'LGPD',
};

const EXCLUDED_ROUTE_PREFIXES = new Set([
  ACCESS_SCREEN.login,
  '/index',
  ACCESS_SCREEN.register,
  '/totem-checkin',
  '/sessao-encerrada',
  ACCESS_SCREEN.dashboard,
  ACCESS_SCREEN.maintenance,
]);

const EXCLUDED_SCREEN_LABELS = new Set(['Dashboard', 'Manutenção']);

const EXCLUDED_SCREEN_KEYS = new Set([
  ACCESS_SCREEN.dashboard,
  ACCESS_SCREEN.maintenance,
]);

const shouldSkipScreenVisit = (screenKey: string, screenLabel: string) =>
  EXCLUDED_SCREEN_LABELS.has(screenLabel.trim())
  || EXCLUDED_SCREEN_KEYS.has(screenKey.trim());

let lastRecordedScreenKey: string | null = null;
let recordInFlight = false;
let rpcMissingLogged = false;

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || ACCESS_SCREEN.login;
};

export function resolveRouteScreenVisit(pathname: string, segments: string[]) {
  const normalized = normalizePathname(pathname);

  if (segments[0] === '(tabs)' && normalized === ACCESS_SCREEN.login) {
    return null;
  }

  if (EXCLUDED_ROUTE_PREFIXES.has(normalized)) {
    return null;
  }

  const screenLabel = ROUTE_SCREEN_LABELS[normalized] ?? normalized;

  return {
    screenKey: normalized,
    screenLabel,
  };
}

export async function recordProfileScreenVisit(screenKey: string, screenLabel: string) {
  const profileId = await getStoredProfileId();

  if (!profileId) {
    return;
  }

  const key = screenKey.trim();
  const label = screenLabel.trim() || key;

  if (!key || shouldSkipScreenVisit(key, label) || lastRecordedScreenKey === key || recordInFlight) {
    return;
  }

  recordInFlight = true;

  try {
    const { error } = await supabase.rpc('record_profile_app_access_screen_visit', {
      p_screen_key: key,
      p_screen_label: label,
    });

    if (error) {
      if (isSupabaseRpcMissingError(error, 'record_profile_app_access_screen_visit')) {
        if (!rpcMissingLogged) {
          rpcMissingLogged = true;
          console.warn(
            'RPC record_profile_app_access_screen_visit ausente. Execute scripts/profile-access-insights.sql no Supabase.'
          );
        }
        return;
      }

      console.warn('Falha ao registrar tela visitada:', error.message);
      return;
    }

    lastRecordedScreenKey = key;
  } finally {
    recordInFlight = false;
  }
}

export function resetProfileScreenVisitTracking() {
  lastRecordedScreenKey = null;
  recordInFlight = false;
}
