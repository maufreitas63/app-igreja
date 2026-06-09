// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';

export default function TabLayout() {
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
        name="dashboard" // Isso precisa bater exatamente com o nome do arquivo dashboard.tsx
        options={{ 
          title: 'Check-in',
          href: null
        }} 
      />
    </Tabs>
  );
}