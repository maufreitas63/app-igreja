import { ghostPassScreenAccess } from '@/lib/ghostNavigation';
import { Alert } from 'react-native';
import type { Href } from 'expo-router';

type RouterLike = {
  replace: (href: Href) => void;
};

/**
 * Fora do Ghost: redireciona imediatamente (o Alert da web nem sempre executa onPress).
 * No Ghost: não redireciona e não alerta — a tela do alvo permanece aberta.
 */
export function denyScreenAccessAndRedirect(
  router: RouterLike,
  redirectPath: string,
  title: string,
  message: string
) {
  if (ghostPassScreenAccess()) {
    return;
  }

  router.replace(redirectPath as Href);
  Alert.alert(title, message);
}
