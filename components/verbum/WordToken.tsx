import { playWordTap } from '@/lib/verbum/sound';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  placed?: boolean;
};

export function WordToken({ label, onPress, placed = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        playWordTap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.token,
        placed ? styles.placed : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  token: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  placed: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  pressed: {
    borderBottomWidth: 2,
    marginTop: 2,
  },
  label: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 16,
  },
});
