import { EventsInboxHome } from '@/components/minimal/EventsInboxHome';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** Conteúdo principal da home minimalista (eventos). */
export function MinimalMainPanel() {
  return (
    <View style={styles.panel}>
      <EventsInboxHome />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
