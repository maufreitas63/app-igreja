// app/(tabs)/_layout.tsx
import { useMemberSessionRouteGuard } from '@/hooks/useMemberSessionRouteGuard';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  useMemberSessionRouteGuard();

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Índice',
          href: '/(tabs)',
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Check-in',
          href: null
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}