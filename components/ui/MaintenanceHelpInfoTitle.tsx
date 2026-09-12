import { CenteredCloseDialog } from '@/components/minimal/CenteredCloseDialog';
import { maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

type Props = {
  title: string;
  helpText: string;
  minimal?: boolean;
  titleStyle?: StyleProp<TextStyle>;
  iconColor?: string;
  showSubtitleSpacer?: boolean;
  accessibilityLabel?: string;
  modalTitle?: string;
};

export function MaintenanceHelpInfoTitle({
  title,
  helpText,
  minimal = false,
  titleStyle,
  iconColor,
  showSubtitleSpacer,
  accessibilityLabel,
  modalTitle = 'Como usar',
}: Props) {
  const [open, setOpen] = useState(false);
  const color = iconColor ?? (minimal ? MINIMAL_UI.icon : MINIMAL_UI.accent);
  const spacer = showSubtitleSpacer ?? !minimal;

  return (
    <>
      <View style={styles.titleRow}>
        <Text style={[titleStyle, styles.titleText]}>{title}</Text>
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => setOpen(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `Como usar: ${title}`}
        >
          <FontAwesome name="info-circle" size={18} color={color} />
        </TouchableOpacity>
      </View>
      {spacer ? <View style={maintenancePanelStyles.panelSubtitleSpacer} /> : null}

      <CenteredCloseDialog
        visible={open}
        onClose={() => setOpen(false)}
        title={modalTitle}
        accessibilityCloseLabel="Fechar como usar"
      >
        <Text style={[styles.helpText, minimal && styles.helpTextMinimal]}>{helpText}</Text>
      </CenteredCloseDialog>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  titleText: {
    flex: 1,
    paddingHorizontal: 28,
  },
  helpButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: {
    color: MINIMAL_UI.blue,
    fontSize: 14,
    lineHeight: 22,
  },
  helpTextMinimal: {
    color: MINIMAL_UI.text,
  },
});
