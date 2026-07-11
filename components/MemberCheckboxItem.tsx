import type { FamilyMember } from '@/hooks/useFamilyMembers';
import type { RegistrationStatus } from '@/hooks/useRegisteredEventMembers';
import { formatFullName } from '@/lib/fullName';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  member: FamilyMember;
  disabled?: boolean;
  isChecked: boolean;
  isLoading?: boolean;
  isRegistered?: boolean;
  registrationStatus?: RegistrationStatus;
  showKidsIndicator?: boolean;
  showTeensIndicator?: boolean;
  /** Nome afetivo da sala atribuída (ex.: Turma do Rei). */
  assignedRoomLabel?: string | null;
  minimal?: boolean;
  onToggle: () => void;
};

export const MemberCheckboxItem = ({
  member,
  disabled = false,
  isChecked,
  isLoading = false,
  isRegistered = false,
  registrationStatus,
  showKidsIndicator = false,
  showTeensIndicator = false,
  assignedRoomLabel = null,
  minimal = false,
  onToggle,
}: Props) => {
  const displayName = formatFullName(member.full_name);
  const roomLabel = assignedRoomLabel?.trim() || '';
  const shouldShowStatusDot =
    (registrationStatus === 'KIDS' && showKidsIndicator) ||
    (registrationStatus === 'TEENS' && showTeensIndicator);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[
          styles.checkbox,
          minimal && styles.checkboxMinimal,
          isChecked && styles.checkboxChecked,
          isChecked && minimal && styles.checkboxCheckedMinimal,
          disabled && styles.checkboxDisabled,
          isRegistered && styles.checkboxRegistered,
          isRegistered && minimal && styles.checkboxRegisteredMinimal,
        ]}
        onPress={onToggle}
        disabled={disabled || isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={minimal ? MINIMAL_UI.icon : '#020617'} />
        ) : isChecked ? (
          <Text style={[styles.checkmark, minimal && styles.checkmarkMinimal]}>✓</Text>
        ) : null}
      </TouchableOpacity>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, minimal && styles.nameMinimal]} numberOfLines={1}>
            {displayName}
          </Text>
          {shouldShowStatusDot ? (
            <View
              style={[
                styles.statusDot,
                registrationStatus === 'KIDS' ? styles.statusDotKids : styles.statusDotTeens,
              ]}
            />
          ) : null}
          {roomLabel ? (
            <Text
              style={[styles.roomLabel, minimal && styles.roomLabelMinimal]}
              numberOfLines={1}
            >
              {roomLabel}
            </Text>
          ) : null}
        </View>
        {isRegistered ? (
          <Text style={[styles.registeredText, minimal && styles.registeredTextMinimal]}>
            Registrado para o evento
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: '100%',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#10b981',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxMinimal: {
    borderColor: MINIMAL_UI.icon,
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
  },
  checkboxCheckedMinimal: {
    backgroundColor: MINIMAL_UI.icon,
  },
  checkboxDisabled: {
    opacity: 0.45,
  },
  checkboxRegistered: {
    borderColor: '#34d399',
    backgroundColor: '#34d399',
  },
  checkboxRegisteredMinimal: {
    borderColor: MINIMAL_UI.textMuted,
    backgroundColor: MINIMAL_UI.textMuted,
  },
  checkmark: {
    color: '#020617',
    fontSize: 14,
    fontWeight: '900',
  },
  checkmarkMinimal: {
    color: MINIMAL_UI.background,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    width: '100%',
  },
  name: {
    color: '#FFF',
    fontSize: 16,
    flex: 1,
    minWidth: 0,
  },
  nameMinimal: {
    color: MINIMAL_UI.text,
    fontWeight: '600',
  },
  roomLabel: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
    maxWidth: '42%',
    textAlign: 'right',
  },
  roomLabelMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  statusDotKids: {
    backgroundColor: '#FACC15',
  },
  statusDotTeens: {
    backgroundColor: '#EF4444',
  },
  registeredText: {
    color: '#34d399',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  registeredTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
});
