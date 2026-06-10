import React from 'react';
import { Platform, type ViewStyle } from 'react-native';
import { ErrorToast, InfoToast, SuccessToast, type ToastConfig } from 'react-native-toast-message';

const TOAST_MAX_WIDTH = Platform.select({ web: 440, default: 360 }) ?? 360;

const multilineToastStyle: ViewStyle = {
  height: undefined,
  minHeight: 56,
  maxWidth: TOAST_MAX_WIDTH,
  width: '92%',
  paddingVertical: 10,
};

const multilineToastProps = {
  text1NumberOfLines: 3,
  text2NumberOfLines: 6,
  contentContainerStyle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flex: 1,
    justifyContent: 'center' as const,
  },
  text1Style: {
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  text2Style: {
    fontSize: 13,
    lineHeight: 18,
  },
};

const renderMultilineToast = (
  ToastComponent: typeof SuccessToast,
  props: React.ComponentProps<typeof SuccessToast>
) => (
  <ToastComponent {...props} {...multilineToastProps} style={[multilineToastStyle, props.style]} />
);

export const appToastConfig: ToastConfig = {
  success: (props) => renderMultilineToast(SuccessToast, props),
  error: (props) => renderMultilineToast(ErrorToast, props),
  info: (props) => renderMultilineToast(InfoToast, props),
};
