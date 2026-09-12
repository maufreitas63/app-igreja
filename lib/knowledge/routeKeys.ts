import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import type { Href } from 'expo-router';

/** Chaves estáveis ligadas à rota visível (não à URL crua com query extra). */
export const KNOWLEDGE_ROUTE = {
  home: 'home',
  perfil: '/perfil',
  ofertas: '/ofertas',
  pastoral: '/pastoral',
  escalas: '/escalas',
  financial: '/financial',
  alianca: '/alianca-conecta-reino',
  igrejas: '/igrejas',
  totem: '/totem-checkin',
  billing: '/billing',
  relatorios: 'maintenance-dashboard?panel=relatorios',
  mudancaPapeis: 'maintenance-dashboard?panel=mudanca_papeis',
  auditor: 'maintenance-dashboard?panel=auditor',
  accessControl: 'maintenance-dashboard?panel=access_control',
  suggestions: '/suggestions-improvements',
} as const;

export type KnowledgeRouteKey = (typeof KNOWLEDGE_ROUTE)[keyof typeof KNOWLEDGE_ROUTE];

export const KNOWLEDGE_ROLE_OPTIONS: { code: string; label: string }[] = [
  { code: 'member', label: 'Membro' },
  { code: 'congregado', label: 'Congregado' },
  { code: 'visitante', label: 'Visitante' },
  { code: 'visitantes', label: 'Visitantes' },
  { code: 'pastoral', label: 'Pastoral' },
  { code: 'tesoureiro', label: 'Tesoureiro' },
  { code: 'secretaria', label: 'Secretaria' },
  { code: 'events_admin', label: 'Eventos' },
  { code: 'gestor_controle_acesso', label: 'Gestor de acesso' },
  { code: 'super_admin', label: 'Super Administrador' },
];

export function knowledgeRouteHref(routeKey: string): Href | null {
  switch (routeKey) {
    case KNOWLEDGE_ROUTE.home:
      return MEMBER_HOME_PATH;
    case KNOWLEDGE_ROUTE.perfil:
      return '/perfil';
    case KNOWLEDGE_ROUTE.ofertas:
      return '/ofertas';
    case KNOWLEDGE_ROUTE.pastoral:
      return '/pastoral';
    case KNOWLEDGE_ROUTE.escalas:
      return '/escalas';
    case KNOWLEDGE_ROUTE.financial:
      return '/financial';
    case KNOWLEDGE_ROUTE.alianca:
      return '/alianca-conecta-reino';
    case KNOWLEDGE_ROUTE.igrejas:
      return '/igrejas';
    case KNOWLEDGE_ROUTE.totem:
      return '/totem-checkin';
    case KNOWLEDGE_ROUTE.billing:
      return '/billing';
    case KNOWLEDGE_ROUTE.suggestions:
      return '/suggestions-improvements';
    case KNOWLEDGE_ROUTE.relatorios:
      return {
        pathname: '/maintenance-dashboard',
        params: { panel: 'relatorios' },
      } as Href;
    case KNOWLEDGE_ROUTE.mudancaPapeis:
      return {
        pathname: '/maintenance-dashboard',
        params: { panel: 'mudanca_papeis' },
      } as Href;
    case KNOWLEDGE_ROUTE.auditor:
      return {
        pathname: '/maintenance-dashboard',
        params: { panel: 'auditor' },
      } as Href;
    case KNOWLEDGE_ROUTE.accessControl:
      return {
        pathname: '/maintenance-dashboard',
        params: { panel: 'access_control' },
      } as Href;
    default:
      if (routeKey.startsWith('/')) {
        return routeKey as Href;
      }
      return null;
  }
}
