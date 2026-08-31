import {
  emprestimoCountdownLabel,
  EMPRESTIMO_STATUS_LABEL,
  formatEmprestimoDate,
  listMyEmprestimosLivros,
  type EmprestimoLivro,
} from '@/lib/emprestimosLivrosApi';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

type Props = {
  onBack: () => void;
};

export function MeusLivrosRetiradosPanel({ onBack }: Props) {
  const [rows, setRows] = useState<EmprestimoLivro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listMyEmprestimosLivros());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar seus livros.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  return (
    <View style={styles.root}>
      <Pressable
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Voltar ao perfil"
      >
        <FontAwesome name="chevron-left" size={14} color={MINIMAL_UI.blueDark} />
        <Text style={styles.backButtonText}>Perfil</Text>
      </Pressable>
      <Text style={styles.title}>Meus Livros Retirados</Text>
      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>Você não tem livros emprestados no momento.</Text>
      ) : (
        rows.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.bookTitle}>{item.titulo}</Text>
            <Text style={styles.meta}>
              Retirada {formatEmprestimoDate(item.dataRetirada)} · devolver até{' '}
              {formatEmprestimoDate(item.dataPrevistaEntrega)}
            </Text>
            <Text style={[styles.countdown, item.status === 'atrasado' && styles.countdownLate]}>
              {emprestimoCountdownLabel(item)} · {EMPRESTIMO_STATUS_LABEL[item.status]}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  backButtonText: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
    fontSize: 14,
  },
  title: {
    color: MINIMAL_UI.text,
    fontSize: 20,
    fontWeight: '800',
  },
  loader: {
    marginTop: 24,
  },
  error: {
    color: '#DC2626',
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  bookTitle: {
    color: MINIMAL_UI.text,
    fontWeight: '800',
    fontSize: 15,
  },
  meta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  countdown: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
    marginTop: 4,
  },
  countdownLate: {
    color: '#DC2626',
  },
});
