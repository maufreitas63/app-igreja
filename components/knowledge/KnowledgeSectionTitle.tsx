import { KnowledgeRouteInfo } from '@/components/knowledge/KnowledgeRouteInfo';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  title: string;
  routeKey: string;
  titleStyle?: StyleProp<TextStyle>;
  iconColor?: string;
  accessibilityLabel?: string;
};

/** Título de seção com «i» à direita — o ícone só renderiza se houver artigo visível. */
export function KnowledgeSectionTitle({
  title,
  routeKey,
  titleStyle,
  iconColor,
  accessibilityLabel,
}: Props) {
  return (
    <View style={styles.row}>
      <Text style={[titleStyle, styles.titlePad]}>{title}</Text>
      <View style={styles.infoSlot} pointerEvents="box-none">
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
    zIndex: 2,
  },
});
