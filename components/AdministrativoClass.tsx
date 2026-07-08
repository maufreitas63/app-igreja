import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ADMINISTRATIVO_CLASS_SURFACE = '#FFFFFF';

export type AdministrativoClassProps = {
  title?: string;
  description?: string;
  rdButtonLabel?: string;
  onPressRd?: () => void;
};

/** Visualização pura do módulo Administrativo — ações injetadas via props. */
export function AdministrativoClass({
  title = 'Administrativo',
  description = 'Documentos administrativos, sugestões e relatórios de despesas.',
  rdButtonLabel = 'Criar Relatório de Despesas (RD)',
  onPressRd,
}: AdministrativoClassProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <TouchableOpacity
        style={styles.rdButton}
        onPress={onPressRd}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={rdButtonLabel}
      >
        <Text style={styles.rdButtonText}>{rdButtonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    gap: 16,
    paddingTop: 4,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
  },
  description: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.92,
  },
  rdButton: {
    alignSelf: 'stretch',
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ADMINISTRATIVO_CLASS_SURFACE,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  rdButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
