import type { FamilyMember } from '@/hooks/useFamilyMembers';
import type { RegistrationStatus } from '@/hooks/useRegisteredEventMembers';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const formatAudienceName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return parts[0] ?? fullName;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
};

type Props = {
  member: FamilyMember;
  disabled?: boolean;
  isChecked: boolean;
  isLoading?: boolean;
  isRegistered?: boolean;
  registrationStatus?: RegistrationStatus;
  showKidsIndicator?: boolean;
  showTeensIndicator?: boolean;
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
  onToggle,
}: Props) => {
  const displayName = formatAudienceName(member.full_name);
  const shouldShowStatusDot =
    (registrationStatus === 'KIDS' && showKidsIndicator) ||
    (registrationStatus === 'TEENS' && showTeensIndicator);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[
          styles.checkbox,
          isChecked && styles.checkboxChecked,
          disabled && styles.checkboxDisabled,
          isRegistered && styles.checkboxRegistered,
        ]}
        onPress={onToggle}
        disabled={disabled || isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? <ActivityIndicator size="small" color="#020617" /> : isChecked ? <Text style={styles.checkmark}>✓</Text> : null}
      </TouchableOpacity>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{displayName}</Text>
          {shouldShowStatusDot ? (
            <View
              style={[
                styles.statusDot,
                registrationStatus === 'KIDS' ? styles.statusDotKids : styles.statusDotTeens,
              ]}
            />
          ) : null}
        </View>
        {isRegistered ? <Text style={styles.registeredText}>Registrado para o evento</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
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
  checkboxChecked: {
    backgroundColor: '#10b981',
  },
  checkboxDisabled: {
    opacity: 0.45,
  },
  checkboxRegistered: {
    borderColor: '#34d399',
    backgroundColor: '#34d399',
  },
  checkmark: {
    color: '#020617',
    fontSize: 14,
    fontWeight: '900',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    color: '#FFF',
    fontSize: 16,
    flex: 1,
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
});
