import { sessionHasAccess } from '@/lib/accessControl';
import { Alert } from 'react-native';

type RouterLike = {
  push: (href: { pathname: string; params?: Record<string, string> }) => void;
  navigate: (href: { pathname: string; params?: Record<string, string> }) => void;
  replace: (href: { pathname: string; params?: Record<string, string> }) => void;
};

export const DASHBOARD_SCREEN_DENIED_MESSAGES: Record<string, string> = {
  '/manage-profile': 'Você não tem permissão para editar Dados Cadastrais.',
  '/manage-members': 'Você não tem permissão para gerenciar a família.',
  '/pastoral': 'Você não tem permissão para abrir o Coração Aberto.',
  '/pastoral-history': 'Você não tem permissão para ver seus pedidos pastorais.',
  '/financial': 'Você não tem permissão para abrir o módulo financeiro.',
  '/mapa-geolocalizacao': 'Você não tem permissão para abrir o mapa de geolocalização.',
  '/expense-report': 'Você não tem permissão para abrir o Relatório de Despesas.',
};

export async function ensureScreenAccess(
  resourceKey: string,
  deniedMessage?: string
): Promise<boolean> {
  const allowed = await sessionHasAccess('screen', resourceKey, 'view');

  if (allowed) {
    return true;
  }

  Alert.alert('Sem permissão', deniedMessage ?? 'Você não tem permissão para abrir esta tela.');
  return false;
}

export async function navigateWithScreenAccess(
  router: RouterLike,
  pathname: string,
  resourceKey: string,
  params?: Record<string, string>,
  options?: { method?: 'push' | 'navigate' | 'replace'; deniedMessage?: string }
): Promise<boolean> {
  const allowed = await ensureScreenAccess(
    resourceKey,
    options?.deniedMessage ?? DASHBOARD_SCREEN_DENIED_MESSAGES[pathname]
  );

  if (!allowed) {
    return false;
  }

  const method = options?.method ?? 'push';
  router[method]({ pathname, params });
  return true;
}
