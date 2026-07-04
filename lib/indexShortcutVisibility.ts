import type { DashboardCardViewAccess } from '@/lib/accessControl';
import { resolveDashboardCardContentFromParam } from '@/lib/dashboardCardScreenLinks';
import {
  isDashboardCardFullyAllowed,
  type DashboardScreenAccess,
} from '@/lib/dashboardScreenAccess';

export type IndexShortcutDefinition = {
  id: string;
  label: string;
  dashboardCard: string;
  parentId?: string;
};

export type IndexShortcutGroup = {
  parent: IndexShortcutDefinition;
  children: IndexShortcutDefinition[];
};

export type IndexShortcutVisibilityContext = {
  hasActiveMembership: boolean;
  isQrCheckInShortcutVisible: boolean;
  hasAvailableEvents: boolean;
  dashboardCardAccess: DashboardCardViewAccess;
  dashboardScreenAccess: DashboardScreenAccess;
  accessReady: boolean;
};

export const isIndexShortcutVisible = (
  shortcut: IndexShortcutDefinition,
  context: IndexShortcutVisibilityContext
): boolean => {
  if (!context.accessReady) {
    return false;
  }

  if (shortcut.id === 'administrativo' && !context.hasActiveMembership) {
    return false;
  }

  if (shortcut.id === 'qr-totem' && !context.isQrCheckInShortcutVisible) {
    return false;
  }

  if (shortcut.id === 'salas' && !context.hasAvailableEvents) {
    return false;
  }

  const cardContent = resolveDashboardCardContentFromParam(shortcut.dashboardCard);

  if (!cardContent) {
    return true;
  }

  return isDashboardCardFullyAllowed(
    cardContent,
    context.dashboardCardAccess,
    context.dashboardScreenAccess
  );
};

export const filterVisibleIndexShortcuts = (
  shortcuts: IndexShortcutDefinition[],
  context: IndexShortcutVisibilityContext
): IndexShortcutDefinition[] =>
  shortcuts.filter((shortcut) => isIndexShortcutVisible(shortcut, context));

/** Agrupa atalhos visíveis; filhos cujo pai foi oculto viram item de topo. */
export const buildIndexShortcutGroups = (
  items: IndexShortcutDefinition[]
): IndexShortcutGroup[] => {
  const visibleIds = new Set(items.map((item) => item.id));
  const groups: IndexShortcutGroup[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (item.parentId && !visibleIds.has(item.parentId)) {
      groups.push({
        parent: { ...item, parentId: undefined },
        children: [],
      });
      continue;
    }

    if (item.parentId) {
      continue;
    }

    const children: IndexShortcutDefinition[] = [];
    let childIndex = index + 1;

    while (childIndex < items.length && items[childIndex].parentId === item.id) {
      children.push(items[childIndex]);
      childIndex += 1;
    }

    groups.push({ parent: item, children });
    index = childIndex - 1;
  }

  return groups;
};
