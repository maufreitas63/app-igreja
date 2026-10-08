import { HomeAdmissionSticker } from '@/components/minimal/HomeAdmissionSticker';
import { MinimalMainPanel } from '@/components/minimal/MinimalMainPanel';
import { MinimalEuQueroFooter } from '@/components/minimal/MinimalEuQueroFooter';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useHomeBackExitConfirmation } from '@/hooks/useHomeBackExitConfirmation';
import { MINIMAL_SCREEN_PADDING_LEFT, MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const SCREEN_PADDING_LEFT = 16 / 390;
const SCREEN_PADDING_RIGHT = 20 / 390;
const HOME_CONTENT_WIDTH = `${(95 * (1 - SCREEN_PADDING_LEFT - SCREEN_PADDING_RIGHT)).toFixed(2)}%`;

export default function DashboardIndexScreen() {
  useHomeBackExitConfirmation();

  return (
    <MinimalScreenLayout
      scroll={false}
      showGreeting
      overlay={<HomeAdmissionSticker />}
      footerBleed
      footer={
        <View style={styles.homeFooterBleed}>
          <View style={styles.homeFooter}>
            <MinimalEuQueroFooter />
          </View>
        </View>
      }
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
  homeFooterBleed: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    backgroundColor: '#EEF3F8',
    borderTopWidth: 1,
    borderTopColor: MINIMAL_UI.divider,
    paddingTop: 8,
  },
  homeFooter: {
    flexShrink: 0,
    minHeight: 0,
    width: HOME_CONTENT_WIDTH,
    maxWidth: HOME_CONTENT_WIDTH,
    marginLeft: MINIMAL_SCREEN_PADDING_LEFT,
    alignSelf: 'flex-start',
  },
});
