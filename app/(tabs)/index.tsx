import { MinimalMainPanel } from '@/components/minimal/MinimalMainPanel';
import { MinimalEuQueroFooter } from '@/components/minimal/MinimalEuQueroFooter';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useHomeBackExitConfirmation } from '@/hooks/useHomeBackExitConfirmation';
import React from 'react';
import { StyleSheet } from 'react-native';

export default function DashboardIndexScreen() {
  useHomeBackExitConfirmation();

  return (
    <MinimalScreenLayout
      scroll={false}
      showGreeting
      footer={<MinimalEuQueroFooter />}
      contentContainerStyle={styles.homeMain}
    >
      <MinimalMainPanel />
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  homeMain: {
    width: '95%',
    maxWidth: '95%',
    alignSelf: 'flex-start',
  },
});
