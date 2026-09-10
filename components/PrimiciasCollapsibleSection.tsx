import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function PrimiciasCollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <FontAwesome
          name={open ? 'chevron-down' : 'chevron-right'}
          size={14}
          color={MINIMAL_UI.textMuted}
        />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerPressed: {
    backgroundColor: MINIMAL_UI.rowHover,
    borderRadius: 8,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: MINIMAL_UI.blueDark,
  },
  subtitle: {
    fontSize: 12,
    color: MINIMAL_UI.textMuted,
  },
  body: {
    gap: 8,
  },
});
