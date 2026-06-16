import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

type OpenBibleIconProps = {
  size?: number;
  style?: ViewStyle;
};

export function OpenBibleIcon({ size = 28, style }: OpenBibleIconProps) {
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: Math.round(size * 0.28) }, style]}>
      <Image
        source={require('@/assets/open-bible.png')}
        style={{ width: Math.round(size * 0.72), height: Math.round(size * 0.72) }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
