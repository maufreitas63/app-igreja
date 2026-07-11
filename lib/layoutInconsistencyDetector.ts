import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import { triggerSuperAdminDebugHaptic } from '@/lib/debugHaptics';

export type LayoutInconsistency = {
  kind: 'overflow' | 'overlap';
  name: string;
  detail?: string;
};

const IGNORE_SELECTOR = [
  '[data-layout-ignore="true"]',
  '[aria-hidden="true"]',
].join(',');

const OVERLAP_MIN_AREA = 120;
const OVERFLOW_PX = 2;
const SCAN_COOLDOWN_MS = 4_000;

let lastSignature = '';
let lastReportAt = 0;

function isSkippable(el: Element): boolean {
  if (!(el instanceof HTMLElement)) {
    return true;
  }

  if (el.closest(IGNORE_SELECTOR)) {
    return true;
  }

  const style = window.getComputedStyle(el);
  if (
    style.display === 'none'
    || style.visibility === 'hidden'
    || style.opacity === '0'
    || style.pointerEvents === 'none'
  ) {
    return true;
  }

  const rect = el.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) {
    return true;
  }

  // Fora da viewport vertical (não atrapalha a tela atual).
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    return true;
  }

  return false;
}

function nameElement(el: Element): string {
  const html = el as HTMLElement;
  const attrs = [
    html.getAttribute('aria-label'),
    html.getAttribute('accessibilityLabel'),
    html.getAttribute('accessibilitylabel'),
    html.getAttribute('data-testid'),
    html.getAttribute('testID'),
    html.getAttribute('data-name'),
    html.id || null,
  ];

  for (const value of attrs) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed.slice(0, 120);
    }
  }

  const text = (html.innerText || html.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  if (text) {
    return `"${text}"`;
  }

  const className =
    typeof html.className === 'string'
      ? html.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.')
      : '';

  return className
    ? `${html.tagName.toLowerCase()}.${className}`
    : html.tagName.toLowerCase();
}

function collectCandidateElements(): HTMLElement[] {
  if (typeof document === 'undefined' || !document.body) {
    return [];
  }

  const nodes = Array.from(document.body.querySelectorAll('*'));
  const candidates: HTMLElement[] = [];

  for (const node of nodes) {
    if (isSkippable(node)) {
      continue;
    }
    candidates.push(node as HTMLElement);
    if (candidates.length >= 400) {
      break;
    }
  }

  return candidates;
}

function detectOverflow(elements: HTMLElement[]): LayoutInconsistency[] {
  const issues: LayoutInconsistency[] = [];
  const viewportWidth = window.innerWidth;
  const docOverflow =
    document.documentElement.scrollWidth > document.documentElement.clientWidth + OVERFLOW_PX
    || document.body.scrollWidth > document.body.clientWidth + OVERFLOW_PX;

  const seen = new Set<string>();

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    const overflowsViewport =
      rect.right > viewportWidth + OVERFLOW_PX || rect.left < -OVERFLOW_PX;
    const overflowsSelf =
      el.scrollWidth > el.clientWidth + OVERFLOW_PX
      && window.getComputedStyle(el).overflowX !== 'hidden';

    if (!overflowsViewport && !overflowsSelf && !docOverflow) {
      continue;
    }

    if (!overflowsViewport && !overflowsSelf) {
      continue;
    }

    const name = nameElement(el);
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);

    issues.push({
      kind: 'overflow',
      name,
      detail: overflowsViewport
        ? `viewport right=${Math.round(rect.right)} / width=${viewportWidth}`
        : `scrollWidth=${el.scrollWidth} clientWidth=${el.clientWidth}`,
    });

    if (issues.length >= 12) {
      break;
    }
  }

  if (docOverflow && issues.length === 0) {
    issues.push({
      kind: 'overflow',
      name: 'document',
      detail: `scrollWidth=${document.documentElement.scrollWidth} clientWidth=${document.documentElement.clientWidth}`,
    });
  }

  return issues;
}

