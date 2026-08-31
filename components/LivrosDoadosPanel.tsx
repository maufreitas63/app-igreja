import { IsbnBarcodeScanner } from '@/components/IsbnBarcodeScanner';
import {
  createLivro,
  deleteLivro,
  listLivros,
  lookupLivroByIsbn,
  normalizeIsbnInput,
  type LivroRecord,
} from '@/lib/livrosApi';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

const EMPTY_FORM = {
  isbn: '',
  titulo: '',
  autor: '',
  editora: '',
  ano: '',
  capa: '',
};

export function LivrosDoadosPanel() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldsLocked, setFieldsLocked] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookupHint, setLookupHint] = useState<string | null>(null);
  const [rows, setRows] = useState<LivroRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      setRows(await listLivros());
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error instanceof Error ? error.message : 'Não foi possível listar os livros.',
      });
      setRows([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const patchForm = (partial: Partial<typeof EMPTY_FORM>) => {
    setForm((current) => ({ ...current, ...partial }));
  };

  const runIsbnLookup = async (rawIsbn: string) => {
    const isbn = normalizeIsbnInput(rawIsbn);
    if (isbn.length < 10) {
      setFieldsLocked(false);
      setLookupHint('Informe um ISBN com 10 ou 13 dígitos, ou preencha o livro à mão.');
      return;
    }

    setLookingUp(true);
    setFieldsLocked(true);
    setLookupHint('Consultando o catálogo pelo ISBN…');

    const result = await lookupLivroByIsbn(isbn);

    if (result.found) {
      setForm({
        isbn: result.isbn || isbn,
        titulo: result.titulo,
        autor: result.autor,
        editora: result.editora,
        ano: result.ano,
        capa: result.capa,
      });
      setFieldsLocked(false);
      setLookupHint(result.message);
    } else {
      setFieldsLocked(false);
      patchForm({ isbn });
      setLookupHint(result.message);
    }

    setLookingUp(false);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) {
      Toast.show({ type: 'error', text1: 'Informe o título do livro.' });
      return;
    }

    setSaving(true);
    const result = await createLivro({
      isbn: form.isbn,
      titulo: form.titulo,
      autor: form.autor,
      editora: form.editora,
      ano: form.ano,
      capa: form.capa,
    });
    setSaving(false);

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: result.message,
    });

    if (result.success) {
      setForm(EMPTY_FORM);
      setLookupHint(null);
      await loadList();
    }
  };

  const handleDelete = (livro: LivroRecord) => {
    Alert.alert('Remover livro', `Excluir “${livro.titulo}” do acervo?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const result = await deleteLivro(livro.id);
            Toast.show({
              type: result.success ? 'success' : 'error',
              text1: result.message,
            });
            if (result.success) {
              await loadList();
            }
          })();
        },
      },
    ]);
  };

  const catalogDisabled = fieldsLocked || lookingUp;

  return (
    <View style={styles.root}>
      <Text style={styles.lead}>
        Toque em Bipar para ler o código de barras do ISBN na contracapa, ou digite os dígitos.
        Se o catálogo não achar o livro, cadastre à mão — o fluxo de doação não para.
      </Text>

      <View style={styles.isbnRow}>
        <TextInput
          value={form.isbn}
          onChangeText={(isbn) => {
            patchForm({ isbn });
            const digits = normalizeIsbnInput(isbn);
            if (digits.length === 13) {
              void runIsbnLookup(digits);
            }
          }}
          onSubmitEditing={() => void runIsbnLookup(form.isbn)}
          placeholder="ISBN (bipar ou digitar)"
          placeholderTextColor={MINIMAL_UI.textMuted}
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!lookingUp}
          style={[styles.input, styles.isbnInput]}
        />
        <TouchableOpacity
          style={[styles.scanButton, lookingUp && styles.buttonDisabled]}
          onPress={() => setScannerOpen(true)}
          disabled={lookingUp}
          accessibilityLabel="Bipar código de barras do ISBN"
        >
          <FontAwesome name="barcode" size={14} color={MINIMAL_UI.text} />
          <Text style={styles.scanButtonText}>Bipar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.searchButton, lookingUp && styles.buttonDisabled]}
          onPress={() => void runIsbnLookup(form.isbn)}
          disabled={lookingUp}
          accessibilityLabel="Buscar livro pelo ISBN"
        >
          {lookingUp ? (
            <ActivityIndicator color={MINIMAL_UI.onDark} size="small" />
          ) : (
            <FontAwesome name="search" size={14} color={MINIMAL_UI.onDark} />
          )}
          <Text style={styles.searchButtonText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      <IsbnBarcodeScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onIsbn={(isbn) => {
          setScannerOpen(false);
          patchForm({ isbn });
          void runIsbnLookup(isbn);
        }}
      />

      {lookupHint ? <Text style={styles.hint}>{lookupHint}</Text> : null}

      <Text style={styles.label}>Título</Text>
      <TextInput
        value={form.titulo}
        onChangeText={(titulo) => patchForm({ titulo })}
        placeholder="Título"
        placeholderTextColor={MINIMAL_UI.textMuted}
        editable={!catalogDisabled}
        style={[styles.input, catalogDisabled && styles.inputLocked]}
      />

      <Text style={styles.label}>Autor</Text>
      <TextInput
        value={form.autor}
        onChangeText={(autor) => patchForm({ autor })}
        placeholder="Autor"
        placeholderTextColor={MINIMAL_UI.textMuted}
        editable={!catalogDisabled}
        style={[styles.input, catalogDisabled && styles.inputLocked]}
      />

      <Text style={styles.label}>Editora</Text>
      <TextInput
        value={form.editora}
        onChangeText={(editora) => patchForm({ editora })}
        placeholder="Editora"
        placeholderTextColor={MINIMAL_UI.textMuted}
        editable={!catalogDisabled}
        style={[styles.input, catalogDisabled && styles.inputLocked]}
      />

      <Text style={styles.label}>Ano</Text>
      <TextInput
        value={form.ano}
        onChangeText={(ano) => patchForm({ ano })}
        placeholder="Ano"
        placeholderTextColor={MINIMAL_UI.textMuted}
        keyboardType="numeric"
        editable={!catalogDisabled}
        style={[styles.input, catalogDisabled && styles.inputLocked]}
      />

      <Text style={styles.label}>Capa (URL)</Text>
      <TextInput
        value={form.capa}
        onChangeText={(capa) => patchForm({ capa })}
        placeholder="https://…"
        placeholderTextColor={MINIMAL_UI.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!catalogDisabled}
        style={[styles.input, catalogDisabled && styles.inputLocked]}
      />

      {form.capa.trim() ? (
        <Image source={{ uri: form.capa.trim() }} style={styles.cover} resizeMode="contain" />
      ) : null}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.buttonDisabled]}
        onPress={() => void handleSave()}
        disabled={saving || lookingUp}
      >
        {saving ? (
          <ActivityIndicator color={MINIMAL_UI.onDark} />
        ) : (
          <Text style={styles.saveButtonText}>Salvar no acervo</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.listTitle}>Acervo desta igreja</Text>
      {loadingList ? (
        <ActivityIndicator color={MINIMAL_UI.accent} style={styles.listLoader} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>Nenhum livro cadastrado ainda.</Text>
      ) : (
        rows.map((livro) => (
          <View key={livro.id} style={styles.bookRow}>
            {livro.capa ? (
              <Image source={{ uri: livro.capa }} style={styles.bookThumb} />
            ) : (
              <View style={[styles.bookThumb, styles.bookThumbEmpty]}>
                <FontAwesome name="book" size={16} color={MINIMAL_UI.textMuted} />
              </View>
            )}
            <View style={styles.bookMeta}>
              <Text style={styles.bookTitle} numberOfLines={2}>
                {livro.titulo}
              </Text>
              <Text style={styles.bookSub} numberOfLines={1}>
                {[livro.autor, livro.editora, livro.ano].filter(Boolean).join(' · ') || '—'}
              </Text>
              {livro.isbn ? <Text style={styles.bookIsbn}>ISBN {livro.isbn}</Text> : null}
            </View>
            <TouchableOpacity
              accessibilityLabel={`Remover ${livro.titulo}`}
              onPress={() => handleDelete(livro)}
              style={styles.deleteButton}
            >
              <FontAwesome name="trash-o" size={16} color="#DC2626" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 8,
    paddingBottom: 24,
  },
  lead: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  isbnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  isbnInput: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 140,
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
  inputLocked: {
    opacity: 0.55,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  label: {
    marginTop: 6,
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    minWidth: 88,
    justifyContent: 'center',
  },
  scanButtonText: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
    fontSize: 14,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: MINIMAL_UI.blueDark,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    minWidth: 96,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
    fontSize: 14,
  },
  cover: {
    width: 96,
    height: 140,
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: MINIMAL_UI.rowHover,
    marginTop: 4,
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: MINIMAL_UI.blueDark,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '800',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  listTitle: {
    marginTop: 20,
    color: MINIMAL_UI.text,
    fontSize: 16,
    fontWeight: '800',
  },
  listLoader: {
    marginTop: 12,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  bookThumb: {
    width: 40,
    height: 56,
    borderRadius: 4,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  bookThumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookMeta: {
    flex: 1,
    minWidth: 0,
  },
  bookTitle: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
    fontSize: 14,
  },
  bookSub: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  bookIsbn: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
});
