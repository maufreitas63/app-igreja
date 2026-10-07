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
        Esta igreja ainda não indicou outras instâncias. Quando uma igreja indicada pagar o
        pacote, o cashback de 10% aparece aqui, limitado a 100% do pacote desta igreja.
      </Text>
    );
  }

  return (
    <View style={styles.body}>
      <Text style={styles.category}>Cashback Aliança — 10%</Text>
      <Text style={styles.hint}>
        10% perpétuo do pacote da igreja indicada, como desconto na fatura desta igreja.
        Vale enquanto as duas estiverem ativas. O desconto não passa de 100% do pacote daqui.
      </Text>
      {panel.package_cents > 0 ? (
        <Text style={styles.meta}>
          Pacote desta igreja: {formatAliancaCents(panel.package_cents)} · cashback em aberto:{' '}
          {formatAliancaCents(panel.cashback_open_cents)}
        </Text>
      ) : null}

      {panel.daughters.map((row) => (
        <View key={row.filha_tenant_id} style={styles.card}>
          <Text style={styles.cardTitle}>
            {row.filha_name} ({row.filha_code})
          </Text>
          <Text style={styles.meta}>{row.status_label}</Text>
          {row.next_amount_cents != null ? (
            <Text style={styles.meta}>
              Cashback disponível: {formatAliancaCents(row.next_amount_cents)}
            </Text>
          ) : (
            <Text style={styles.meta}>Sem cashback em aberto desta igreja.</Text>
          )}
        </View>
      ))}

      <Text style={styles.subhead}>Extrato de cashback</Text>
      {panel.payouts.length === 0 ? (
        <Text style={styles.empty}>Nenhum repasse registrado ainda.</Text>
      ) : (
        panel.payouts.map((row) => (
          <View key={row.id} style={styles.line}>
            <Text style={styles.lineTitle}>
              {row.filha_name} · {formatAliancaCents(row.reward_amount_cents)}
            </Text>
            <Text style={styles.meta}>
              {row.status === 'Abatido'
                ? `Abatido na fatura em ${formatAliancaDate(row.paid_at)}`
                : row.status === 'Creditado'
                  ? 'Disponível na próxima fatura'
                  : row.status === 'Pago'
                    ? `Pago em ${formatAliancaDate(row.paid_at)} (modelo anterior)`
                    : `A pagar até ${formatAliancaDate(row.due_at)} (modelo anterior)`}
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
