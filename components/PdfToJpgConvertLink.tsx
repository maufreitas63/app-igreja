import React from 'react';
import { Linking, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  href: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onLaunch?: () => void;
  children: React.ReactNode;
};

export function PdfToJpgConvertLink({ href, disabled, style, onLaunch, children }: Props) {
  return (
    <TouchableOpacity
      style={style}
      disabled={disabled}
      activeOpacity={0.85}
      onPress={() => {
        onLaunch?.();
        void Linking.openURL(href);
      }}
    >
      {children}
    </TouchableOpacity>
  );
}
