import type { FamilyMember } from '@/hooks/useFamilyMembers';
import { formatShortName } from '@/lib/formatShortName';
import {
  loadManagedMemberCareFields,
  saveManagedMemberCareFields,
} from '@/lib/memberProfiles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  member: FamilyMember | null;
  /** Quando o id da linha é o perfil (inscrição individual), não o cadastro da família. */
  profileId?: string | null;
  onClose: () => void;
};

export function AudienceCareRestrictionsModal({ member, profileId = null, onClose }: Props) {
  const [medicalFoodAlerts, setMedicalFoodAlerts] = useState('');
  const [additionalCareNotes, setAdditionalCareNotes] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!member) {
      return;
    }

    let active = true;
    setLoading(true);
    setReady(false);
    setError(null);
    setMedicalFoodAlerts('');
    setAdditionalCareNotes('');
    setSpecialNeeds('');

    void (async () => {
      try {
        const fields = await loadManagedMemberCareFields({
          memberId: profileId ? null : member.id,
          profileId,
        });
        if (!active) {
          return;
        }
        setMedicalFoodAlerts(fields.medicalFoodAlerts);
        setAdditionalCareNotes(fields.additionalCareNotes);
        setSpecialNeeds(fields.specialNeeds);
        setReady(true);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar as restrições.'
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [member, profileId]);

  const save = async () => {
    if (!member || loading || saving || !ready) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saveManagedMemberCareFields({
        memberId: profileId ? null : member.id,
        profileId,
        medicalFoodAlerts,
        additionalCareNotes,
        specialNeeds,
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Não foi possível salvar as restrições.'
      );
    } finally {
      setSaving(false);
    }
  };

  const displayName = member
    ? formatShortName(member.full_name, { profileId: member.id })
    : '';

  return (
    <Modal
      visible={member != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Restrições</Text>
          {displayName ? <Text style={styles.subtitle}>{displayName}</Text> : null}
          {loading ? (
            <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
          ) : (
            <ScrollView
              style={styles.form}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.label}>Restrição Alimentar</Text>
              <TextInput
                style={styles.input}
                value={medicalFoodAlerts}
                onChangeText={setMedicalFoodAlerts}
                placeholder="Ex.: sem lactose, alérgico a amendoim"
                placeholderTextColor={MINIMAL_UI.textMuted}
                multiline
                editable={!saving}
              />
              <Text style={styles.label}>Observações Adicionais</Text>
              <TextInput
                style={styles.input}
                value={additionalCareNotes}
                onChangeText={setAdditionalCareNotes}
                placeholder="Opcional"
                placeholderTextColor={MINIMAL_UI.textMuted}
                multiline
                editable={!saving}
              />
              <Text style={styles.label}>Necessidades Específicas</Text>
              <TextInput
                style={styles.input}
                value={specialNeeds}
                onChangeText={setSpecialNeeds}
                placeholder="Opcional"
                placeholderTextColor={MINIMAL_UI.textMuted}
                multiline
                editable={!saving}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>
          )}
          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={onClose}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, (loading || saving || !ready) && styles.saveButtonDisabled]}
              onPress={() => {
                void save();
              }}
              disabled={loading || saving || !ready}
              accessibilityRole="button"
              accessibilityLabel="Salvar"
            >
              {saving ? (
                <ActivityIndicator color={MINIMAL_UI.onDark} />
              ) : (
                <Text style={styles.saveText}>Salvar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    padding: 16,
  },
  title: {
    color: MINIMAL_UI.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 12,
  },
  loader: {
    marginVertical: 24,
  },
  form: {
    flexGrow: 0,
  },
  label: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: MINIMAL_UI.text,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  error: {
    color: '#B91C1C',
    marginTop: 10,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  cancelText: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.accent,
    minWidth: 88,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '800',
  },
});
