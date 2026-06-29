import {
  formatSupportSuggestionDateTime,
  formatSupportSuggestionHistoricoMeta,
  formatSupportSuggestionHistoricoTitle,
  parseSupportSuggestionReportRow,
  type SupportSuggestionReportRow,
} from '@/lib/maintenanceSupportSuggestionsReport';
import type { MaintenanceReportResult } from '@/lib/maintenanceReportsApi';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  result: MaintenanceReportResult;
};

const ACCENT = '#C084FC';

function SupportSuggestionCard({ row }: { row: SupportSuggestionReportRow }) {
  const hasTreatment =
    Boolean(row.acao_desenvolvedor?.trim())
    || Boolean(row.orientacoes?.trim())
    || Boolean(row.previsao_conclusao?.trim());

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestMain}>
          <Text style={styles.requestTitle}>{row.tipo}</Text>
          <Text style={styles.requestMeta}>
            {row.solicitante}
            {row.telefone ? ` · ${row.telefone}` : ''}
          </Text>
          {row.tema ? (
            <Text style={styles.requestTheme}>{row.tema}</Text>
          ) : null}
          <Text style={styles.requestMeta}>
            Aberta em {formatSupportSuggestionDateTime(row.abertura_em)}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{row.status}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Descrição detalhada</Text>
      <Text style={styles.description}>{row.descricao}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaChip}>
          WhatsApp {row.whatsapp_autorizado ? 'autorizado' : 'não autorizado'}
        </Text>
        <Text style={styles.metaChip}>
          Notificação app {row.notificar_app ? 'ativa' : 'inativa'}
        </Text>
      </View>

      <View style={styles.datesRow}>
        <Text style={styles.dateText}>
          Atualizada em {formatSupportSuggestionDateTime(row.atualizado_em)}
        </Text>
        {row.respondido_em ? (
          <Text style={styles.dateText}>
            Resposta em {formatSupportSuggestionDateTime(row.respondido_em)}
          </Text>
        ) : null}
      </View>

      {row.anexos > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Anexos ({row.anexos})</Text>
          <Text style={styles.attachmentsText}>
            {row.anexos_nomes.length > 0 ? row.anexos_nomes.join(', ') : `${row.anexos} arquivo(s)`}
          </Text>
        </View>
      ) : null}

      {hasTreatment ? (
        <View style={styles.treatmentBlock}>
          <Text style={styles.sectionTitle}>Tratamento pelo desenvolvedor</Text>
          {row.acao_desenvolvedor?.trim() ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.sectionLabel}>Ação tomada ou planejada</Text>
              <Text style={styles.fieldValue}>{row.acao_desenvolvedor}</Text>
            </View>
          ) : null}
          {row.previsao_conclusao?.trim() ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.sectionLabel}>Previsão de implementação/conclusão</Text>
              <Text style={styles.fieldValue}>{row.previsao_conclusao}</Text>
            </View>
          ) : null}
          {row.orientacoes?.trim() ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.sectionLabel}>Orientações detalhadas ao usuário</Text>
              <Text style={styles.fieldValue}>{row.orientacoes}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Histórico cronológico</Text>
        {row.historico.length > 0 ? (
          row.historico.map((entry, index) => (
            <View key={`${entry.data_hora}-${index}`} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineBody}>
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineTitle}>
                    {formatSupportSuggestionHistoricoTitle(entry)}
                  </Text>
                  <Text style={styles.timelineDate}>
                    {formatSupportSuggestionDateTime(entry.data_hora)}
                  </Text>
                </View>
                <Text style={styles.timelineMeta}>
                  {formatSupportSuggestionHistoricoMeta(entry)}
                </Text>
                {entry.mensagem.trim() ? (
                  <Text style={styles.timelineMessage}>{entry.mensagem}</Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Nenhuma interação registrada.</Text>
        )}
      </View>
    </View>
  );
}

export function SupportSuggestionsReportView({ result }: Props) {
  const rows = useMemo(
    () => result.rows.map((row) => parseSupportSuggestionReportRow(row)),
    [result.rows]
  );

  return (
    <View style={styles.resultsBox}>
      <Text style={styles.resultsTitle}>
        {rows.length.toLocaleString('pt-BR')} solicitação(ões)
        {result.generatedAt
          ? ` — gerado em ${formatSupportSuggestionDateTime(result.generatedAt)}`
          : ''}
      </Text>

      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.listScroll}>
        <View style={styles.listContent}>
          {rows.map((row, index) => (
            <SupportSuggestionCard key={`${row.abertura_em}-${row.solicitante}-${index}`} row={row} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  resultsBox: {
    gap: 8,
  },
  resultsTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  listScroll: {
    maxHeight: 520,
  },
  listContent: {
    gap: 10,
    paddingBottom: 4,
  },
  requestCard: {
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.28)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 12,
    gap: 8,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  requestMain: {
    flex: 1,
    gap: 2,
  },
  requestTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  requestMeta: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  requestTheme: {
    color: '#C4B5FD',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.45)',
    borderRadius: 999,
    backgroundColor: 'rgba(192, 132, 252, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: '#E9D5FF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#E9D5FF',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  description: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 15,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  datesRow: {
    gap: 2,
  },
  dateText: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
  },
  sectionBlock: {
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    paddingTop: 8,
  },
  treatmentBlock: {
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.22)',
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    padding: 10,
  },
  fieldBlock: {
    gap: 2,
  },
  fieldValue: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 17,
  },
  attachmentsText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 6,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: ACCENT,
    marginTop: 5,
  },
  timelineBody: {
    flex: 1,
    gap: 2,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  timelineTitle: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  timelineDate: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 14,
  },
  timelineMeta: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 14,
  },
  timelineMessage: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
