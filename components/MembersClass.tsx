import { MemberPhotoPicker } from '@/components/MemberPhotoPicker';
import {
  OPCOES_PARENTESCO,
  formatDisplayDate,
  formatDate,
  getBirthDateElapsedCode,
  getMemberRoomStatus,
  type ManagedMember,
} from '@/lib/manageMembers/shared';
import {
  ACCENT,
  MEMBERS_CLASS_ICON_COLOR,
  membersClassStyles,
} from '@/lib/manageMembers/membersClassStyles';
import { formatShortName } from '@/lib/formatShortName';
import { canSearchProfileByName } from '@/lib/lookupProfileByPhoneForMember';
import { type ProfileMemberLookup } from '@/lib/lookupProfileByPhoneForMember';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type MembersClassProps = {
  embedded?: boolean;
  insetsBottom: number;
  listRef: React.RefObject<FlatList<ManagedMember> | null>;
  familyId: string;
  members: ManagedMember[];
  editingMemberId: string | null;
  memberFormSectionExpanded: boolean;
  onToggleMemberFormSection: () => void;
  name: string;
  onNameChange: (value: string) => void;
  onNameBlur: () => void;
  nameSearchLoading: boolean;
  nameSearchResults: ProfileMemberLookup[];
  linkedProfile: ProfileMemberLookup | null;
  profileLookupMessage: string | null;
  onSelectProfileFromNameSearch: (profile: ProfileMemberLookup) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  onPhoneBlur: () => void;
  birthDate: string;
  onBirthDateChange: (value: string) => void;
  parentesco: string;
  onParentescoChange: (value: string) => void;
  pendingMemberPhoto: string | null;
  onPendingMemberPhotoChange: (value: string | null) => void;
  medicalFoodAlerts: string;
  onMedicalFoodAlertsChange: (value: string) => void;
  adding: boolean;
  deleting: boolean;
  canUpdateFamilyMembers: boolean;
  onAddMember: () => void;
  onConfirmDeleteEditingMember: () => void;
  onResetForm: () => void;
  idadeKids: number | null;
  idadeTeens: number | null;
  showVidaTmp: boolean;
  pendingAcceptedMemberIds: string[];
  onToggleMemberAccepted: (member: ManagedMember) => void;
  onStartEditingMember: (member: ManagedMember) => void;
  onLeaveScreen: () => void;
};

