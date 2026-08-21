import { maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

const ACCENT = '#3A96DD';

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
  const color = iconColor ?? (minimal ? MINIMAL_UI.blueDark : ACCENT);
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

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={[styles.overlay, minimal && styles.overlayMinimal]}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.bubble, minimal && styles.bubbleMinimal]}>
            <Text style={[styles.modalTitle, minimal && styles.modalTitleMinimal]}>{modalTitle}</Text>
            <Text style={[styles.helpText, minimal && styles.helpTextMinimal]}>{helpText}</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.closeButton, minimal && styles.closeButtonMinimal]}
                onPress={() => setOpen(false)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <Text style={[styles.closeText, minimal && styles.closeTextMinimal]}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(2, 6, 23, 0.58)',
  },
  overlayMinimal: {
    backgroundColor: 'rgba(30, 64, 175, 0.28)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bubble: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    padding: 14,
    gap: 8,
  },
  bubbleMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  modalTitle: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '800',
  },
  modalTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  helpText: {
    color: '#3A96DD',
    fontSize: 13,
    lineHeight: 19,
  },
  helpTextMinimal: {
    color: MINIMAL_UI.text,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeButton: {
    minWidth: 76,
    minHeight: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  closeButtonMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
  },
  closeText: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '800',
  },
  closeTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
});
