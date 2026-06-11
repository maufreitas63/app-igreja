import { isPwaInstalled } from '@/lib/pwaInstall';
import { Platform } from 'react-native';

export type ExitSessionUi = {
  button: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  errorMessage: string;
};

const BROWSER_EXIT_SESSION_UI: ExitSessionUi = {
  button: 'Encerrar sessão',
  accessibilityLabel: 'Encerrar sessão',
  accessibilityHint:
    'Remove os dados de login deste navegador e retorna à tela de entrada.',
  errorMessage: 'Não foi possível encerrar a sessão.',
};

const INSTALLED_APP_EXIT_SESSION_UI: ExitSessionUi = {
  button: 'Sair do aplicativo',
  accessibilityLabel: 'Sair do aplicativo',
  accessibilityHint: 'Encerra a sessão e fecha o aplicativo.',
  errorMessage: 'Não foi possível sair do aplicativo.',
};

export function getExitSessionUi(): ExitSessionUi {
  if (Platform.OS !== 'web' || isPwaInstalled()) {
    return INSTALLED_APP_EXIT_SESSION_UI;
  }

  return BROWSER_EXIT_SESSION_UI;
}

/** @deprecated Use `getExitSessionUi()` para respeitar PWA instalado vs navegador. */
export const EXIT_SESSION_UI = getExitSessionUi();
