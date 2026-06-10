import {
  APP_WATERMARK_IMAGE,
  APP_WATERMARK_OPACITY,
} from '@/lib/appWatermark';
import {
  buildDashboardPanelCardSizeStyle,
  computeDashboardCardHeight,
  computePanelCardTopOffset,
} from '@/lib/dashboardPanelLayout';
import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type WatermarkSurfaceProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  routeKey?: string;
}>;

/**
 * Marca d'água única do app (via AppShell).
 * Overlay sobre telas e cards, limitado ao frame do card central (90% da largura).
 */
export function WatermarkSurface({ children, style, routeKey = 'root' }: WatermarkSurfaceProps) {
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
  const imageWidth = cardSize.width;

  const cardFrameStyle = {
    top: cardTop,
    left: (windowWidth - cardSize.width) / 2,
    width: cardSize.width,
    height: cardHeight,
  };

  return (
    <View style={[styles.surface, style]}>
      <View style={styles.content}>{children}</View>
      <View
        key={routeKey}
        style={[styles.cardFrame, cardFrameStyle]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.blendWrap, { opacity: APP_WATERMARK_OPACITY }]}>
          <Image
            source={APP_WATERMARK_IMAGE}
            style={[
              styles.image,
              {
                height: cardHeight,
                width: imageWidth,
              },
            ]}
            contentFit="contain"
            transition={0}
            accessible={false}
          />
        </View>
      </View>
    </View>
  );
}

/** @deprecated Use WatermarkSurface. Mantido para imports antigos. */
export const AppWatermark = WatermarkSurface;

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    position: 'relative',
  },
  cardFrame: {
    position: 'absolute',
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 0,
  },
  content: {
    flex: 1,
    zIndex: 0,
  },
  blendWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    mixBlendMode: 'multiply',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
