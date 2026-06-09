import { Platform } from 'react-native';

export const EXIT_SESSION_UI =
  Platform.OS === 'web'
    ? {
        button: 'Encerrar sessão',
        accessibilityLabel: 'Encerrar sessão',
        accessibilityHint:
          'Remove os dados de login deste navegador e retorna à tela de entrada.',
        errorMessage: 'Não foi possível encerrar a sessão.',
      }
    : {
        button: 'Sair do aplicativo',
        accessibilityLabel: 'Sair do aplicativo',
        accessibilityHint: 'Encerra a sessão e retorna à tela de login.',
        errorMessage: 'Não foi possível sair do aplicativo.',
      };