export function MembersClass({
  embedded = false,
  insetsBottom,
  listRef,
  familyId,
  members,
  editingMemberId,
  memberFormSectionExpanded,
  onToggleMemberFormSection,
  name,
  onNameChange,
  onNameBlur,
  nameSearchLoading,
  nameSearchResults,
  linkedProfile,
  profileLookupMessage,
  onSelectProfileFromNameSearch,
  phone,
  onPhoneChange,
  onPhoneBlur,
  birthDate,
  onBirthDateChange,
  parentesco,
  onParentescoChange,
  pendingMemberPhoto,
  onPendingMemberPhotoChange,
  medicalFoodAlerts,
  onMedicalFoodAlertsChange,
  adding,
  deleting,
  canUpdateFamilyMembers,
  onAddMember,
  onConfirmDeleteEditingMember,
  onResetForm,
  idadeKids,
  idadeTeens,
  showVidaTmp,
  pendingAcceptedMemberIds,
  onToggleMemberAccepted,
  onStartEditingMember,
  onLeaveScreen,
}: MembersClassProps) {
  const Root = embedded ? View : SafeAreaView;
  const rootProps = embedded
    ? { style: membersClassStyles.containerEmbedded }
    : { style: membersClassStyles.container, edges: ['top', 'left', 'right'] as const };

  return (
    <Root {...rootProps}>
      <View style={membersClassStyles.header}>
        <Text style={membersClassStyles.titleCentered}>Gerenciar Família</Text>
        <View style={membersClassStyles.readOnlyContainer}>
          <Text style={membersClassStyles.readOnlyText}>
            {familyId ? `Família Atual: ${familyId}` : 'Família não vinculada ao perfil'}
          </Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        style={embedded ? membersClassStyles.membersListEmbedded : membersClassStyles.membersList}
        data={members}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={embedded}
        contentContainerStyle={[
          membersClassStyles.membersListContent,
          { paddingBottom: Math.max(100, insetsBottom + 88) },
        ]}
        ListHeaderComponent={
          <>
            <View style={membersClassStyles.memberFormSection}>
              <TouchableOpacity
                style={membersClassStyles.memberFormSectionHeader}
                onPress={() => onToggleMemberFormSection()}
                activeOpacity={0.85}
              >
                <View style={membersClassStyles.memberFormSectionHeaderText}>
                  <Text style={membersClassStyles.memberFormSectionTitle}>
                    {editingMemberId ? 'Editar integrante' : 'Adicionar integrante'}
                  </Text>
                  <Text style={membersClassStyles.memberFormSectionMeta}>
                    {editingMemberId ? 'Alterar dados do familiar' : 'Preencha os dados do familiar'}
                  </Text>
                </View>
                <MaterialIcons
                  name={memberFormSectionExpanded ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={MEMBERS_CLASS_ICON_COLOR}
                />
              </TouchableOpacity>

              {memberFormSectionExpanded ? (
              <View style={membersClassStyles.memberFormSectionBody}>
                <Text style={membersClassStyles.fieldLabel}>Nome completo</Text>
                {!editingMemberId ? (
                  <Text style={membersClassStyles.fieldHint}>
                    Digite o nome para buscar em perfis ou digite o nome completo para inserir manualmente um
                    integrante. Ao informar o telefone, o nome pode ser preenchido automaticamente pelo perfil.
                  </Text>
                ) : null}
                <TextInput
                  style={membersClassStyles.input}
                  placeholder="Nome completo (mín. 2 letras)"
                  placeholderTextColor={MINIMAL_UI.textMuted}
                  value={name}
                  autoCapitalize="words"
                  autoCorrect={false}
                  onChangeText={onNameChange}
                  onBlur={onNameBlur}
                />
                {!editingMemberId && nameSearchLoading ? (
                  <ActivityIndicator color={MINIMAL_UI.blueDark} style={membersClassStyles.nameSearchLoader} />
                ) : null}
                {!editingMemberId && canSearchProfileByName(name) && !nameSearchLoading ? (
                  <ScrollView
                    style={membersClassStyles.nameSearchResults}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {nameSearchResults.length ? (
                      nameSearchResults.map((profile) => {
                        const isSelected = linkedProfile?.id === profile.id;

                        return (
                          <TouchableOpacity
                            key={profile.id}
                            style={[membersClassStyles.nameSearchResultRow, isSelected && membersClassStyles.nameSearchResultRowSelected]}
                            onPress={() => onSelectProfileFromNameSearch(profile)}
                            activeOpacity={0.85}
                          >
                            <Text style={membersClassStyles.nameSearchResultName}>
                              {formatShortName(profile.full_name)}
                            </Text>
                            <Text style={membersClassStyles.nameSearchResultMeta}>
                              {[profile.phone, profile.family_id].filter(Boolean).join(' · ') ||
                                profile.full_name?.trim() ||
                                'Sem dados adicionais'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text style={membersClassStyles.nameSearchEmpty}>
                        Nenhum usuário encontrado. Preencha os dados manualmente.
                      </Text>
                    )}
                  </ScrollView>
                ) : !editingMemberId ? (
                  <Text style={membersClassStyles.nameSearchHint}>Digite pelo menos 2 letras para buscar.</Text>
                ) : null}
                {profileLookupMessage ? (
                  <Text
                    style={[
                      membersClassStyles.profileLookupMessage,
                      linkedProfile ? membersClassStyles.profileLookupMessageSuccess : membersClassStyles.profileLookupMessageMuted,
                    ]}
                  >
                    {profileLookupMessage}
                  </Text>
                ) : null}

                <Text style={membersClassStyles.fieldLabel}>Telefone</Text>
                <TextInput
                  style={membersClassStyles.input}
                  placeholder="(00) 00000-0000"
                  keyboardType="phone-pad"
                  maxLength={15}
                  placeholderTextColor={MINIMAL_UI.textMuted}
                  value={phone}
                  onChangeText={onPhoneChange}
                  onBlur={onPhoneBlur}
                />

                <Text style={membersClassStyles.fieldLabel}>Nascimento</Text>
                <TextInput
                  style={membersClassStyles.input}
                  placeholder="DD/MM/AAAA"
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholderTextColor={MINIMAL_UI.textMuted}
                  value={birthDate}
                  onChangeText={(value) => onBirthDateChange(formatDate(value))}
                />

                <Text style={membersClassStyles.fieldLabel}>Grau de parentesco</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={membersClassStyles.scrollOptions}>
                  {OPCOES_PARENTESCO.map((opcao) => (
                    <TouchableOpacity
                      key={opcao}
                      style={[membersClassStyles.option, parentesco === opcao && membersClassStyles.optionSelected]}
                      onPress={() => onParentescoChange(opcao)}
                    >
                      <Text style={parentesco === opcao ? membersClassStyles.optionTextSelected : membersClassStyles.optionText}>
                        {opcao}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {(!linkedProfile && !editingMemberId) || editingMemberId ? (
                  <MemberPhotoPicker
                    photoUri={pendingMemberPhoto}
                    onPhotoChange={onPendingMemberPhotoChange}
                    disabled={adding || deleting}
                  />
                ) : null}

                {editingMemberId ? (
                  <>
                    <Text style={membersClassStyles.fieldLabel}>Restrições alimentares</Text>
                    <Text style={membersClassStyles.fieldHint}>
                      Informe alergias, intolerâncias ou outras restrições do familiar.
                    </Text>
                    <TextInput
                      style={[membersClassStyles.input, membersClassStyles.multilineInput]}
                      placeholder="Ex.: sem lactose, alérgico a amendoim"
                      placeholderTextColor="#64748b"
                      value={medicalFoodAlerts}
                      onChangeText={onMedicalFoodAlertsChange}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </>
                ) : null}

                {editingMemberId ? (
                  <View style={membersClassStyles.memberFormSectionActions}>
                    <TouchableOpacity
                      style={membersClassStyles.addButton}
                      onPress={onAddMember}
                      disabled={adding || deleting}
                    >
                      <Text style={membersClassStyles.addButtonText}>
                        {adding ? '...' : 'SALVAR ALTERAÇÕES'}
                      </Text>
                    </TouchableOpacity>
                    {canUpdateFamilyMembers ? (
                    <TouchableOpacity
                      style={[
                        membersClassStyles.deleteMemberButton,
                        (adding || deleting) && membersClassStyles.deleteMemberButtonDisabled,
                      ]}
                      onPress={() => void onConfirmDeleteEditingMember()}
                      disabled={adding || deleting}
                      activeOpacity={0.85}
                    >
                      <Text style={membersClassStyles.deleteMemberButtonText}>
                        {deleting ? '...' : 'EXCLUIR INTEGRANTE'}
                      </Text>
                    </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={membersClassStyles.cancelEditButton} onPress={onResetForm}>
                      <Text style={membersClassStyles.cancelEditButtonText}>Cancelar edição</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={membersClassStyles.addButton}
                    onPress={onAddMember}
                    disabled={adding || deleting}
                  >
                    <Text style={membersClassStyles.addButtonText}>
                      {adding ? '...' : 'ADICIONAR INTEGRANTE'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              ) : null}
            </View>

            <Text style={[membersClassStyles.titleCentered, membersClassStyles.membersListTitle]}>Integrantes Cadastrados</Text>
          </>
        }
        renderItem={({ item }) => {
          const memberId = String(item.id);
          const isAcceptPending = pendingAcceptedMemberIds.includes(memberId);

          const isEditingThisMember = editingMemberId !== null && String(item.id) === String(editingMemberId);

          return (
          <View style={[membersClassStyles.memberRow, isEditingThisMember && membersClassStyles.memberRowEditing]}>
            <View style={membersClassStyles.memberRowMain}>
            {(() => {
              const birthDateElapsedCode = getBirthDateElapsedCode(item.birth_date);

              return (
                <View style={membersClassStyles.memberContent} pointerEvents="box-none">
                  <View style={membersClassStyles.memberNameRow}>
                    <Text style={membersClassStyles.memberName}>{item.full_name}</Text>
                    {(() => {
                      const roomStatus = getMemberRoomStatus(item.birth_date, idadeKids, idadeTeens);

                      if (!roomStatus) {
                        return null;
                      }

                      return (
                        <View
                          style={[
                            membersClassStyles.memberStatusDot,
                            roomStatus === 'KIDS' ? membersClassStyles.memberStatusDotKids : membersClassStyles.memberStatusDotTeens,
                          ]}
                        />
                      );
                    })()}
                  </View>
                  <Text style={membersClassStyles.memberInfo}>
                    {item.family_id} • {item.relationship}
                  </Text>
                  <Text style={membersClassStyles.memberInfo}>
                    {item.phone ? `${item.phone} ` : 'Sem telefone '}
                    {item.birth_date ? `• Nasc: ${formatDisplayDate(item.birth_date)}` : ''}
                  </Text>
                  {showVidaTmp && birthDateElapsedCode ? (
                    <Text style={membersClassStyles.memberInfo}>Vida: {birthDateElapsedCode}</Text>
                  ) : null}
                </View>
              );
            })()}
            <View style={membersClassStyles.memberActionsColumn}>
              <Pressable
                style={({ pressed }) => [
                  membersClassStyles.acceptButton,
                  item.accepted === true && membersClassStyles.acceptButtonChecked,
                  item.accepted === false && membersClassStyles.acceptButtonUnchecked,
                  isAcceptPending && membersClassStyles.acceptButtonPending,
                  pressed && !isAcceptPending && membersClassStyles.acceptButtonPressed,
                ]}
                onPress={() => void onToggleMemberAccepted(item)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: item.accepted === true,
                  disabled: isAcceptPending,
                }}
                accessibilityLabel={
                  item.accepted === true
                    ? `Integrante ${item.full_name} reconhecido como pertencente à família`
                    : item.accepted === false
                      ? `Integrante ${item.full_name} marcado como não pertencente à família`
                      : `Marcar ${item.full_name} como pertencente à família`
                }
              >
                {isAcceptPending ? (
                  <ActivityIndicator color={ACCENT} size="small" />
                ) : item.accepted === true ? (
                  <MaterialIcons name="check" size={18} color={MINIMAL_UI.onDark} />
                ) : item.accepted === false ? (
                  <MaterialIcons name="close" size={16} color="#B91C1C" />
                ) : (
                  <MaterialIcons name="check-box-outline-blank" size={20} color={MEMBERS_CLASS_ICON_COLOR} />
                )}
              </Pressable>
              {canUpdateFamilyMembers ? (
              <TouchableOpacity
                style={membersClassStyles.editButton}
                onPress={() => onStartEditingMember(item)}
                accessibilityRole="button"
                accessibilityLabel={`Editar integrante ${item.full_name}`}
              >
                <MaterialIcons name="edit" size={18} color={MINIMAL_UI.onDark} />
              </TouchableOpacity>
              ) : null}
            </View>
            </View>
          </View>
          );
        }}
      />

      <View style={[membersClassStyles.footerContainer, { paddingBottom: insetsBottom + 10 }]}>
        <TouchableOpacity style={membersClassStyles.backButton} onPress={onLeaveScreen}>
          <Text style={membersClassStyles.backButtonText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </Root>
  );
}
