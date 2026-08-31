import {
  addDaysIso,
  cancelarReservaLivro,
  emprestimoCountdownLabel,
  EMPRESTIMO_STATUS_LABEL,
  formatEmprestimoDate,
  listLivrosDisponiveisReserva,
  listMyEmprestimosLivros,
  reservarLivroAcervo,
  todayIsoLocal,
  type EmprestimoLivro,
} from '@/lib/emprestimosLivrosApi';
import type { LivroRecord } from '@/lib/livrosApi';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

type Props = {
  onBack: () => void;
};

const webDateProps = Platform.OS === 'web' ? ({ type: 'date' } as Record<string, unknown>) : {};

export function MeusLivrosRetiradosPanel({ onBack }: Props) {
  const [rows, setRows] = useState<EmprestimoLivro[]>([]);
  const [acervo, setAcervo] = useState<LivroRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [livroQuery, setLivroQuery] = useState('');
  const [livroId, setLivroId] = useState<string | null>(null);
  const [dataRetirada, setDataRetirada] = useState(todayIsoLocal);
  const [dataRetorno, setDataRetorno] = useState(() => addDaysIso(todayIsoLocal(), 30));

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, available] = await Promise.all([
        listMyEmprestimosLivros(),
        listLivrosDisponiveisReserva(),
      ]);
      setRows(mine);
      setAcervo(available);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar seus livros.');
      setRows([]);
      setAcervo([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const filteredAcervo = useMemo(() => {
    const q = livroQuery.trim().toLowerCase();
    if (!q) {
      return acervo;
    }
    return acervo.filter(
      (livro) =>
        livro.titulo.toLowerCase().includes(q)
        || (livro.autor ?? '').toLowerCase().includes(q)
    );
  }, [acervo, livroQuery]);

  const selectedLivro = acervo.find((livro) => livro.id === livroId) ?? null;

  const handlePickupChange = (value: string) => {
    setDataRetirada(value);
    setDataRetorno(addDaysIso(value, 30));
  };

  const handleReservar = async () => {
    if (!livroId) {
      Toast.show({ type: 'error', text1: 'Escolha um livro do acervo.' });
      return;
    }
    setSaving(true);
    try {
      const result = await reservarLivroAcervo({
        livroId,
        dataRetirada,
        dataRetorno,
      });
      Toast.show({ type: result.success ? 'success' : 'error', text1: result.message });
      if (result.success) {
        setLivroId(null);
        setLivroQuery('');
        setDataRetirada(todayIsoLocal());
        setDataRetorno(addDaysIso(todayIsoLocal(), 30));
        await reload();
      }
    } catch (reserveError) {
      Toast.show({
        type: 'error',
        text1: reserveError instanceof Error ? reserveError.message : 'Não foi possível reservar.',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmCancel = (item: EmprestimoLivro) => {
    Alert.alert('Cancelar reserva', `Cancelar a reserva de «${item.titulo}»?`, [
      { text: 'Manter', style: 'cancel' },
      {
        text: 'Cancelar reserva',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const result = await cancelarReservaLivro(item.id);
            Toast.show({ type: result.success ? 'success' : 'error', text1: result.message });
            if (result.success) {
              await reload();
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Cantinho da Leitura</Text>
      <View style={styles.body}>
      <Pressable
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Voltar ao perfil"
      >
        <FontAwesome name="chevron-left" size={14} color={MINIMAL_UI.blueDark} />
        <Text style={styles.backButtonText}>Perfil</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Reservar no acervo</Text>
        <TextInput
          value={livroQuery}
          onChangeText={setLivroQuery}
          placeholder="Buscar título ou autor"
          placeholderTextColor={MINIMAL_UI.textMuted}
          style={styles.input}
        />
        {selectedLivro ? (
          <View style={styles.selectedBook}>
            <Text style={styles.selectedBookTitle}>{selectedLivro.titulo}</Text>
            <TouchableOpacity
              onPress={() => {
                setLivroId(null);
                setLivroQuery('');
              }}
            >
              <Text style={styles.clearLink}>Trocar</Text>
            </TouchableOpacity>
          </View>
        ) : filteredAcervo.length ? (
          <View style={styles.chipWrap}>
            {filteredAcervo.slice(0, 16).map((livro) => (
              <TouchableOpacity
                key={livro.id}
                style={styles.chip}
                onPress={() => {
                  setLivroId(livro.id);
                  setLivroQuery(livro.titulo);
                }}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  {livro.titulo}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>
            {acervo.length ? 'Nenhum título corresponde à busca.' : 'Nenhum livro disponível para reserva agora.'}
          </Text>
        )}

        <View style={styles.datesRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Retirada prevista</Text>
            <TextInput
              value={dataRetirada}
              onChangeText={handlePickupChange}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={MINIMAL_UI.textMuted}
              style={styles.input}
              {...webDateProps}
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Devolução prevista</Text>
            <TextInput
              value={dataRetorno}
              onChangeText={setDataRetorno}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={MINIMAL_UI.textMuted}
              style={styles.input}
              {...webDateProps}
            />
          </View>
        </View>
        <Text style={styles.hint}>O prazo padrão é 30 dias após a retirada.</Text>
        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabled]}
          onPress={() => void handleReservar()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={MINIMAL_UI.onDark} />
          ) : (
            <Text style={styles.primaryButtonText}>Reservar livro</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, styles.listTitle]}>Meus títulos</Text>
        {loading ? (
          <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>Você não tem reservas nem livros emprestados no momento.</Text>
        ) : (
          rows.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.bookTitle}>{item.titulo}</Text>
                <Text
                  style={[
                    styles.badge,
                    item.status === 'atrasado' && styles.badgeLate,
                    item.status === 'reservado' && styles.badgeReserved,
                  ]}
                >
                  {EMPRESTIMO_STATUS_LABEL[item.status]}
                </Text>
              </View>
              {item.status === 'reservado' ? (
                <Text style={styles.meta}>
                  Retirada prevista {formatEmprestimoDate(item.dataPrevistaRetirada || item.dataRetirada)} ·
                  devolução {formatEmprestimoDate(item.dataPrevistaEntrega)}
                </Text>
              ) : (
                <Text style={styles.meta}>
                  Retirada {formatEmprestimoDate(item.dataRetirada)} · devolver até{' '}
                  {formatEmprestimoDate(item.dataPrevistaEntrega)}
                </Text>
              )}
              <Text style={[styles.countdown, item.status === 'atrasado' && styles.countdownLate]}>
                {emprestimoCountdownLabel(item)}
              </Text>
              {item.status === 'reservado' ? (
                <TouchableOpacity style={styles.cancelButton} onPress={() => confirmCancel(item)}>
                  <Text style={styles.cancelButtonText}>Cancelar reserva</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    minHeight: 0,
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
  title: MINIMAL_SECTION_TITLE,
  scroll: {
    gap: 10,
    paddingBottom: 32,
  },
  sectionLabel: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  listTitle: {
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    color: MINIMAL_UI.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: MINIMAL_UI.background,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  chipText: {
    color: MINIMAL_UI.text,
    fontSize: 12,
    fontWeight: '600',
  },
  selectedBook: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  selectedBookTitle: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
    flex: 1,
  },
  clearLink: {
    color: MINIMAL_UI.accent,
    fontWeight: '700',
  },
  datesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateField: {
    flex: 1,
    gap: 4,
  },
  dateLabel: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '800',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.6,
  },
  loader: {
    marginTop: 16,
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bookTitle: {
    flex: 1,
    color: MINIMAL_UI.text,
    fontWeight: '800',
    fontSize: 15,
  },
  badge: {
    color: MINIMAL_UI.blueDark,
    fontSize: 11,
    fontWeight: '800',
  },
  badgeLate: {
    color: '#DC2626',
  },
  badgeReserved: {
    color: '#B45309',
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
  cancelButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
    fontSize: 13,
  },
});
