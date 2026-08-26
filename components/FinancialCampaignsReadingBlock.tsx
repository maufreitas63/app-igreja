import {
  fetchCampaignFinancialSummary,
  formatCampaignBrl,
  type CampaignFinancialSummary,
} from '@/lib/campaignProjectsApi';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Linha de leitura: receita ordinária vs campanhas/projetos. */
export function FinancialCampaignsReadingBlock() {
  const [summary, setSummary] = useState<CampaignFinancialSummary | null>(null);

  useEffect(() => {
    let mounted = true;

    void fetchCampaignFinancialSummary().then((next) => {
      if (mounted) {
        setSummary(next);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!summary || (summary.ordinaryRevenue <= 0 && summary.campaignRevenue <= 0)) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Receita ordinária × campanhas</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Dízimos e ofertas (ordinário)</Text>
        <Text style={styles.value}>{formatCampaignBrl(summary.ordinaryRevenue)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Campanhas e projetos</Text>
        <Text style={[styles.value, styles.campaign]}>{formatCampaignBrl(summary.campaignRevenue)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(30, 58, 138, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 10,
  },
  title: {
    color: '#1E3A5F',
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: '#334155',
    fontSize: 12,
    flex: 1,
  },
  value: {
    color: '#1E3A5F',
    fontWeight: '800',
    fontSize: 12,
  },
  campaign: {
    color: '#1D4ED8',
  },
});
