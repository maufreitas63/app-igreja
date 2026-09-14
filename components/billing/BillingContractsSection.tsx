import { CenteredCloseDialog } from '@/components/minimal/CenteredCloseDialog';
import type { BillingSaasContract } from '@/lib/billing/types';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function formatPtDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function eventLabel(eventType: string) {
  return eventType === 'renovacao' ? 'Renovação' : 'Contratação';
}

function sequenceLabel(value: number) {
  return `nº ${String(value).padStart(3, '0')}`;
}

function ContractParagraph({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const isTitle = trimmed.startsWith('CONTRATO DE LICENCIAMENTO');
  const isClause = trimmed.startsWith('CLÁUSULA ');
  const isMeta = trimmed.startsWith('Contrato nº') || trimmed.startsWith('Data da aceitação');

  return (
    <Text
      style={[
        styles.paragraph,
        isTitle && styles.contractTitle,
        isClause && styles.clauseTitle,
        isMeta && styles.metaLine,
      ]}
    >
      {trimmed}
    </Text>
  );
}

type Props = {
  contracts: BillingSaasContract[];
};

export function BillingContractsSection({ contracts }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = useMemo(
    () => contracts.find((item) => item.id === openId) ?? null,
    [contracts, openId]
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Gerenciamento de Contratos</Text>
      <Text style={styles.sectionHint}>
        Histórico sequencial de cada contratação e renovação do pacote SaaS, com o instrumento
        de licenciamento preenchido na aceitação eletrônica.
      </Text>

      {contracts.length === 0 ? (
        <Text style={styles.empty}>
          Ainda não há contrato finalizado. O instrumento é gravado quando a contratação ou a
          renovação trimestral é confirmada.
        </Text>
      ) : (
        <View style={styles.list}>
          {contracts.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => setOpenId(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir contrato ${sequenceLabel(item.sequenceNumber)} ${item.planName}`}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>
                  Contrato {sequenceLabel(item.sequenceNumber)} · {eventLabel(item.eventType)}
                </Text>
                <Text style={styles.rowPlan}>
                  Plano {item.planName}
                  {item.planType ? ` — ${item.planType}` : ''}
                </Text>
                <Text style={styles.rowMeta}>
                  Ciclo {formatPtDate(item.periodStart)} a {formatPtDate(item.periodEnd)}
                </Text>
              </View>
              <Text style={styles.rowOpen}>Abrir</Text>
            </Pressable>
          ))}
        </View>
      )}

      <CenteredCloseDialog
        visible={selected != null}
        onClose={() => setOpenId(null)}
        title={
          selected
            ? `Contrato ${sequenceLabel(selected.sequenceNumber)}`
            : 'Contrato'
        }
        subtitle={
          selected
            ? `${eventLabel(selected.eventType)} · ${selected.planName}`
            : null
        }
        accessibilityCloseLabel="Fechar contrato"
      >
        {selected ? (
          <View style={styles.contractBody}>
            {selected.body.split(/\n+/).map((block, index) => (
              <ContractParagraph key={`${selected.id}-${index}`} text={block} />
            ))}
          </View>
        ) : null}
      </CenteredCloseDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.border,
    gap: 8,
  },
  sectionTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 8,
  },
  list: {
    gap: 8,
    marginTop: 6,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowPressed: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '800',
  },
  rowPlan: {
    color: MINIMAL_UI.blue,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  rowMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  rowOpen: {
    color: MINIMAL_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  contractBody: {
    gap: 10,
  },
  paragraph: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'justify',
  },
  contractTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
  clauseTitle: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '800',
    textAlign: 'left',
    marginTop: 6,
  },
  metaLine: {
    color: MINIMAL_UI.blue,
    fontWeight: '600',
    textAlign: 'left',
  },
});
