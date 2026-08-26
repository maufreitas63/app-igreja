import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  cancelScaleSwap,
  listMyScaleSwaps,
  respondScaleSwap,
  SCALE_SWAP_STATUS_LABEL,
  type ScaleSwapRequestRow,
} from '@/lib/scaleSwapApi';
import { formatServiceDateLabel } from '@/lib/scalesClassUtils';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  active: boolean;
  onRosterChanged?: () => void;
};

export function ScaleSwapInbox({ active, onRosterChanged }: Props) {
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ScaleSwapRequestRow[]>([]);

  const reload = useCallback(async () => {
    if (!active) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setRows(await listMyScaleSwaps());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as trocas.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleRespond = async (row: ScaleSwapRequestRow, accept: boolean) => {
    setBusyId(row.id);

    try {
      const result = await respondScaleSwap(row.id, accept);

      if (!result.success) {
        Alert.alert('Troca de escala', result.message);
        return;
      }

      Alert.alert('Troca de escala', result.message);
      await reload();

      if (accept) {
        onRosterChanged?.();
      }
    } catch (respondError) {
      Alert.alert(
        'Troca de escala',
        respondError instanceof Error ? respondError.message : 'Não foi possível responder.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (row: ScaleSwapRequestRow) => {
    setBusyId(row.id);

    try {
      const result = await cancelScaleSwap(row.id);

      if (!result.success) {
        Alert.alert('Troca de escala', result.message);
        return;
      }

      await reload();
    } catch (cancelError) {
      Alert.alert(
        'Troca de escala',
        cancelError instanceof Error ? cancelError.message : 'Não foi possível cancelar.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const received = rows.filter((row) => row.direction === 'recebido');
  const sent = rows.filter((row) => row.direction === 'enviado');

  if (loading && rows.length === 0) {
    return <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} style={styles.loader} />;
  }

  if (error) {
    return (
      <View style={styles.messageBox}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={() => void reload()}>
          <Text style={styles.retryText}>Atualizar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.content}>
      <Text style={styles.section}>Pedidos recebidos</Text>
      {received.length === 0 ? (
        <Text style={styles.empty}>Nenhum pedido recebido.</Text>
      ) : (
        received.map((row) => (
          <SwapCard
            key={row.id}
            row={row}
            busy={busyId === row.id}
            onAccept={() => void handleRespond(row, true)}
            onRefuse={() => void handleRespond(row, false)}
          />
        ))
      )}

      <Text style={styles.section}>Pedidos enviados</Text>
      {sent.length === 0 ? (
        <Text style={styles.empty}>Nenhum pedido enviado.</Text>
      ) : (
        sent.map((row) => (
          <SwapCard
            key={row.id}
            row={row}
            busy={busyId === row.id}
            onCancel={row.status === 'pendente' ? () => void handleCancel(row) : undefined}
          />
        ))
      )}
    </ScrollView>
  );
}

function SwapCard({
  row,
  busy,
  onAccept,
  onRefuse,
  onCancel,
}: {
  row: ScaleSwapRequestRow;
  busy: boolean;
  onAccept?: () => void;
  onRefuse?: () => void;
  onCancel?: () => void;
}) {
  const partner =
    row.direction === 'recebido' ? row.solicitanteNome : row.substitutoNome ?? 'Aguardando';

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {row.tipoNome} · {formatServiceDateLabel(row.dataServico)}
      </Text>
      <Text style={styles.cardMeta}>
        {row.direction === 'recebido' ? 'De' : 'Para'}: {partner}
      </Text>
      <Text style={styles.status}>{SCALE_SWAP_STATUS_LABEL[row.status]}</Text>
      {row.motivo ? <Text style={styles.motivo}>{row.motivo}</Text> : null}
      {row.status === 'pendente' && (onAccept || onRefuse || onCancel) ? (
        <View style={styles.actions}>
          {onAccept ? (
            <TouchableOpacity style={styles.accept} onPress={onAccept} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.acceptText}>Aceitar</Text>
              )}
            </TouchableOpacity>
          ) : null}
          {onRefuse ? (
            <TouchableOpacity style={styles.refuse} onPress={onRefuse} disabled={busy}>
              <Text style={styles.refuseText}>Recusar</Text>
            </TouchableOpacity>
          ) : null}
          {onCancel ? (
            <TouchableOpacity style={styles.refuse} onPress={onCancel} disabled={busy}>
              <Text style={styles.refuseText}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginVertical: 24,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    gap: 8,
    paddingBottom: 16,
  },
  messageBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
  },
  retry: {
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontWeight: '700',
  },
  section: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: '#FFFFFF',
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  cardMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
  },
  status: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  motivo: {
    color: '#334155',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  accept: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  refuse: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refuseText: {
    color: '#DC2626',
    fontWeight: '800',
  },
});
