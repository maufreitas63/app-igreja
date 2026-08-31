import {
  getAliancaAdminStatement,
  settleAliancaPayoutAdmin,
} from '@/lib/alianca/aliancaApi';
import {
  formatAliancaCents,
  formatAliancaDate,
  type AliancaAdminStatement,
} from '@/lib/alianca/types';
import { confirmDialog } from '@/lib/confirmDialog';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

export function AliancaAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statement, setStatement] = useState<AliancaAdminStatement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAliancaAdminStatement();
      setStatement(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSettle = async (payoutId: string, label: string) => {
    const confirmed = await confirmDialog(
      'Efetivar oferta Aliança',
      `Marcar como paga a oferta para ${label}? Isso avança o ciclo da parceria (encerra no 4º).`,
      'Marcar como paga',
      'Cancelar'
    );
    if (!confirmed) return;

    setBusyId(payoutId);
    try {
      const result = await settleAliancaPayoutAdmin(payoutId);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: result.success ? 'Oferta efetivada' : 'Baixa manual',
        text2: result.message,
      });
      if (result.success) {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Aliança Conecta Reino</Text>
      <Text style={styles.hint}>
        Demonstrativo das assinaturas Conecta+ (cartão, baixa imediata) e do passivo de 40% às
        igrejas mães. A quitação é manual: oferta de apoio ministerial, em até 30 dias.
      </Text>

      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} />
      ) : !statement?.success ? (
        <Text style={styles.empty}>{statement?.message || 'Não foi possível carregar.'}</Text>
      ) : (
        <>
          <View style={styles.kpis}>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Receitas brutas</Text>
              <Text style={styles.kpiValue}>{formatAliancaCents(statement.gross_revenue_cents)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>A pagar (passivo)</Text>
              <Text style={styles.kpiValue}>{formatAliancaCents(statement.payout_pending_cents)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Ofertas efetivadas</Text>
              <Text style={styles.kpiValue}>{formatAliancaCents(statement.payout_paid_cents)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Saldo líquido (realizado)</Text>
              <Text style={styles.kpiValue}>{formatAliancaCents(statement.net_realized_cents)}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            Se todas as ofertas em aberto forem pagas, o saldo fica{' '}
            {formatAliancaCents(statement.net_after_pending_cents)}.
          </Text>

          <Text style={styles.section}>Repasses</Text>
          {statement.payouts.length === 0 ? (
            <Text style={styles.empty}>Nenhum passivo gerado ainda.</Text>
          ) : (
            statement.payouts.map((row) => (
              <View key={row.id} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {row.mae_name} ← {row.filha_name}
                </Text>
                <Text style={styles.meta}>
                  {formatAliancaCents(row.reward_amount_cents)} (40% de{' '}
                  {formatAliancaCents(row.gross_amount_cents)}) · ciclos {row.ciclos_pagos}/4 ·{' '}
                  {row.status_global}
                </Text>
                <Text style={styles.meta}>
                  {row.status === 'Pago'
                    ? `Pago em ${formatAliancaDate(row.paid_at)}`
                    : `A pagar até ${formatAliancaDate(row.due_at)}`}
                </Text>
                {row.status === 'A_Pagar' ? (
                  <TouchableOpacity
                    style={[styles.button, busyId === row.id && styles.buttonDisabled]}
                    disabled={busyId === row.id}
                    onPress={() => void handleSettle(row.id, row.mae_name)}
                    activeOpacity={0.85}
                  >
                    {busyId === row.id ? (
                      <ActivityIndicator color={MINIMAL_UI.onDark} />
                    ) : (
                      <Text style={styles.buttonText}>Pago / Oferta efetivada</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    paddingBottom: 24,
    gap: 8,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  kpis: {
    paddingHorizontal: 16,
    gap: 8,
  },
  kpi: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  kpiLabel: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  kpiValue: {
    color: MINIMAL_UI.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  section: {
    ...MINIMAL_SECTION_TITLE,
    fontSize: 16,
    marginTop: 8,
  },
  row: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    backgroundColor: '#FFFFFF',
  },
  rowTitle: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    paddingHorizontal: 16,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  button: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: MINIMAL_UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 14,
    fontWeight: '700',
  },
});
