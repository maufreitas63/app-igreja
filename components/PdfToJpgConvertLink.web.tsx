import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  href: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onLaunch?: () => void;
  children: React.ReactNode;
};

export function PdfToJpgConvertLink({ href, disabled, style, onLaunch, children }: Props) {
  if (disabled) {
    return <View style={style}>{children}</View>;
  }

  return React.createElement(
    'a',
    {
      href,
      onClick: () => {
        onLaunch?.();
      },
      style: {
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
      },
    },
    <View style={style} pointerEvents="none">
      {children}
    </View>
  );
}
