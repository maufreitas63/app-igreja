import { Redirect } from 'expo-router';

/** Rota-template do Expo; não faz parte do app. */
export default function ExploreScreen() {
  return <Redirect href="/(tabs)/dashboard" />;
}