function rectsOverlapSignificantly(a: DOMRect, b: DOMRect): boolean {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  const width = right - left;
  const height = bottom - top;
  if (width <= 2 || height <= 2) {
    return false;
  }
  return width * height >= OVERLAP_MIN_AREA;
}

function detectOverlaps(elements: HTMLElement[]): LayoutInconsistency[] {
  const issues: LayoutInconsistency[] = [];
  const seen = new Set<string>();

  // Prioriza nós com texto ou papel interativo (menos ruído de wrappers).
  const ranked = elements
    .map((el) => {
      const role = el.getAttribute('role') || '';
      const interactive =
        /button|link|textbox|checkbox|switch|menuitem/.test(role)
        || el.tagName === 'BUTTON'
        || el.tagName === 'A'
        || el.getAttribute('tabindex') === '0';
      const hasText = Boolean((el.innerText || '').trim());
      return { el, score: (interactive ? 2 : 0) + (hasText ? 1 : 0) };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 80)
    .map((row) => row.el);

  for (let i = 0; i < ranked.length; i += 1) {
    const a = ranked[i];
    const aRect = a.getBoundingClientRect();

    for (let j = i + 1; j < ranked.length; j += 1) {
      const b = ranked[j];
      if (a.contains(b) || b.contains(a)) {
        continue;
      }

      const bRect = b.getBoundingClientRect();
      if (!rectsOverlapSignificantly(aRect, bRect)) {
        continue;
      }

      const nameA = nameElement(a);
      const nameB = nameElement(b);
      const key = [nameA, nameB].sort().join(' ↔ ');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      issues.push({
        kind: 'overlap',
        name: key,
        detail: 'elementos se sobrepõem na viewport',
      });

      if (issues.length >= 10) {
        return issues;
      }
    }
  }

  return issues;
}

export function scanLayoutInconsistencies(): LayoutInconsistency[] {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return [];
  }

  const elements = collectCandidateElements();
  return [...detectOverflow(elements), ...detectOverlaps(elements)];
}

function formatLayoutClipboardText(
  issues: LayoutInconsistency[],
  pathname?: string | null
): string {
  const lines = [
    '[layout-inconsistency] Elementos fora do layout',
    pathname ? `Rota: ${pathname}` : null,
    `Quando: ${new Date().toISOString()}`,
    `Plataforma: ${Platform.OS}`,
    '',
    ...issues.map((issue, index) => {
      const prefix = issue.kind === 'overflow' ? 'overflow' : 'overlap';
      return `${index + 1}. [${prefix}] ${issue.name}${issue.detail ? ` — ${issue.detail}` : ''}`;
    }),
  ];

  return lines.filter((line) => line !== null).join('\n');
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Escaneia a tela (web). Se houver overflow/sobreposição e o usuário for super admin,
 * copia os nomes dos elementos e vibra (com cooldown por assinatura).
 */
export async function reportLayoutInconsistenciesIfNeeded(options?: {
  pathname?: string | null;
  force?: boolean;
}): Promise<LayoutInconsistency[]> {
  if (Platform.OS !== 'web') {
    return [];
  }

  const isSuperAdmin = await checkSessionIsSuperAdmin();
  if (!isSuperAdmin) {
    return [];
  }

  const issues = scanLayoutInconsistencies();
  if (issues.length === 0) {
    lastSignature = '';
    return [];
  }

  const signature = issues.map((issue) => `${issue.kind}:${issue.name}`).sort().join('|');
  const now = Date.now();

  if (
    !options?.force
    && signature === lastSignature
    && now - lastReportAt < SCAN_COOLDOWN_MS
  ) {
    return issues;
  }

  lastSignature = signature;
  lastReportAt = now;

  const text = formatLayoutClipboardText(issues, options?.pathname);
  const copied = await writeClipboard(text);
  if (copied) {
    await triggerSuperAdminDebugHaptic();
  }

  return issues;
}
