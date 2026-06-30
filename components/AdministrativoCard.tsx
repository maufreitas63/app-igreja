import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TabId = 'atas' | 'outros';

type Props = {
  panelHeight: number;
};

const TABS: { id: TabId; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'atas', label: 'Atas de Assembleias', icon: 'description' },
  { id: 'outros', label: 'Outros', icon: 'folder-open' },
];

export function AdministrativoCard({ panelHeight }: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [activeTab, setActiveTab] = useState<TabId>('atas');

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Administrativo</Text>
      <Text style={styles.subtitle}>
        Documentos e registros administrativos da instituição.
      </Text>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabChip, selected && styles.tabChipSelected]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.85}
            >
              <MaterialIcons
                name={tab.icon}
                size={16}
                color={selected ? '#1E3A8A' : '#BFDBFE'}
              />
              <Text style={[styles.tabChipText, selected && styles.tabChipTextSelected]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.bodyCard}>
        {activeTab === 'atas' ? (
          <>
            <FontAwesome name="file-text-o" size={28} color="#60A5FA" />
            <Text style={styles.bodyTitle}>Atas de Assembleias</Text>
            <Text style={styles.bodyHint}>
              Em breve: consulta e registro das atas oficiais das assembleias.
            </Text>
          </>
        ) : (
          <>
            <FontAwesome name="folder-open-o" size={28} color="#60A5FA" />
            <Text style={styles.bodyTitle}>Outros</Text>
            <Text style={styles.bodyHint}>
              Espaço reservado para demais documentos administrativos.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: 10,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    backgroundColor: 'rgba(30, 58, 138, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabChipSelected: {
    backgroundColor: '#BFDBFE',
    borderColor: '#93C5FD',
  },
  tabChipText: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '800',
  },
  tabChipTextSelected: {
    color: '#1E3A8A',
  },
  bodyCard: {
    flex: 1,
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  bodyTitle: {
    color: '#E0F2FE',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  bodyHint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 320,
  },
});
