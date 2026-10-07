import { AliancaIndicatePartnerSection } from '@/components/alianca/AliancaIndicatePartnerSection';
import { AliancaIndicationQrSection } from '@/components/alianca/AliancaIndicationQrSection';
import { KnowledgeRouteInfo } from '@/components/knowledge/KnowledgeRouteInfo';
import {
  getAliancaAdminStatement,
  settleAliancaPayoutAdmin,
} from '@/lib/alianca/aliancaApi';
import {
  formatAliancaCents,
  formatAliancaDate,
  type AliancaAdminStatement,
} from '@/lib/alianca/types';
import { withFailClosedReturn } from '@/lib/failClosedNavigation';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { confirmDialog } from '@/lib/confirmDialog';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

function aliancaPayoutStatusText(
  status: string,
  paidAt: string | null,
  dueAt: string | null
): string {
  if (status === 'Abatido') return `Abatido na fatura em ${formatAliancaDate(paidAt)}`;
  if (status === 'Creditado') return 'Cashback disponível na próxima fatura';
  if (status === 'Pago') return `Pago em ${formatAliancaDate(paidAt)} (modelo anterior)`;
  return `A pagar até ${formatAliancaDate(dueAt)} (modelo anterior)`;
}

export function AliancaAdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statement, setStatement] = useState<AliancaAdminStatement | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);

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
      `Marcar como paga a oferta antiga para ${label}? O cashback novo de 10% abate sozinho na fatura.`,
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
      <AliancaIndicationQrSection />

      <View style={styles.statementHeader}>
        <TouchableOpacity
          style={styles.statementToggle}
          onPress={() => setStatementOpen((open) => !open)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ expanded: statementOpen }}
          accessibilityLabel={
            statementOpen
              ? 'Recolher demonstrativo da Aliança'
              : 'Abrir demonstrativo da Aliança'
          }
        >
          <Text style={styles.title}>
            {statementOpen ? '▾' : '▸'} Aliança Conecta Reino
          </Text>
        </TouchableOpacity>
        <KnowledgeRouteInfo
          routeKey={KNOWLEDGE_ROUTE.alianca}
          accessibilityLabel="Como funciona o cashback por indicação de novas igrejas"
        />
      </View>
      {statementOpen ? (
        <>
      <Text style={styles.hint}>
        10% perpétuo de cashback/desconto sobre o pacote assinado pela igreja indicada,
        condicionado à atividade de ambas as igrejas, limitado a 100% de desconto na fatura
        da igreja que indicou.
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
              <Text style={styles.kpiLabel}>Cashback a abater</Text>
              <Text style={styles.kpiValue}>{formatAliancaCents(statement.payout_pending_cents)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Descontos na fatura</Text>
              <Text style={styles.kpiValue}>{formatAliancaCents(statement.payout_paid_cents)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Receita após descontos</Text>
              <Text style={styles.kpiValue}>{formatAliancaCents(statement.net_realized_cents)}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            Com o cashback ainda em aberto, a receita fica{' '}
            {formatAliancaCents(statement.net_after_pending_cents)}.
          </Text>

          <Text style={styles.section}>Descontos</Text>
          {statement.payouts.length === 0 ? (
            <Text style={styles.empty}>Nenhum cashback gerado ainda.</Text>
          ) : (
            statement.payouts.map((row) => (
              <View key={row.id} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {row.mae_name} ← {row.filha_name}
                </Text>
                <Text style={styles.meta}>
                  {formatAliancaCents(row.reward_amount_cents)} sobre{' '}
                  {formatAliancaCents(row.gross_amount_cents)} · {row.status_global}
                </Text>
                <Text style={styles.meta}>{aliancaPayoutStatusText(row.status, row.paid_at, row.due_at)}</Text>
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
        </>
      ) : null}

      <AliancaIndicatePartnerSection />

      <TouchableOpacity
        style={styles.indicadosLink}
        onPress={() =>
          router.push({
            pathname: '/alianca-indicados',
            params: withFailClosedReturn(),
          } as Href)
        }
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Abrir lista de indicados"
      >
        <Text style={styles.indicadosLinkText}>Indicados</Text>
        <Text style={styles.indicadosLinkHint}>Funil Kanban exclusivo do Super Administrador</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    paddingBottom: 24,
    gap: 8,
  },
  statementHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  statementToggle: {
    flexShrink: 1,
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
  indicadosLink: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    gap: 2,
  },
  indicadosLinkText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '800',
  },
  indicadosLinkHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
  },
});
