import { ghostBlocksHomeBounce } from '@/lib/ghostNavigation';
import { showAppToast } from '@/lib/appToast';
import { Alert } from 'react-native';
import type { Href } from 'expo-router';

type RouterLike = {
  replace: (href: Href) => void;
};

/**
 * Fora do Ghost: redireciona imediatamente (o Alert da web nem sempre executa onPress).
 * No Ghost: só avisa — o auditor permanece na rota do alvo.
 */
export function denyScreenAccessAndRedirect(
  router: RouterLike,
  redirectPath: string,
  title: string,
  message: string
) {
  if (ghostBlocksHomeBounce()) {
    showAppToast({
      type: 'info',
      text1: title,
      text2: `${message} Modo Ghost: a pessoa simulada não tem este acesso.`,
    });
    return;
  }

  router.replace(redirectPath as Href);
  Alert.alert(title, message);
}
