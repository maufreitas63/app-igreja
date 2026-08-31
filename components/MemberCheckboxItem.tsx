import type { FamilyMember } from '@/hooks/useFamilyMembers';
import type { RegistrationStatus } from '@/hooks/useRegisteredEventMembers';
import { formatShortName } from '@/lib/formatShortName';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  member: FamilyMember;
  disabled?: boolean;
  isChecked: boolean;
  isLoading?: boolean;
  isRegistered?: boolean;
  /** Nome do evento padrão (culto) em que o membro está inscrito. */
  registeredEventName?: string | null;
  registrationStatus?: RegistrationStatus;
  showKidsIndicator?: boolean;
  showTeensIndicator?: boolean;
  /** Sala efetiva (especial vigente ou padrão). */
  assignedRoomLabel?: string | null;
  /** True quando a sala efetiva é especial (sobreposição). */
  assignedRoomIsOverlay?: boolean;
  /** Check-in na sala Kids/Teens já registrado pelo servidor. */
  roomCheckInComplete?: boolean;
  minimal?: boolean;
  onToggle: () => void;
};

export const MemberCheckboxItem = ({
  member,
  disabled = false,
  isChecked,
  isLoading = false,
  isRegistered = false,
  registeredEventName = null,
  assignedRoomLabel = null,
  assignedRoomIsOverlay: _assignedRoomIsOverlay = false,
  roomCheckInComplete = false,
  minimal = false,
  onToggle,
}: Props) => {
  const displayName = formatShortName(member.full_name);
  const roomLabel = assignedRoomLabel?.trim() || '';
  const eventLabel = registeredEventName?.trim() || '';
  // Sala alocada (padrão/especial) tem prioridade na linha de status.
  // Sem sala: inscrição no evento padrão, senão «Sem Inscrições».
  const statusLine = (() => {
    if (roomLabel) {
      return `Inscrito em: ${roomLabel}`;
    }
    if (isRegistered && eventLabel) {
      return `Inscrito em: ${eventLabel}`;
    }
    if (isRegistered) {
      return 'Inscrito em: evento';
    }
    return 'Sem Inscrições';
  })();
  const hasStatusHighlight = Boolean(roomLabel) || isRegistered;

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
        </View>
        <Text
          style={[
            styles.registeredText,
            minimal && styles.registeredTextMinimal,
            !hasStatusHighlight && styles.noRegistrationText,
            !hasStatusHighlight && minimal && styles.noRegistrationTextMinimal,
          ]}
          numberOfLines={2}
        >
          {statusLine}
        </Text>
      </View>
      {roomCheckInComplete ? (
        <View
          accessibilityLabel="Check-in na sala concluído"
          accessibilityRole="text"
          style={[styles.roomCheckInBadge, minimal && styles.roomCheckInBadgeMinimal]}
        >
          <FontAwesome
            name="sign-in"
            size={11}
            color={minimal ? MINIMAL_UI.onDark : '#B45309'}
          />
          <Text
            style={[styles.roomCheckInBadgeText, minimal && styles.roomCheckInBadgeTextMinimal]}
          >
            Na sala
          </Text>
        </View>
      ) : null}
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
  registeredText: {
    color: '#34d399',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  registeredTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  noRegistrationText: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontWeight: '500',
  },
  noRegistrationTextMinimal: {
    color: MINIMAL_UI.textMuted,
    fontWeight: '500',
  },
  roomCheckInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    flexShrink: 0,
  },
  roomCheckInBadgeMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderColor: MINIMAL_UI.blueDark,
  },
  roomCheckInBadgeText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  roomCheckInBadgeTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
});
