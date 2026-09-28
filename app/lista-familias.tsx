import { MembersClassPanel } from '@/components/MembersClassPanel';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { useDashboardCardRouteAccess } from '@/hooks/useDashboardCardRouteAccess';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { acceptMemberIntoFamily } from '@/lib/acceptMemberIntoFamily';
import { ACCESS_DASHBOARD_CARD } from '@/lib/accessControl';
import { showAppToast } from '@/lib/appToast';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import {
  buildFamilyDirectoryOptions,
  fetchTenantFamilyMembers,
} from '@/lib/familyDirectory';
import { findProfileIdForMember } from '@/lib/memberProfiles';
import { compareFamilyMembersByRelationship } from '@/lib/familyRelationshipOptions';
import {
  hasAnyProfileAddress,
  inheritFamilyAddressToAcceptedMember,
  loadAcceptorAddressForFamilyScreen,
  resolveAcceptorAuthUserId,
} from '@/lib/inheritFamilyAddress';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import {
  ACCENT,
  MEMBERS_CLASS_ICON_COLOR,
  membersClassStyles,
} from '@/lib/manageMembers/membersClassStyles';
import { showFamilyInconsistencyToast, type ManagedMember } from '@/lib/manageMembers/shared';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { applyNewFamilyCodeForRejectedMember } from '@/lib/rejectedMemberFamilyCode';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const [pendingIds, setPendingIds] = useState<string[]>([]);

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

  const toggleAccepted = useCallback(
    async (member: ManagedMember) => {
      const memberId = String(member.id);

      if (pendingIds.includes(memberId)) {
        return;
      }

      setPendingIds((current) => [...current, memberId]);

      try {
        const profileId = await findProfileIdForMember({
          full_name: member.full_name,
          phone: member.phone,
          birth_date: member.birth_date,
        });
        const nextAccepted = member.accepted !== true;

        if (!nextAccepted) {
          await applyNewFamilyCodeForRejectedMember(
            {
              id: memberId,
              full_name: member.full_name,
              phone: member.phone,
              birth_date: member.birth_date,
              family_id: member.family_id,
            },
            profileId
          );
        } else {
          await acceptMemberIntoFamily({
            memberId,
            targetFamilyId: selectedCode,
            profileId,
            member: {
              full_name: member.full_name,
              phone: member.phone,
              birth_date: member.birth_date,
            },
          });

          const sessionProfile = await loadEffectiveSessionProfile();
          const inheritedAddress = await loadAcceptorAddressForFamilyScreen({
            profileId: sessionProfile?.id ?? null,
            phone: sessionProfile?.phone ?? null,
            authUserId: await resolveAcceptorAuthUserId(),
          });

          if (inheritedAddress && hasAnyProfileAddress(inheritedAddress)) {
            try {
              await inheritFamilyAddressToAcceptedMember(
                {
                  full_name: member.full_name,
                  phone: member.phone,
                  birth_date: member.birth_date,
                },
                {
                  acceptorProfileId: sessionProfile?.id ?? null,
                  acceptorPhone: sessionProfile?.phone ?? null,
                  acceptorAuthUserId: await resolveAcceptorAuthUserId(),
                  acceptedProfileId: profileId,
                  inheritedAddress,
                }
              );
            } catch {
              showAppToast({
                type: 'info',
                text1: 'Integrante reconhecido',
                text2: 'O vínculo foi confirmado, mas o endereço da família não pôde ser copiado.',
              });
            }
          }
        }

        await reload();
      } catch (toggleError) {
        const message =
          toggleError instanceof Error
            ? toggleError.message
            : 'Não foi possível atualizar o reconhecimento do integrante.';
        showFamilyInconsistencyToast(message, 'Erro');
      } finally {
        setPendingIds((current) => current.filter((id) => id !== memberId));
      }
    },
    [pendingIds, reload, selectedCode]
  );

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
          <Text style={styles.title}>Lista de Famílias</Text>
          {loading ? (
            <ActivityIndicator color={MINIMAL_UI.accent} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <>
              <DropdownSelect
                searchable
                options={options.map((option) => ({ value: option.code, label: option.label }))}
                selectedValue={selectedCode}
                onValueChange={setSelectedCode}
                modalTitle="Família"
                placeholder="Selecione a família"
                searchPlaceholder="Código ou nome"
                variant="minimal"
              />
              {selectedCode ? (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                  <View style={styles.headerRow}>
                    <Text style={[styles.headerCell, styles.relationshipCol]}>Parentesco</Text>
                    <Text style={[styles.headerCell, styles.nameCol]}>Nome completo</Text>
                  </View>
                  {selectedMembers.map((member) => {
                    const pending = pendingIds.includes(String(member.id));

                    return (
                      <View key={member.id} style={styles.row}>
                        <Text style={[styles.cell, styles.relationshipCol]}>{member.relationship || '—'}</Text>
                        <Text style={[styles.cell, styles.nameCol]}>{member.full_name}</Text>
                        <View style={styles.actions}>
                          <Pressable
                            style={({ pressed }) => [
                              membersClassStyles.acceptButton,
                              member.accepted === true && membersClassStyles.acceptButtonChecked,
                              member.accepted === false && membersClassStyles.acceptButtonUnchecked,
                              pending && membersClassStyles.acceptButtonPending,
                              pressed && !pending && membersClassStyles.acceptButtonPressed,
                            ]}
                            onPress={() => void toggleAccepted(member)}
                            hitSlop={8}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: member.accepted === true, disabled: pending }}
                            accessibilityLabel={
                              member.accepted === true
                                ? `Integrante ${member.full_name} reconhecido como pertencente à família`
                                : member.accepted === false
                                  ? `Integrante ${member.full_name} marcado como não pertencente à família`
                                  : `Marcar ${member.full_name} como pertencente à família`
                            }
                          >
                            {pending ? (
                              <ActivityIndicator color={ACCENT} size="small" />
                            ) : member.accepted === true ? (
                              <MaterialIcons name="check" size={18} color={MINIMAL_UI.onDark} />
                            ) : member.accepted === false ? (
                              <MaterialIcons name="close" size={16} color="#B91C1C" />
                            ) : (
                              <MaterialIcons name="check-box-outline-blank" size={20} color={MEMBERS_CLASS_ICON_COLOR} />
                            )}
                          </Pressable>
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
    color: MINIMAL_UI.accent,
    fontWeight: '800',
    fontSize: 17,
    textAlign: 'center',
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
});
