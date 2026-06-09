import {
  APP_WATERMARK_IMAGE,
  APP_WATERMARK_OPACITY,
} from '@/lib/appWatermark';
import {
  buildDashboardPanelCardSizeStyle,
  computeDashboardCardHeight,
  computePanelCardTopOffset,
} from '@/lib/dashboardPanelLayout';
import type { PropsWithChildren } from 'react';
import { Image, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type WatermarkSurfaceProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Marca d'água única do app (via AppShell).
 * Limitada ao frame do card central (90% da largura), não à área total do dashboard.
 */
export function WatermarkSurface({ children, style }: WatermarkSurfaceProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardHeight = computeDashboardCardHeight(windowHeight, insets.top, insets.bottom);
  const cardSize = buildDashboardPanelCardSizeStyle(windowWidth, cardHeight);
  const cardTop = computePanelCardTopOffset(
    windowHeight,
    insets.top,
    insets.bottom,
    cardHeight
  );
  const imageWidth = Math.max(cardSize.width * 1.2, cardHeight * 1.15);

  return (
    <View style={[styles.surface, style]}>
      <View
        style={[
          styles.cardFrame,
          {
            top: cardTop,
            left: (windowWidth - cardSize.width) / 2,
            width: cardSize.width,
            height: cardHeight,
          },
        ]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Image
          source={APP_WATERMARK_IMAGE}
          style={[
            styles.image,
            {
              height: cardHeight,
              width: imageWidth,
              opacity: APP_WATERMARK_OPACITY,
            },
          ]}
          resizeMode="contain"
          accessible={false}
        />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

/** @deprecated Use WatermarkSurface. Mantido para imports antigos. */
export const AppWatermark = WatermarkSurface;

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
    overflow: 'hidden',
  },
  cardFrame: {
    position: 'absolute',
    zIndex: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
  image: {
    maxWidth: '140%',
  },
});
