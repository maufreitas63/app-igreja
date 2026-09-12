import { CenteredCloseDialog } from '@/components/minimal/CenteredCloseDialog';
import {
  ALIANCA_PREMIACAO_INFO_SECTIONS,
  ALIANCA_PREMIACAO_INFO_TITLE,
} from '@/lib/alianca/aliancaPremiacaoInfo';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AliancaPremiacaoInfoModal({ visible, onClose }: Props) {
  return (
    <CenteredCloseDialog
      visible={visible}
      onClose={onClose}
      title={ALIANCA_PREMIACAO_INFO_TITLE}
      accessibilityCloseLabel="Fechar explicação"
    >
      {ALIANCA_PREMIACAO_INFO_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </CenteredCloseDialog>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: MINIMAL_UI.blue,
  },
});
