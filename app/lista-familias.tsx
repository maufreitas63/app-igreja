import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { MembersClassPanel } from '@/components/MembersClassPanel';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { useDashboardCardRouteAccess } from '@/hooks/useDashboardCardRouteAccess';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { ACCESS_DASHBOARD_CARD } from '@/lib/accessControl';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import {
  buildFamilyDirectoryOptions,
  fetchTenantFamilyMembers,
} from '@/lib/familyDirectory';
import { compareFamilyMembersByRelationship } from '@/lib/familyRelationshipOptions';
import { membersClassStyles } from '@/lib/manageMembers/membersClassStyles';
import type { ManagedMember } from '@/lib/manageMembers/shared';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ListaFamiliasScreen() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
    fallbackDashboardCard: 'members_list',
  });
  const accessStatus = useDashboardCardRouteAccess({
    resourceKey: ACCESS_DASHBOARD_CARD.membersList,
    deniedMessage: 'Você não tem permissão para abrir a Lista de Famílias.',
    requireActiveMembership: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<ManagedMember[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const options = useMemo(() => buildFamilyDirectoryOptions(members), [members]);
  const selectedMembers = useMemo(
    () =>
      members
        .filter((member) => member.family_id === selectedCode)
        .sort(compareFamilyMembersByRelationship),
    [members, selectedCode]
  );

  const reload = useCallback(async () => {
    setError(null);
    try {
      const rows = await fetchTenantFamilyMembers();
      setMembers(rows);
    } catch (loadError) {
      setMembers([]);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as famílias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (editingMemberId && selectedCode) {
    return (
      <ScreenAccessGate status={accessStatus}>
        <View style={styles.editor}>
          <MembersClassPanel
            embedded
            directoryFamilyCode={selectedCode}
            initialEditMemberId={editingMemberId}
            onBack={() => {
              setEditingMemberId(null);
              void reload();
            }}
          />
        </View>
      </ScreenAccessGate>
    );
  }

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={returnToCaller} />}>
        <View style={styles.page}>
          <KnowledgeSectionTitle
            title="Lista de Famílias"
            routeKey={KNOWLEDGE_ROUTE.listaFamilias}
            titleStyle={styles.title}
          />
          {loading ? (
            <ActivityIndicator color={MINIMAL_UI.accent} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <>
              <DropdownSelect
                searchable
                options={options.map((option) => ({
                  value: option.code,
                  label: option.label,
                  searchText: option.searchText,
                }))}
                selectedValue={selectedCode}
                onValueChange={setSelectedCode}
                modalTitle="Família"
                placeholder="Selecione a família"
                searchPlaceholder="Código ou nome de qualquer integrante"
                variant="minimal"
              />
              {selectedCode ? (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                  <View style={styles.headerRow}>
                    <Text style={[styles.headerCell, styles.relationshipCol]}>Parentesco</Text>
                    <Text style={[styles.headerCell, styles.nameCol]}>Nome completo</Text>
                  </View>
                  {selectedMembers.map((member) => {
                    return (
                      <View key={member.id} style={styles.row}>
                        <Text style={[styles.cell, styles.relationshipCol]}>{member.relationship || '—'}</Text>
                        <Text style={[styles.cell, styles.nameCol]}>{member.full_name}</Text>
                        <View style={styles.actions}>
                          <View style={styles.editAnchor} />
                          <TouchableOpacity
                            style={membersClassStyles.editButton}
                            onPress={() => setEditingMemberId(String(member.id))}
                            accessibilityRole="button"
                            accessibilityLabel={`Editar integrante ${member.full_name}`}
                          >
                            <MaterialIcons name="edit" size={18} color={MINIMAL_UI.onDark} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.hint}>Escolha uma família para ver os integrantes desta igreja.</Text>
              )}
            </>
          )}
        </View>
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  editor: {
    flex: 1,
    minHeight: 0,
  },
  page: {
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
  },
  error: {
    color: '#B91C1C',
    textAlign: 'center',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    gap: 8,
  },
  headerCell: {
    color: MINIMAL_UI.accent,
    fontWeight: '800',
    fontSize: 12,
  },
  cell: {
    color: MINIMAL_UI.text,
    fontSize: 14,
  },
  relationshipCol: {
    width: 118,
    flexShrink: 0,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  editAnchor: {
    width: 34,
    height: 34,
  },
});
