import { MinimalHomeProvider } from '@/context/MinimalHomeContext';
import { cn } from '@/lib/utils';
import React from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppDrawer } from './AppDrawer';
import { MinimalTopLeftChrome } from './MinimalTopLeftChrome';

type Props = {
  /** «Olá, {nome}» visível na home; nas demais o espaço permanece (texto invisível). */
  showGreeting?: boolean;
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
  showGreeting = false,
}: Props) {
  return (
    <SafeAreaView
      className="w-full min-w-0 max-w-full flex-1 overflow-hidden bg-minimal-bg"
      edges={['top', 'left', 'right']}
    >
      <AppDrawer />
      <View className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-hidden">
        <MinimalTopLeftChrome title={title} header={header} showGreeting={showGreeting} />

        <View className="min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden">
          {fixedTop ? (
            <View className="w-full min-w-0 max-w-full shrink-0 bg-minimal-bg px-4 pb-2">{fixedTop}</View>
          ) : null}

          {scroll ? (
            <ScrollView
              className="min-h-0 w-full min-w-0 max-w-full flex-1"
              contentContainerStyle={[{ paddingHorizontal: 16, paddingBottom: 12, maxWidth: '100%', minWidth: 0, alignSelf: 'stretch' }, contentContainerStyle]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {children}
            </ScrollView>
          ) : (
            <View
              className={cn(
                'min-h-0 w-full min-w-0 max-w-full flex-1 self-stretch overflow-hidden px-4'
              )}
              style={contentContainerStyle}
            >
              {children}
            </View>
          )}

          {footer ? (
            <View className="w-full min-w-0 max-w-full shrink-0 self-stretch bg-minimal-bg px-4">{footer}</View>
          ) : null}
        </View>
      </View>
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
