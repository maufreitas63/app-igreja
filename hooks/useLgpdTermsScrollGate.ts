import { useCallback, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const SCROLL_END_TOLERANCE_PX = 24;
const SHORT_CONTENT_TOLERANCE_PX = 12;

export function useLgpdTermsScrollGate() {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const viewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);

  const evaluateScrollReadComplete = useCallback((offsetY = 0) => {
    const viewportHeight = viewportHeightRef.current;
    const contentHeight = contentHeightRef.current;

    if (viewportHeight <= 0 || contentHeight <= 0) {
      return;
    }

    if (contentHeight <= viewportHeight + SHORT_CONTENT_TOLERANCE_PX) {
      setHasScrolledToBottom(true);
      return;
    }

    if (offsetY + viewportHeight >= contentHeight - SCROLL_END_TOLERANCE_PX) {
      setHasScrolledToBottom(true);
    }
  }, []);

  const resetScrollGate = useCallback(() => {
    viewportHeightRef.current = 0;
    contentHeightRef.current = 0;
    setHasScrolledToBottom(false);
  }, []);

  const onTermsViewportLayout = useCallback(
    (height: number) => {
      viewportHeightRef.current = height;
      evaluateScrollReadComplete(0);
    },
    [evaluateScrollReadComplete]
  );

  const onTermsContentSizeChange = useCallback(
    (height: number) => {
      contentHeightRef.current = height;
      evaluateScrollReadComplete(0);
    },
    [evaluateScrollReadComplete]
  );

  const onTermsScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      viewportHeightRef.current = layoutMeasurement.height;
      contentHeightRef.current = contentSize.height;
      evaluateScrollReadComplete(contentOffset.y);
    },
    [evaluateScrollReadComplete]
  );

  return {
    hasScrolledToBottom,
    resetScrollGate,
    onTermsViewportLayout,
    onTermsContentSizeChange,
    onTermsScroll,
  };
}
