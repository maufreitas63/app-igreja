import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { DailyVerseModal } from './DailyVerseModal';

/** Ícone de Bíblia aberta — abre o versículo do dia no centro da faixa superior. */
export function MinimalDailyVerseButton() {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityLabel="Abrir versículo do dia"
        accessibilityRole="button"
        onPress={() => setModalVisible(true)}
        style={styles.button}
      >
        <MaterialIcons name="menu-book" size={20} color={MINIMAL_UI.icon} />
      </Pressable>

      <DailyVerseModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
