import { MinimalHomeProvider, useMinimalHome } from '@/context/MinimalHomeContext';
import {
  MINIMAL_EXIT_BAR_HEIGHT,
  MINIMAL_TOP_CHROME_BASE,
  MINIMAL_TOP_CHROME_EXPANDED,
  MINIMAL_TOP_CHROME_HEADER,
  MINIMAL_TOP_IDENTITY_BAR_HEIGHT,
  MINIMAL_UI,
} from '@/lib/minimalUiTheme';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppDrawer } from './AppDrawer';
import { MinimalExitBar } from './MinimalExitBar';
import { MinimalTopLeftChrome } from './MinimalTopLeftChrome';

type Props = {
  title?: string;
  header?: React.ReactNode;
  fixedTop?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentContainerStyle?: ViewStyle;
  /** Quando false, o conteúdo ocupa flex:1 sem ScrollView (telas com listas internas). */
  scroll?: boolean;
};

function MinimalScreenLayoutBody({
  title,
  header,
  fixedTop,
  children,
  footer,
  contentContainerStyle,
  scroll = true,
}: Props) {
  const { expandedEventId } = useMinimalHome();
  const useScroll = scroll && !expandedEventId;

  const contentPaddingTop = useMemo(() => {
    let top =
      MINIMAL_TOP_IDENTITY_BAR_HEIGHT +
      (expandedEventId ? MINIMAL_TOP_CHROME_EXPANDED : MINIMAL_TOP_CHROME_BASE);

    if (header) {
      top += MINIMAL_TOP_CHROME_HEADER;
    } else if (title) {
      top += 28;
    }

    return top;
  }, [expandedEventId, header, title]);

  const contentPaddingBottom = MINIMAL_EXIT_BAR_HEIGHT + 12;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppDrawer />
      <MinimalTopLeftChrome title={title} header={header} />

      <View
        style={[
          styles.body,
          { paddingTop: contentPaddingTop, paddingBottom: MINIMAL_EXIT_BAR_HEIGHT },
        ]}
      >
        {fixedTop ? <View style={styles.fixedTop}>{fixedTop}</View> : null}

        {useScroll ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: contentPaddingBottom },
              contentContainerStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.flexContent,
              { paddingBottom: contentPaddingBottom },
              contentContainerStyle,
            ]}
          >
            {children}
          </View>
        )}

        {footer ? <View style={[styles.footer, { bottom: MINIMAL_EXIT_BAR_HEIGHT }]}>{footer}</View> : null}
      </View>

      <MinimalExitBar />
    </SafeAreaView>
  );
}

export function MinimalScreenLayout(props: Props) {
  return (
    <MinimalHomeProvider>
      <MinimalScreenLayoutBody {...props} />
    </MinimalHomeProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  fixedTop: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: MINIMAL_UI.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  flexContent: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: MINIMAL_UI.background,
    zIndex: 10,
  },
});
