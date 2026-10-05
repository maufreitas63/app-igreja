import { useHomeAdmissionSticker } from '@/hooks/useHomeAdmissionSticker';
import { navigateDrawerMenuItem } from '@/lib/appDrawerMenu';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const COLLAPSED_WIDTH = 48;
const EXPANDED_WIDTH = 228;
const STICKER_YELLOW = '#FACC15';
const STICKER_YELLOW_DARK = '#CA8A04';
const STICKER_INK = '#422006';
const EXPANDED_MESSAGE = 'Há novos membros aguardando admissão';

/**
 * Etiqueta amarela retrátil na borda direita da Home.
 * Visível só para super_admin / secretaria / pastoral com pendência de admissão.
 */
export function HomeAdmissionSticker() {
  const router = useRouter();
  const { visible } = useHomeAdmissionSticker(true);
  const [expanded, setExpanded] = useState(false);
  const widthAnim = useRef(new Animated.Value(COLLAPSED_WIDTH)).current;

  useEffect(() => {
    if (!visible) {
      setExpanded(false);
      widthAnim.setValue(COLLAPSED_WIDTH);
    }
  }, [visible, widthAnim]);

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [expanded, widthAnim]);

  if (!visible) {
    return null;
  }

  const toggleExpanded = () => {
    setExpanded((current) => !current);
  };

  const openMudancaPapeis = () => {
    void navigateDrawerMenuItem(router, 'mudanca_papeis');
  };

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <Animated.View style={[styles.sticker, { width: widthAnim }]}>
        <Pressable
          onPress={toggleExpanded}
          style={styles.tabHit}
          accessibilityRole="button"
          accessibilityLabel={
            expanded
              ? 'Recolher aviso de novos membros'
              : 'Expandir aviso de novos membros aguardando admissão'
          }
        >
          <MaterialIcons name="meeting-room" size={20} color={STICKER_INK} />
          <View style={styles.divider} />
        </Pressable>

        {expanded ? (
          <Pressable
            onPress={openMudancaPapeis}
            style={styles.messageHit}
            accessibilityRole="button"
            accessibilityLabel="Abrir Mudança de Papéis"
          >
            <Text style={styles.message} numberOfLines={3}>
              {EXPANDED_MESSAGE}
            </Text>
            <MaterialIcons name="chevron-right" size={18} color={STICKER_INK} />
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 50,
  },
  sticker: {
    minHeight: 48,
    maxWidth: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: STICKER_YELLOW,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: STICKER_YELLOW_DARK,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: -2, height: 2 },
    elevation: 4,
  },
  tabHit: {
    width: COLLAPSED_WIDTH,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
    paddingRight: 6,
    gap: 6,
  },
  divider: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
    marginVertical: 10,
    backgroundColor: STICKER_YELLOW_DARK,
  },
  messageHit: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 10,
    paddingVertical: 8,
  },
  message: {
    flex: 1,
    minWidth: 0,
    color: STICKER_INK,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
});
