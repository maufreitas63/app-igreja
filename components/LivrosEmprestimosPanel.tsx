import {
  cancelarReservaLivro,
  confirmarRetiradaReserva,
  createEmprestimoLivro,
  devolverEmprestimoLivro,
  emprestimoCountdownLabel,
  EMPRESTIMO_RENOVACAO_DIAS,
  EMPRESTIMO_STATUS_LABEL,
  formatEmprestimoDate,
  listEmprestimosLivrosStaff,
  renovarEmprestimoLivro,
  searchProfilesForEmprestimo,
  type EmprestimoLivro,
} from '@/lib/emprestimosLivrosApi';
import { confirmDialog } from '@/lib/confirmDialog';
import { listLivros, type LivroRecord } from '@/lib/livrosApi';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { ProfileSearchRow } from '@/lib/profileSearchRow';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  mode: 'ativos' | 'historico';
};

export function LivrosEmprestimosPanel({ mode }: Props) {
  const [livros, setLivros] = useState<LivroRecord[]>([]);
  const [rows, setRows] = useState<EmprestimoLivro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [livroId, setLivroId] = useState<string | null>(null);
  const [livroQuery, setLivroQuery] = useState('');
  const [tituloExterno, setTituloExterno] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberHits, setMemberHits] = useState<ProfileSearchRow[]>([]);
  const [selectedMember, setSelectedMember] = useState<ProfileSearchRow | null>(null);
  const [nomeExterno, setNomeExterno] = useState('');

  const borrowedIds = useMemo(
    () => new Set(rows.map((row) => row.livroId).filter((id): id is string => Boolean(id))),
    [rows]
  );

  const availableLivros = useMemo(() => {
    const q = livroQuery.trim().toLowerCase();
    return livros.filter((livro) => {
      if (borrowedIds.has(livro.id)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        livro.titulo.toLowerCase().includes(q)
        || (livro.autor ?? '').toLowerCase().includes(q)
        || (livro.isbn ?? '').toLowerCase().includes(q)
      );
    });
  }, [borrowedIds, livroQuery, livros]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [acervo, emprestimos] = await Promise.all([
        listLivros().catch(() => [] as LivroRecord[]),
        listEmprestimosLivrosStaff(mode),
      ]);
      setLivros(acervo);
      setRows(emprestimos);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error instanceof Error ? error.message : 'Não foi possível carregar os empréstimos.',
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const q = memberQuery.trim();
    if (q.length < 2) {
      setMemberHits([]);
      return;
    }
    const handle = setTimeout(() => {
      void searchProfilesForEmprestimo(q)
        .then((rows) => {
          const needle = q.toLowerCase();
          const digits = q.replace(/\D/g, '');
          setMemberHits(
            rows.filter((hit) => {
              if (hit.fullName.toLowerCase().includes(needle)) {
                return true;
              }
              if (digits.length >= 2) {
                return (hit.phone ?? '').replace(/\D/g, '').includes(digits);
              }
              return false;
            })
          );
        })
        .catch(() => setMemberHits([]));
    }, 280);
    return () => clearTimeout(handle);
  }, [memberQuery]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const result = await createEmprestimoLivro({
        livroId,
        tituloExterno: livroId ? null : tituloExterno,
        userId: selectedMember?.id ?? null,
        nomeExterno: selectedMember ? null : nomeExterno,
      });
      Toast.show({ type: result.success ? 'success' : 'error', text1: result.message });
      if (result.success) {
        setLivroId(null);
        setLivroQuery('');
        setTituloExterno('');
        setSelectedMember(null);
        setMemberQuery('');
        setNomeExterno('');
        await reload();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error instanceof Error ? error.message : 'Falha ao registrar empréstimo.',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmAction = async (
    item: EmprestimoLivro,
    kind: 'devolver' | 'renovar' | 'confirmar' | 'cancelar'
  ) => {
    const copy = {
      devolver: {
        title: 'Registrar devolução',
        message: `Confirmar a devolução de «${item.titulo}»? O item volta ao acervo.`,
        confirm: 'Devolver',
      },
      renovar: {
        title: 'Renovar prazo',
        message: `Somar mais ${EMPRESTIMO_RENOVACAO_DIAS} dias ao prazo de «${item.titulo}»?`,
        confirm: 'Renovar',
      },
      confirmar: {
        title: 'Confirmar retirada',
        message: `Registrar que «${item.titulo}» foi retirado hoje? O empréstimo passa a contar o prazo de devolução.`,
        confirm: 'Confirmar',
      },
      cancelar: {
        title: 'Cancelar reserva',
        message: `Cancelar a reserva de «${item.titulo}»? O livro volta ao acervo.`,
        confirm: 'Cancelar reserva',
      },
    }[kind];

    const confirmed = await confirmDialog(
      copy.title,
      copy.message,
      copy.confirm,
      'Voltar',
      { destructive: kind === 'cancelar' }
    );
    if (!confirmed) {
      return;
    }

    try {
      const result =
        kind === 'devolver'
          ? await devolverEmprestimoLivro(item.id)
          : kind === 'renovar'
            ? await renovarEmprestimoLivro(item.id)
            : kind === 'confirmar'
              ? await confirmarRetiradaReserva(item.id)
              : await cancelarReservaLivro(item.id);
      Toast.show({ type: result.success ? 'success' : 'error', text1: result.message });
      if (result.success) {
        await reload();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error instanceof Error ? error.message : 'Não foi possível concluir a ação.',
      });
    }
  };

  const handleWhatsAppPrazo = (item: EmprestimoLivro) => {
    const due = formatEmprestimoDate(item.dataPrevistaEntrega);
    const message =
      `Olá, ${item.nomeRetirante}! O livro «${item.titulo}» tem devolução prevista para ${due}. ` +
      `Você vai devolver no prazo ou pretende estender o empréstimo por mais ${EMPRESTIMO_RENOVACAO_DIAS} dias?`;
    const opened = openWhatsAppLikeBirthdaysWithText(item.phone, message);
    if (!opened) {
      Toast.show({ type: 'error', text1: 'Telefone indisponível para WhatsApp.' });
    }
  };

  return (
    <View style={styles.root}>
      {mode === 'ativos' ? (
        <View style={styles.form}>
          <Text style={styles.sectionLabel}>Livro</Text>
          <TextInput
            value={livroQuery}
            onChangeText={setLivroQuery}
            placeholder="Buscar no acervo (título, autor ou ISBN)"
            placeholderTextColor={MINIMAL_UI.textMuted}
            style={styles.input}
          />
          {availableLivros.length ? (
            <View style={styles.chipWrap}>
              {availableLivros.slice(0, 20).map((livro) => {
                const selected = livroId === livro.id;
                return (
                  <TouchableOpacity
                    key={livro.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => {
                      setLivroId(selected ? null : livro.id);
                      if (!selected) {
                        setTituloExterno('');
                        setLivroQuery(livro.titulo);
                      }
                    }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
                      {livro.titulo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.hint}>
              {livros.some((livro) => !borrowedIds.has(livro.id))
                ? 'Nenhum título corresponde à busca.'
                : 'Nenhum título livre no acervo — use um livro externo.'}
            </Text>
          )}
          <TextInput
            value={tituloExterno}
            onChangeText={(value) => {
              setTituloExterno(value);
              if (value.trim()) {
                setLivroId(null);
              }
            }}
            placeholder="Ou título de livro externo"
            placeholderTextColor={MINIMAL_UI.textMuted}
            style={styles.input}
          />

          <Text style={styles.sectionLabel}>Retirante</Text>
          {selectedMember ? (
            <View style={styles.selectedMember}>
              <Text
                style={[
                  styles.selectedMemberName,
                  selectedMember.desligado && styles.memberDesligado,
                ]}
              >
                {selectedMember.fullName}
                {selectedMember.desligado ? ' (desligado)' : ''}
              </Text>
              <TouchableOpacity onPress={() => setSelectedMember(null)}>
                <Text style={styles.clearLink}>Trocar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                value={memberQuery}
                onChangeText={setMemberQuery}
                placeholder="Buscar membro (nome ou telefone)"
                placeholderTextColor={MINIMAL_UI.textMuted}
                style={styles.input}
              />
              {memberHits.map((hit) => (
                <TouchableOpacity
                  key={hit.id}
                  style={styles.hitRow}
                  onPress={() => {
                    setSelectedMember(hit);
                    setMemberQuery('');
                    setMemberHits([]);
                    setNomeExterno('');
                  }}
                >
                  <Text style={[styles.hitName, hit.desligado && styles.memberDesligado]}>
                    {hit.fullName}
                    {hit.desligado ? ' (desligado)' : ''}
                  </Text>
                  {hit.phone ? <Text style={styles.hitMeta}>{hit.phone}</Text> : null}
                </TouchableOpacity>
              ))}
              <TextInput
                value={nomeExterno}
                onChangeText={setNomeExterno}
                placeholder="Ou nome de retirante sem cadastro"
                placeholderTextColor={MINIMAL_UI.textMuted}
                style={styles.input}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabled]}
            onPress={() => void handleCreate()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={MINIMAL_UI.onDark} />
            ) : (
              <Text style={styles.primaryButtonText}>Registrar empréstimo (30 dias)</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.lead}>Empréstimos devolvidos — rastreabilidade da Secretaria.</Text>
      )}

      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>
          {mode === 'historico' ? 'Nenhum empréstimo encerrado ainda.' : 'Nenhum empréstimo ativo.'}
        </Text>
      ) : (
        rows.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.titulo}
              </Text>
              <Text
                style={[
                  styles.badge,
                  item.status === 'atrasado' && styles.badgeLate,
                  item.status === 'devolvido' && styles.badgeDone,
                  item.status === 'reservado' && styles.badgeReserved,
                  item.status === 'cancelado' && styles.badgeDone,
                ]}
              >
                {EMPRESTIMO_STATUS_LABEL[item.status]}
              </Text>
            </View>
            <Text
              style={[styles.cardMeta, item.retiranteDesligado && styles.memberDesligado]}
            >
              {item.nomeRetirante}
              {item.retiranteDesligado ? ' (desligado)' : ''}
            </Text>
            <Text style={styles.cardMeta}>
              {item.status === 'reservado'
                ? `Retirada prevista ${formatEmprestimoDate(item.dataPrevistaRetirada || item.dataRetirada)} · retorno ${formatEmprestimoDate(item.dataPrevistaEntrega)}`
                : `Retirada ${formatEmprestimoDate(item.dataRetirada)} · entrega ${formatEmprestimoDate(item.dataPrevistaEntrega)}`}
            </Text>
            {item.dataDevolucaoReal ? (
              <Text style={styles.cardMeta}>
                Devolvido em {formatEmprestimoDate(item.dataDevolucaoReal)}
              </Text>
            ) : (
              <Text
                style={[
                  styles.countdown,
                  item.status === 'atrasado' && styles.countdownLate,
                ]}
              >
                {emprestimoCountdownLabel(item)}
              </Text>
            )}
            {mode === 'ativos' ? (
              item.status === 'reservado' ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => void confirmAction(item, 'cancelar')}
                  >
                    <Text style={styles.secondaryButtonText}>Cancelar reserva</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.returnButton}
                    onPress={() => void confirmAction(item, 'confirmar')}
                  >
                    <Text style={styles.returnButtonText}>Confirmar retirada</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.whatsappButton}
                    onPress={() => handleWhatsAppPrazo(item)}
                    accessibilityLabel={`WhatsApp sobre o prazo de ${item.titulo}`}
                  >
                    <FontAwesome name="whatsapp" size={16} color="#16A34A" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => void confirmAction(item, 'renovar')}
                  >
                    <FontAwesome name="calendar-plus-o" size={13} color={MINIMAL_UI.blueDark} />
                    <Text style={styles.secondaryButtonText}>Renovar +{EMPRESTIMO_RENOVACAO_DIAS}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.returnButton}
                    onPress={() => void confirmAction(item, 'devolver')}
                  >
                    <Text style={styles.returnButtonText}>Registrar devolução</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 10,
    paddingBottom: 24,
  },
  lead: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    marginBottom: 4,
  },
  form: {
    gap: 8,
    marginBottom: 8,
  },
  sectionLabel: {
    marginTop: 6,
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
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
  chipSelected: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderColor: MINIMAL_UI.blueDark,
  },
  chipText: {
    color: MINIMAL_UI.text,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: MINIMAL_UI.onDark,
  },
  selectedMember: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedMemberName: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
    flex: 1,
  },
  clearLink: {
    color: MINIMAL_UI.accent,
    fontWeight: '700',
  },
  hitRow: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  hitName: {
    color: MINIMAL_UI.text,
    fontWeight: '600',
  },
  memberDesligado: {
    color: '#DC2626',
    fontWeight: '700',
  },
  hitMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 8,
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
  cardTitle: {
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
  badgeDone: {
    color: MINIMAL_UI.textMuted,
  },
  badgeReserved: {
    color: '#B45309',
  },
  cardMeta: {
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
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
    fontSize: 13,
  },
  whatsappButton: {
    width: 40,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
  },
  returnButton: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  returnButtonText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
    fontSize: 13,
  },
});
