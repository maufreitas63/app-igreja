import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

export type SocialBrandNetwork = 'instagram' | 'youtube';

type SocialBrandIconProps = {
  network: SocialBrandNetwork;
  size?: number;
  style?: ViewStyle;
};

const DEFAULT_SIZE = 44;

/** Raio squircle (aproximação One UI / ícones oficiais do fabricante). */
const squircleRadius = (size: number) => Math.round(size * 0.27);

export function SocialBrandIcon({ network, size = DEFAULT_SIZE, style }: SocialBrandIconProps) {
  const radius = squircleRadius(size);

  if (network === 'instagram') {
    return (
      <LinearGradient
        colors={['#833AB4', '#E1306C', '#FD1D1D', '#FCAF45']}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.iconBase, { width: size, height: size, borderRadius: radius }, style]}
      >
        <FontAwesome5 name="instagram" brand size={Math.round(size * 0.52)} color="#FFFFFF" />
      </LinearGradient>
    );
  }

  const playWidth = Math.round(size * 0.64);
  const playHeight = Math.round(size * 0.44);
  const playRadius = Math.round(playHeight * 0.22);
  const triangleHalf = Math.max(4, Math.round(size * 0.11));
  const triangleBase = Math.max(6, Math.round(size * 0.18));

  return (
    <View
      style={[
        styles.iconBase,
        styles.youtubeSquircle,
        { width: size, height: size, borderRadius: radius },
        style,
      ]}
    >
      <View
        style={[
          styles.youtubePlay,
          {
            width: playWidth,
            height: playHeight,
            borderRadius: playRadius,
          },
        ]}
      >
        <View
          style={{
            width: 0,
            height: 0,
            marginLeft: Math.round(size * 0.04),
            borderTopWidth: triangleHalf,
            borderBottomWidth: triangleHalf,
            borderLeftWidth: triangleBase,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: '#FFFFFF',
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBase: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  youtubeSquircle: {
    backgroundColor: '#FFFFFF',
  },
  youtubePlay: {
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
