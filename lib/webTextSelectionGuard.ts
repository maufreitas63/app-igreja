import { Platform, type ViewStyle } from 'react-native';

/** CSS global para impedir seleção de texto e callout de busca no PWA. */
export const WEB_NON_SELECTABLE_CSS = `
  html,
  body,
  #root,
  #root * {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  input,
  textarea,
  [contenteditable='true'],
  [data-selectable='true'] {
    -webkit-user-select: text;
    -moz-user-select: text;
    -ms-user-select: text;
    user-select: text;
    -webkit-touch-callout: default;
  }
`;

export function isWebTextSelectionAllowedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest('input, textarea, [contenteditable="true"], [data-selectable="true"]')
  );
}

/** Bloqueia menu de contexto e início de seleção fora de campos editáveis. */
export function installWebTextSelectionGuard(): () => void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return () => {};
  }

  const blockUnlessAllowed = (event: Event) => {
    if (isWebTextSelectionAllowedTarget(event.target)) {
      return;
    }

    event.preventDefault();
  };

  document.addEventListener('contextmenu', blockUnlessAllowed);
  document.addEventListener('selectstart', blockUnlessAllowed);

  return () => {
    document.removeEventListener('contextmenu', blockUnlessAllowed);
    document.removeEventListener('selectstart', blockUnlessAllowed);
  };
}

export const WEB_NON_SELECTABLE_VIEW_STYLES = Platform.select<ViewStyle>({
  web: {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  } as ViewStyle,
  default: {},
});
