import React from 'react';
import { Linking, Pressable, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  href: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onLaunch?: () => void;
  children: React.ReactNode;
};

export function PdfToJpgConvertLink({ href, disabled, style, onLaunch, children }: Props) {
  return (
    <Pressable
      style={style}
      disabled={disabled}
      onPress={() => {
        onLaunch?.();
        void Linking.openURL(href);
      }}
    >
      {children}
    </Pressable>
  );
}
