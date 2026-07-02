import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useGhostMode } from '@/context/GhostModeContext';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatShortName } from '@/lib/formatShortName';
import {
  GHOST_MODE_SQL_HINT,
  type GhostModeProfileOption,
} from '@/lib/ghostModeApi';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

export function MaintenanceGhostModeCard({ isActive = false, panelHeight }: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const { isActive: ghostActive, startGhostMode } = useGhostMode();
  const [profiles, setProfiles] = useState<GhostModeProfileOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rpcMissing, setRpcMissing] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

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
    <View style={[maintenancePanelStyles.panelScrollContent, { minHeight: contentHeight }]}>
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
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
