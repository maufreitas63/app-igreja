import { QUORUM_REGISTRY_SQL_HINT } from '@/lib/quorumRegistry';
import type { QuorumRegistryRow } from '@/lib/quorumRegistry';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const COL = {
  order: 36,
  event: 120,
  date: 88,
  local: 100,
  capacity: 56,
  name: 120,
  phone: 100,
  email: 140,
  cpf: 108,
  status: 72,
} as const;

const TABLE_MIN_WIDTH =
  COL.order +
  COL.event +
  COL.date +
  COL.local +
  COL.capacity +
  COL.name +
  COL.phone +
  COL.email +
  COL.cpf +
  COL.status;

type Props = {
  rows: QuorumRegistryRow[];
  loading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  schemaMissing?: boolean;
};

const formatDate = (value: string | null) => {
  if (!value) {
    return '—';
  }

  return formatEventDateTimeLabel(value) || value;
};

const formatCapacity = (value: number | null) => {
  if (typeof value !== 'number') {
    return '—';
  }

  return String(value);
};

const formatStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'confirmado') {
    return 'Confirmado';
  }
  if (normalized === 'pre_checkin') {
    return 'Pré check-in';
  }
  if (normalized === 'inscrito') {
    return 'Inscrito';
  }

  return status;
};

const HeaderCell = ({ label, width }: { label: string; width: number }) => (
  <View style={[styles.headerCell, { width }]}>
    <Text style={styles.headerText}>{label}</Text>
  </View>
);

const BodyCell = ({ value, width }: { value: string; width: number }) => (
  <View style={[styles.bodyCell, { width }]}>
    <Text style={styles.bodyText} numberOfLines={2}>
      {value || '—'}
    </Text>
  </View>
);

export function QuorumCheckinRegistryTable({
  rows,
  loading,
  isRefreshing,
  error,
  schemaMissing,
}: Props) {
  if (schemaMissing) {
    return (
      <View style={styles.messageBox}>
        <Text style={styles.warningText}>
          Tabela de registro de quórum não encontrada no Supabase.
        </Text>
        <Text style={styles.hintText}>{QUORUM_REGISTRY_SQL_HINT}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.messageBox}>
        <ActivityIndicator color="#10b981" />
        <Text style={styles.hintText}>Carregando registro de check-in…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.messageBox}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!(rows ?? []).length) {
    return (
      <View style={styles.messageBox}>
        <Text style={styles.hintText}>
          Nenhum check-in registrado ainda. As linhas aparecem em ordem cronológica conforme a
          audiência for marcada.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Registro de check-in (quórum)</Text>
      <Text style={styles.subtitle}>Ordenado pela data/hora do registro de check-in</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator bounces={false}>
        <View style={{ minWidth: TABLE_MIN_WIDTH }}>
          <View style={styles.headerRow}>
            <HeaderCell label="#" width={COL.order} />
            <HeaderCell label="Evento" width={COL.event} />
            <HeaderCell label="Data" width={COL.date} />
            <HeaderCell label="Local" width={COL.local} />
            <HeaderCell label="Vagas" width={COL.capacity} />
            <HeaderCell label="Nome" width={COL.name} />
            <HeaderCell label="Celular" width={COL.phone} />
            <HeaderCell label="E-mail" width={COL.email} />
            <HeaderCell label="CPF" width={COL.cpf} />
            <HeaderCell label="Status" width={COL.status} />
          </View>
          <ScrollView style={styles.bodyScroll} nestedScrollEnabled showsVerticalScrollIndicator>
            {rows.map((row, index) => (
              <View
                key={row.id}
                style={[styles.dataRow, index % 2 === 1 ? styles.dataRowAlt : null]}
              >
                <BodyCell value={String(index + 1)} width={COL.order} />
                <BodyCell value={row.event_name} width={COL.event} />
                <BodyCell value={formatDate(row.event_date)} width={COL.date} />
                <BodyCell value={row.event_local ?? '—'} width={COL.local} />
                <BodyCell value={formatCapacity(row.max_capacity)} width={COL.capacity} />
                <BodyCell value={row.participant_name ?? '—'} width={COL.name} />
                <BodyCell value={row.participant_phone ?? '—'} width={COL.phone} />
                <BodyCell value={row.participant_email ?? '—'} width={COL.email} />
                <BodyCell value={row.participant_cpf ?? '—'} width={COL.cpf} />
                <BodyCell value={formatStatus(row.checkin_status)} width={COL.status} />
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
      {isRefreshing ? <Text style={styles.refreshHint}>Atualizando…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 12,
    gap: 6,
  },
  title: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#334155',
  },
  headerText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bodyScroll: {
    maxHeight: 280,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#334155',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  dataRowAlt: {
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
  },
  bodyCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
    justifyContent: 'center',
  },
  bodyText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 16,
  },
  messageBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    gap: 8,
    alignItems: 'center',
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  warningText: {
    color: '#F59E0B',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
  },
  refreshHint: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'right',
  },
});
