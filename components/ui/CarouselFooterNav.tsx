import { UI_ACCENT_STYLES, UI_TYPO, type UiAccent } from '@/lib/uiTokens';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

type CarouselFooterNavProps = {
  currentIndex: number;
  totalCount: number;
  centerLabel: string;
  centerAccessibilityLabel?: string;
  onCenterPress: () => void;
  onPreviousPress: () => void;
  onNextPress: () => void;
  onPreviousPressIn?: () => void;
  onPreviousPressOut?: () => void;
  onNextPressIn?: () => void;
  onNextPressOut?: () => void;
  isPreviousDisabled?: boolean;
  isNextDisabled?: boolean;
  accent?: UiAccent;
  trailingAccessory?: React.ReactNode;
  hideSideNavigation?: boolean;
  /** Oculta o indicador "1 / N" abaixo da navegação. */
  hidePageIndicator?: boolean;
  centerButtonStyle?: StyleProp<ViewStyle>;
};

export function CarouselFooterNav({
  currentIndex,
  totalCount,
  centerLabel,
  centerAccessibilityLabel,
  onCenterPress,
  onPreviousPress,
  onNextPress,
  onPreviousPressIn,
  onPreviousPressOut,
  onNextPressIn,
  onNextPressOut,
  isPreviousDisabled = currentIndex <= 0,
  isNextDisabled = currentIndex >= totalCount - 1,
  accent = 'emerald',
  trailingAccessory,
  hideSideNavigation = false,
  hidePageIndicator = false,
  centerButtonStyle,
}: CarouselFooterNavProps) {
  const accentStyle = UI_ACCENT_STYLES[accent];
  const pageLabel =
    !hidePageIndicator && totalCount > 0 ? `${currentIndex + 1} / ${totalCount}` : '';
  const hasTrailingAccessory = Boolean(trailingAccessory);
  const compactFooter = hideSideNavigation;

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.navRow,
          compactFooter && styles.navRowCompact,
          compactFooter && hasTrailingAccessory && styles.navRowCompactWithTrailing,
        ]}
      >
        <View
          style={[
            styles.mainGroup,
            compactFooter && styles.mainGroupCompact,
            compactFooter && hasTrailingAccessory && styles.mainGroupCompactWithTrailing,
          ]}
        >
          {!hideSideNavigation ? (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.navButtonSquare,
                { backgroundColor: accentStyle.navBg, borderColor: accentStyle.navBorder },
                isPreviousDisabled && styles.navButtonDisabled,
              ]}
              onPress={onPreviousPress}
              onPressIn={onPreviousPressIn}
              onPressOut={onPreviousPressOut}
              disabled={isPreviousDisabled}
              activeOpacity={0.85}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Card anterior"
            >
              <Text style={[styles.navSideText, { color: accentStyle.navText }]}>{'‹'}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.navButton,
              styles.navButtonCenter,
              compactFooter && styles.navButtonCenterCompact,
              centerButtonStyle,
              { backgroundColor: accentStyle.exitBg, borderColor: accentStyle.exitBorder },
            ]}
            onPress={onCenterPress}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={centerAccessibilityLabel ?? centerLabel}
          >
            <Text style={[styles.navCenterText, { color: accentStyle.exitText }]}>{centerLabel}</Text>
          </TouchableOpacity>

          {!hideSideNavigation ? (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.navButtonSquare,
                { backgroundColor: accentStyle.navBg, borderColor: accentStyle.navBorder },
                isNextDisabled && styles.navButtonDisabled,
              ]}
              onPress={onNextPress}
              onPressIn={onNextPressIn}
              onPressOut={onNextPressOut}
              disabled={isNextDisabled}
              activeOpacity={0.85}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Próximo card"
            >
              <Text style={[styles.navSideText, { color: accentStyle.navText }]}>{'›'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {hasTrailingAccessory ? (
          <View style={styles.trailingAccessorySlot}>{trailingAccessory}</View>
        ) : null}
      </View>

      {pageLabel ? (
        <Text style={styles.pageIndicator} accessibilityLabel={`Card ${pageLabel}`}>
          {pageLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navRowCompact: {
    width: '100%',
  },
  navRowCompactWithTrailing: {
    position: 'relative',
  },
  mainGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  mainGroupCompact: {
    flexGrow: 1,
    flexShrink: 0,
    width: '100%',
  },
  mainGroupCompactWithTrailing: {
    paddingRight: 56,
  },
  navButton: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  navButtonSquare: {
    width: 48,
    height: 48,
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: 0,
  },
  navButtonCenter: {
    flex: 1,
    minWidth: 0,
    height: 48,
    paddingVertical: 0,
    paddingHorizontal: 8,
  },
  navButtonCenterCompact: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  trailingAccessorySlot: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 48,
    height: 48,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navSideText: {
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 28,
  },
  navCenterText: {
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pageIndicator: {
    alignSelf: 'center',
    color: '#94A3B8',
    fontSize: UI_TYPO.pageIndicator.fontSize,
    fontWeight: UI_TYPO.pageIndicator.fontWeight,
    letterSpacing: UI_TYPO.pageIndicator.letterSpacing,
  },
});
