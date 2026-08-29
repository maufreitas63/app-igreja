import { Redirect } from 'expo-router';

/** Rota congelada (template Expo). Ver `lib/frozenPublication.ts`. */
export default function ExploreScreen() {
  return <Redirect href="/(tabs)" />;
}
