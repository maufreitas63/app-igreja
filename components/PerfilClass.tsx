import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/** Ícones azul escuro — identidade vigilance_scales (sem herdar cores legadas do card). */
const PERFIL_CLASS_ICON_COLOR = '#1B4F8A';

/** Superfície branca pura conforme especificação do módulo Perfil. */
const PERFIL_CLASS_SURFACE = '#FFFFFF';

export type PerfilClassAction = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
};

export type PerfilClassProps = {
  title?: string;
  loading?: boolean;
  actions: PerfilClassAction[];
};

/** Visualização pura de Perfil & Identidade — extraída de dashboard.card.grouped_manage. */
export function PerfilClass({
  title = 'Perfil & Identidade',
  loading = false,
  actions,
}: PerfilClassProps) {
  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.body}>
        {actions.length ? (
          actions.map((action) => (
            <Pressable
              key={action.key}
              style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <MaterialIcons name={action.icon} size={24} color={PERFIL_CLASS_ICON_COLOR} />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyText}>Nenhuma opção de perfil disponível para sua conta.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    backgroundColor: PERFIL_CLASS_SURFACE,
    gap: 12,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    paddingVertical: 24,
    backgroundColor: PERFIL_CLASS_SURFACE,
  },
  title: MINIMAL_SECTION_TITLE,
  body: {
    width: '100%',
    gap: 8,
    backgroundColor: PERFIL_CLASS_SURFACE,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.borderMuted,
    backgroundColor: PERFIL_CLASS_SURFACE,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  actionRowPressed: {
    backgroundColor: VIGILANCE_SCALES_UI.surfaceHighlight,
    borderColor: VIGILANCE_SCALES_UI.border,
  },
  actionLabel: {
    flex: 1,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  emptyText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    opacity: 0.88,
    paddingVertical: 8,
  },
});
