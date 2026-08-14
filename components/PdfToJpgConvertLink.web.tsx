import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  href: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onLaunch?: () => void;
  children: React.ReactNode;
};

function launchProtocolWithoutLeavingPage(href: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.src = href;
  iframe.style.display = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 4000);
}

export function PdfToJpgConvertLink({ href, disabled, style, onLaunch, children }: Props) {
  return (
    <Pressable
      style={style}
      disabled={disabled}
      onPress={() => {
        onLaunch?.();
        launchProtocolWithoutLeavingPage(href);
      }}
    >
      {children}
    </Pressable>
  );
}
