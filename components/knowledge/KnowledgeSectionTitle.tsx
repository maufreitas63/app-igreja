import { KnowledgeRouteInfo } from '@/components/knowledge/KnowledgeRouteInfo';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  title: string;
  routeKey: string;
  titleStyle?: StyleProp<TextStyle>;
  iconColor?: string;
  accessibilityLabel?: string;
  leftSlot?: React.ReactNode;
};

/** Título de seção com «i» à direita — o ícone só renderiza se houver artigo visível. */
export function KnowledgeSectionTitle({
  title,
  routeKey,
  titleStyle,
  iconColor,
  accessibilityLabel,
  leftSlot,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.titleCluster}>
        {leftSlot}
        <Text style={[titleStyle, styles.titlePad]}>{title}</Text>
      </View>
      <View style={styles.infoSlot}>
        <KnowledgeRouteInfo
          routeKey={routeKey}
          iconColor={iconColor}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 4,
  },
  titleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'visible',
    zIndex: 1,
    pointerEvents: 'box-none',
  },
  titlePad: {
    paddingRight: 36,
  },
  infoSlot: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 6,
  },
});
