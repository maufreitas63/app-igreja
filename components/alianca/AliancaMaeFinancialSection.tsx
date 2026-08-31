import {
  formatAliancaCents,
  formatAliancaDate,
  type AliancaMaePanel,
} from '@/lib/alianca/types';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type Props = {
  loading: boolean;
  panel: AliancaMaePanel | null;
  compact?: boolean;
};

export function AliancaMaeFinancialSection({ loading, panel, compact }: Props) {
  if (loading) {
    return <ActivityIndicator color={compact ? MINIMAL_UI.accent : '#10b981'} style={styles.loader} />;
  }

  if (!panel?.success) {
    return (
      <Text style={styles.empty}>
        {panel?.message || 'Não foi possível carregar a Aliança Conecta Reino.'}
      </Text>
    );
  }

  if (panel.daughters.length === 0 && panel.payouts.length === 0) {
    return (
      <Text style={styles.empty}>
        Esta igreja ainda não indicou outras instâncias. Quando uma igreja filha pagar a
        assinatura Conecta+, a oferta de apoio ministerial (40% por até 4 trimestres) aparece
        aqui.
      </Text>
    );
  }

  return (
    <View style={styles.body}>
      <Text style={styles.category}>Oferta de Apoio Ministerial - Aliança</Text>
      <Text style={styles.hint}>
        40% da assinatura trimestral da igreja filha, em até 4 ciclos (12 meses). A administração
        central quita a oferta manualmente, em até 30 dias após o pagamento da fatura.
      </Text>

      {panel.daughters.map((row) => (
        <View key={row.filha_tenant_id} style={styles.card}>
          <Text style={styles.cardTitle}>
            {row.filha_name} ({row.filha_code})
          </Text>
          <Text style={styles.meta}>Bonificação: {row.status_label}</Text>
          <Text style={styles.meta}>Ciclos quitados: {row.ciclos_pagos}/4</Text>
          {row.next_amount_cents != null ? (
            <Text style={styles.meta}>
              Próxima oferta prevista: {formatAliancaCents(row.next_amount_cents)} até{' '}
              {formatAliancaDate(row.next_due_at)}
            </Text>
          ) : (
            <Text style={styles.meta}>Sem oferta provisionada no momento.</Text>
          )}
        </View>
      ))}

      <Text style={styles.subhead}>Extrato de ofertas</Text>
      {panel.payouts.length === 0 ? (
        <Text style={styles.empty}>Nenhum repasse registrado ainda.</Text>
      ) : (
        panel.payouts.map((row) => (
          <View key={row.id} style={styles.line}>
            <Text style={styles.lineTitle}>
              {row.filha_name} · {formatAliancaCents(row.reward_amount_cents)}
            </Text>
            <Text style={styles.meta}>
              {row.status === 'Pago' ? 'Efetivada' : 'A pagar'}
              {row.status === 'Pago'
                ? ` em ${formatAliancaDate(row.paid_at)}`
                : ` · previsão ${formatAliancaDate(row.due_at)}`}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: 16,
  },
  body: {
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  category: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '800',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  subhead: {
    color: MINIMAL_UI.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  card: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    padding: 10,
    gap: 2,
    backgroundColor: '#FFFFFF',
  },
  cardTitle: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  line: {
    gap: 2,
    paddingVertical: 4,
  },
  lineTitle: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});
