import { AdministrativoClass } from '@/components/AdministrativoClass';
import { withMinimalPresentation, withReturnRoute } from '@/lib/dashboardReturnNavigation';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

/** Container com navegação — compõe o AdministrativoClass stateless. */
export function AdministrativoClassPanel() {
  const router = useRouter();

  const handleOpenExpenseReport = useCallback(() => {
    router.push({
      pathname: '/expense-report',
      params: withReturnRoute('/administrativo', withMinimalPresentation()),
    });
  }, [router]);

  return (
    <View style={styles.root}>
      <AdministrativoClass onPressRd={handleOpenExpenseReport} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
