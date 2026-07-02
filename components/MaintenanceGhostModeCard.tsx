import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useGhostMode } from '@/context/GhostModeContext';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatShortName } from '@/lib/formatShortName';
import {
  fetchGhostTargetProfilePreview,
  GHOST_MODE_SQL_HINT,
  type GhostModeProfileOption,
  type GhostModeTargetPreview,
} from '@/lib/ghostModeApi';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  isActive?: boolean;
  panelHeight: number;
};

const formatPreviewDate = (value: string | null) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

const formatPreviewDateTime = (value: string | null) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

const PreviewRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <View style={styles.previewRow}>
    <Text style={styles.previewLabel}>{label}</Text>
    <Text style={styles.previewValue}>{value?.trim() || '—'}</Text>
  </View>
);

function GhostModeProfilePreviewPanel({
  loading,
  error,
  preview,
}: {
  loading: boolean;
  error: string | null;
  preview: GhostModeTargetPreview | null;
}) {
  if (loading) {
    return (
      <View style={styles.previewBox}>
        <CardLoadingState lines={4} compact />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.previewBox}>
        <Text style={styles.previewTitle}>Prévia do usuário selecionado</Text>
        <Text style={styles.previewError}>{error}</Text>
      </View>
    );
  }

  if (!preview) {
    return null;
  }

  const { profile, roles, implicitVisitante } = preview;
  const addressParts = [
    profile.addressStreet,
    profile.addressNumber,
    profile.addressNeighborhood,
    profile.addressCity,
    profile.addressState,
  ].filter(Boolean);

  return (
    <View style={styles.previewBox}>
      <Text style={styles.previewTitle}>Prévia do usuário selecionado</Text>
      <Text style={styles.previewSubtitle}>
        Confira identidade, membresia e papéis antes de ativar o Modo Ghost.
      </Text>

      <Text style={styles.previewSectionTitle}>Identificação</Text>
      <PreviewRow label="Nome completo" value={profile.fullName} />
      <PreviewRow label="Telefone" value={profile.phone} />
      <PreviewRow label="Código de membro" value={profile.memberCode} />
      <PreviewRow label="Família" value={profile.familyId} />
      <PreviewRow label="CPF" value={profile.cpf} />
      <PreviewRow label="E-mail" value={profile.email} />
      <PreviewRow label="Nascimento" value={formatPreviewDate(profile.birthDate)} />
      <PreviewRow label="ID do perfil" value={profile.id} />

      <Text style={styles.previewSectionTitle}>Membresia e LGPD</Text>
      <PreviewRow
        label="Status"
        value={
          profile.membershipOut
            ? `Desligado em ${formatPreviewDate(profile.membershipOut)}`
            : 'Ativo no aplicativo'
        }
      />
      <PreviewRow
        label="LGPD aceita"
        value={
          profile.lgpdAccepted === true
            ? 'Sim'
            : profile.lgpdAccepted === false
              ? 'Não'
              : '—'
        }
      />

      <Text style={styles.previewSectionTitle}>Endereço</Text>
      <PreviewRow label="CEP" value={profile.cep} />
      <PreviewRow label="Endereço" value={addressParts.length ? addressParts.join(', ') : null} />

      <Text style={styles.previewSectionTitle}>Papéis de acesso</Text>
      {implicitVisitante ? (
        <Text style={styles.visitanteHint}>
          Nenhum papel atribuído — o aplicativo trata este perfil como visitante.
        </Text>
      ) : null}

      {roles.length ? (
        <View style={styles.rolesList}>
          {roles.map((role) => (
            <View key={role.roleId} style={styles.roleChip}>
              <Text style={styles.roleChipName}>{role.roleName}</Text>
              <Text style={styles.roleChipCode}>{role.roleCode}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.previewMuted}>Sem papéis explícitos na tabela de acesso.</Text>
      )}

      <Text style={styles.previewSectionTitle}>Registro</Text>
      <PreviewRow label="Criado em" value={formatPreviewDateTime(profile.createdAt)} />
      <PreviewRow label="Atualizado em" value={formatPreviewDateTime(profile.updatedAt)} />
    </View>
  );
}

export function MaintenanceGhostModeCard({ isActive = false, panelHeight }: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const { isActive: ghostActive, startGhostMode } = useGhostMode();
  const [profiles, setProfiles] = useState<GhostModeProfileOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rpcMissing, setRpcMissing] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GhostModeTargetPreview | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRpcMissing(false);

    try {
      const { listActiveProfilesForGhostMode } = await import('@/lib/ghostModeApi');
      const rows = await listActiveProfilesForGhostMode();
      setProfiles(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível carregar usuários.';
      setError(message);
      setRpcMissing(message.includes('access-control-ghost-mode.sql'));
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive || ghostActive) {
      return;
    }

    void loadProfiles();
  }, [ghostActive, isActive, loadProfiles]);

  useEffect(() => {
    if (!selectedProfileId) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let active = true;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);

    void (async () => {
      const result = await fetchGhostTargetProfilePreview(selectedProfileId);

      if (!active) {
        return;
      }

      if (!result.success) {
        setPreviewError(result.message);
        setPreview(null);
        setPreviewLoading(false);
        return;
      }

      setPreview(result.preview);
      setPreviewLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [selectedProfileId]);

  const profileOptions = useMemo(
    () =>
      profiles.map((profile) => ({
        value: profile.id,
        label: `${formatShortName(profile.fullName)}${profile.phone ? ` · ${profile.phone}` : ''}`,
      })),
    [profiles]
  );

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;

  const handleStartGhost = async () => {
    if (!selectedProfile) {
      Toast.show({
        type: 'error',
        text1: 'Modo Ghost',
        text2: 'Selecione um usuário ativo.',
      });
      return;
    }

    const confirmed = await confirmDialog(
      'Ativar Modo Ghost',
      `Simular a sessão de ${formatShortName(selectedProfile.fullName)}?\n\nVocê verá o aplicativo com as mesmas permissões deste usuário. As alterações serão registradas em nome dele, com auditoria do operador real.`,
      'Ativar',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    setStarting(true);

    try {
      const result = await startGhostMode({
        targetProfileId: selectedProfile.id,
        targetFullName: selectedProfile.fullName,
      });

      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Modo Ghost',
        text2: result.message,
        visibilityTime: result.success ? 4000 : 5500,
      });
    } finally {
      setStarting(false);
    }
  };

  if (ghostActive) {
    return (
      <View style={[maintenancePanelStyles.panelScrollContent, { minHeight: contentHeight }]}>
        <Text style={styles.title}>Modo Ghost (Auditor)</Text>
        <Text style={styles.hint}>
          O Modo Ghost já está ativo. Use o banner superior para encerrar a simulação e voltar ao seu
          usuário real.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[maintenancePanelStyles.panelScrollContent, { minHeight: contentHeight }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <Text style={styles.title}>Modo Ghost (Auditor)</Text>
      <Text style={styles.hint}>
        Selecione um usuário ativo para simular a identidade dele e validar permissões de acesso na
        Dashboard e demais telas. Disponível apenas para administradores autorizados.
      </Text>

      {rpcMissing ? <Text style={styles.warningText}>{GHOST_MODE_SQL_HINT}</Text> : null}
      {error && !rpcMissing ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? <CardLoadingState lines={3} compact /> : null}

      {!loading ? (
        <>
          <SectionLabel>Usuário ativo</SectionLabel>
          <DropdownSelect
            options={profileOptions}
            selectedValue={selectedProfileId ?? ''}
            onValueChange={(value) => setSelectedProfileId(value || null)}
            modalTitle="Selecionar usuário"
            placeholder="Selecione um usuário..."
            searchPlaceholder="Digite nome ou telefone..."
            searchable
            disabled={starting || profileOptions.length === 0}
          />

          <TouchableOpacity
            style={[styles.primaryButton, (starting || !selectedProfileId) && styles.primaryButtonDisabled]}
            onPress={() => void handleStartGhost()}
            disabled={starting || !selectedProfileId}
            activeOpacity={0.85}
          >
            {starting ? (
              <ActivityIndicator color="#0f172a" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Ativar Modo Ghost</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerHint}>
            O estado persiste durante a navegação e é resetado ao sair do app ou fazer logout.
          </Text>

          {selectedProfileId ? (
            <GhostModeProfilePreviewPanel
              loading={previewLoading}
              error={previewError}
              preview={preview}
            />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  hint: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  footerHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
  },
  warningText: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  primaryButton: {
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#FCD34D',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  previewBox: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.45)',
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    padding: 14,
    gap: 4,
  },
  previewTitle: {
    color: '#FECDD3',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  previewSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  previewSectionTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 4,
  },
  previewRow: {
    gap: 2,
    marginBottom: 4,
  },
  previewLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewValue: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  previewError: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 18,
  },
  previewMuted: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  visitanteHint: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  rolesList: {
    gap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  roleChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  roleChipName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  roleChipCode: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
});
