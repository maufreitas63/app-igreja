import { Alert } from 'react-native';
import type { Href } from 'expo-router';

type RouterLike = {
  replace: (href: Href | string) => void;
};

/**
 * No web, `Alert.alert(..., [{ onPress }])` frequentemente não executa o onPress.
 * Sempre redireciona imediatamente e só informa o usuário.
 */
export function denyScreenAccessAndRedirect(
  router: RouterLike,
  redirectPath: string,
  title: string,
  message: string
) {
  router.replace(redirectPath as Href);
  Alert.alert(title, message);
}
