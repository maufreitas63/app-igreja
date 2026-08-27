import { APP_DRAWER_SETTINGS_GROUPS } from '@/lib/appDrawerMenu';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { traceClick } from '@/lib/devClickTrace';
import { FontAwesome } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type AppDrawerSettingsRow = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  onPress: () => void;
};

export type AppDrawerSettingsSection = {
  id: string;
  title: string;
  items: AppDrawerSettingsRow[];
};

type Props = {
  onClose: () => void;
  sections: AppDrawerSettingsSection[];
  trailItems?: AppDrawerSettingsRow[];
  pinnedItem?: AppDrawerSettingsRow | null;
};

function SettingsRowView({
  item,
  pinned = false,
  nested = false,
}: {
  item: AppDrawerSettingsRow;
  pinned?: boolean;
  nested?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.item, pinned && styles.itemPinned, nested && styles.itemNested]}
      onPress={() => {
        traceClick('drawer-settings', 'item-press', { id: item.id, label: item.label });
        item.onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View style={styles.itemIconWrap}>
        <FontAwesome name={item.icon} size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
      </View>
      <View style={styles.itemCopy}>
        <Text style={styles.itemLabel}>{item.label}</Text>
        {item.hint ? <Text style={styles.itemHint}>{item.hint}</Text> : null}
      </View>
      <FontAwesome name="chevron-right" size={12} color={MINIMAL_UI.textMuted} />
    </TouchableOpacity>
  );
}

export function AppDrawerSettings({
  onClose,
  sections,
  trailItems = [],
  pinnedItem = null,
}: Props) {
  const insets = useSafeAreaInsets();
  const [trailMenuOpen, setTrailMenuOpen] = useState(false);
  const showTrailGroup = trailItems.length > 0;

  const visibleSections = useMemo(
    () => sections.filter((section) => section.items.length > 0),
    [sections]
  );

  return (
    <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Configurações</Text>
        <Pressable
          accessibilityLabel="Fechar configurações"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.closeButton}
        >
          <FontAwesome name="times" size={MINIMAL_ICON.action + 4} color={MINIMAL_UI.icon} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {visibleSections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <SettingsRowView key={item.id} item={item} />
            ))}
            {section.id === 'governanca' && showTrailGroup ? (
              <View>
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => {
                    traceClick('drawer-settings', 'trail-group-toggle', { open: !trailMenuOpen });
                    setTrailMenuOpen((open) => !open);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: trailMenuOpen }}
                  accessibilityLabel="Manutenção da Trilha"
                >
                  <View style={styles.itemIconWrap}>
                    <FontAwesome name="graduation-cap" size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
                  </View>
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemLabel}>Manutenção da Trilha</Text>
                    <Text style={styles.itemHint}>Temas, reconhecimentos e reset</Text>
                  </View>
                  <FontAwesome
                    name={trailMenuOpen ? 'chevron-down' : 'chevron-right'}
                    size={12}
                    color={MINIMAL_UI.textMuted}
                  />
                </TouchableOpacity>
                {trailMenuOpen
                  ? trailItems.map((item) => (
                      <SettingsRowView key={item.id} item={item} nested />
                    ))
                  : null}
              </View>
            ) : null}
          </View>
        ))}

        {showTrailGroup && !visibleSections.some((section) => section.id === 'governanca') ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {APP_DRAWER_SETTINGS_GROUPS.find((group) => group.id === 'governanca')?.title
                ?? 'Governança e TI'}
            </Text>
            <TouchableOpacity
              style={styles.item}
              onPress={() => setTrailMenuOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: trailMenuOpen }}
              accessibilityLabel="Manutenção da Trilha"
            >
              <View style={styles.itemIconWrap}>
                <FontAwesome name="graduation-cap" size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemLabel}>Manutenção da Trilha</Text>
                <Text style={styles.itemHint}>Temas, reconhecimentos e reset</Text>
              </View>
              <FontAwesome
                name={trailMenuOpen ? 'chevron-down' : 'chevron-right'}
                size={12}
                color={MINIMAL_UI.textMuted}
              />
            </TouchableOpacity>
            {trailMenuOpen
              ? trailItems.map((item) => <SettingsRowView key={item.id} item={item} nested />)
              : null}
          </View>
        ) : null}
      </ScrollView>

      {pinnedItem ? (
        <View style={styles.pinnedFooter}>
          <SettingsRowView item={pinnedItem} pinned />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 2,
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 12,
    flexGrow: 1,
  },
  section: {
    gap: 0,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: MINIMAL_UI.textMuted,
    marginBottom: 4,
    marginTop: 4,
  },
  pinnedFooter: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    paddingTop: 4,
    backgroundColor: MINIMAL_UI.background,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  itemNested: {
    paddingLeft: 16,
    backgroundColor: MINIMAL_UI.rowHover,
    minHeight: 52,
  },
  itemPinned: {
    borderBottomWidth: 0,
  },
  itemIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemLabel: {
    ...MINIMAL_TYPO.menuItem,
    fontWeight: '600',
  },
  itemHint: {
    fontSize: 12,
    color: MINIMAL_UI.textMuted,
    lineHeight: 16,
  },
});
