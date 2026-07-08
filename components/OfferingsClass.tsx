import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import type { OfferingsRecipientRow } from '@/lib/offeringsRecipientInfo';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const OFFERINGS_CLASS_SURFACE = '#FFFFFF';
const OFFERINGS_COPY_BUTTON_BG = '#3A96DD';
const OFFERINGS_COPY_BUTTON_TEXT = '#FFFFFF';
const OFFERINGS_COPY_BUTTON_BORDER = '#1B4F8A';

export type OfferingsClassProps = {
  title?: string;
  recipientRows: OfferingsRecipientRow[];
  pixKey?: string | null;
  pixKeyLoading?: boolean;
  onCopyPixKey?: () => void;
  onRetryLoadPixKey?: () => void;
};

/** Visualização pura de Dízimos e Ofertas — extraída de dashboard.card.offerings. */
export function OfferingsClass({
  title = 'Dízimos e Ofertas',
  recipientRows,
  pixKey = null,
  pixKeyLoading = false,
  onCopyPixKey,
  onRetryLoadPixKey,
}: OfferingsClassProps) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{title}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Dados do recebedor</Text>
        <View style={styles.recipientList}>
          {recipientRows.map((row) => (
            <View key={row.label} style={styles.recipientRow}>
              <Text style={styles.recipientLabel}>{row.label}</Text>
              <Text style={styles.recipientValue} numberOfLines={3}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Chave PIX</Text>
        {pixKeyLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} />
          </View>
        ) : pixKey ? (
          <>
            <Text style={styles.pixKeyValue} selectable>
              {pixKey}
            </Text>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={onCopyPixKey}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Copiar chave PIX"
            >
              <MaterialIcons name="touch-app" size={28} color={OFFERINGS_COPY_BUTTON_TEXT} />
              <Text style={styles.copyButtonText}>Copiar chave PIX</Text>
            </TouchableOpacity>
            <Text style={styles.helpText}>
              Toque no botão para copiar a chave e colar no aplicativo do seu banco.
            </Text>
          </>
        ) : (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>Chave PIX indisponível.</Text>
            {onRetryLoadPixKey ? (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onRetryLoadPixKey}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Atualizar chave PIX"
              >
                <Text style={styles.retryButtonText}>Atualizar chave PIX</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: OFFERINGS_CLASS_SURFACE,
  },
  content: {
    flexGrow: 1,
    gap: 16,
    paddingBottom: 16,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recipientList: {
    gap: 10,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  recipientLabel: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
    opacity: 0.88,
  },
  recipientValue: {
    flex: 1,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
    paddingVertical: 16,
    backgroundColor: OFFERINGS_CLASS_SURFACE,
  },
  pixKeyValue: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    backgroundColor: OFFERINGS_CLASS_SURFACE,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: OFFERINGS_COPY_BUTTON_BG,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: OFFERINGS_COPY_BUTTON_BORDER,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  copyButtonText: {
    color: OFFERINGS_COPY_BUTTON_TEXT,
    fontSize: 16,
    fontWeight: '700',
  },
  helpText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.88,
    textAlign: 'center',
  },
  messageBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: OFFERINGS_CLASS_SURFACE,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  retryButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
