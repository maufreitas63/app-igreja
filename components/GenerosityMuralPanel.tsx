import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SegmentChipRow } from '@/components/ui/SegmentChipRow';
import { confirmDialog } from '@/lib/confirmDialog';
import {
  completeGenerosityPost,
  createGenerosityPost,
  expressGenerosityInterest,
  GENEROSITY_CATEGORIA_LABEL,
  GENEROSITY_CATEGORIAS,
  GENEROSITY_STATUS_LABEL,
  GENEROSITY_TIPO_LABEL,
  listGenerosityPosts,
  listMyGenerosityPosts,
  pickGenerosityImage,
  type GenerosityCategoria,
  type GenerosityPost,
  type GenerosityTipo,
} from '@/lib/generosityMuralApi';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type FeedFilter = 'doacao' | 'pedido';

export function GenerosityMuralPanel() {
  const [filter, setFilter] = useState<FeedFilter>('doacao');
  const [posts, setPosts] = useState<GenerosityPost[]>([]);
  const [mine, setMine] = useState<GenerosityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<GenerosityTipo>('doacao');
  const [categoria, setCategoria] = useState<GenerosityCategoria>('outros');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [feed, own] = await Promise.all([
        listGenerosityPosts(filter),
        listMyGenerosityPosts(),
      ]);
      setPosts(feed);
      setMine(own);
    } catch (loadError) {
      setPosts([]);
      setMine([]);
      setError(
        loadError instanceof Error ? loadError.message : 'Não foi possível carregar o mural.'
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const resetForm = () => {
    setTipo('doacao');
    setCategoria('outros');
    setTitulo('');
    setDescricao('');
    setImagePreview(null);
    setShowForm(false);
  };

  const handlePickImage = async () => {
    try {
      const next = await pickGenerosityImage();
      if (next) {
        setImagePreview(next);
      }
    } catch (pickError) {
      Toast.show({
        type: 'error',
        text1: 'Foto',
        text2: pickError instanceof Error ? pickError.message : 'Não foi possível escolher a foto.',
      });
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const result = await createGenerosityPost({
        tipo,
        categoria,
        titulo,
        descricao,
        imageInput: imagePreview,
      });
      Toast.show({ type: 'success', text1: 'Mural de Generosidade', text2: result.message });
      resetForm();
      await load();
    } catch (saveError) {
      Toast.show({
        type: 'error',
        text1: 'Mural de Generosidade',
        text2: saveError instanceof Error ? saveError.message : 'Não foi possível enviar.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInterest = async (post: GenerosityPost) => {
    const label = post.tipo === 'doacao' ? 'Tenho interesse' : 'Posso ajudar';
    const confirmed = await confirmDialog(
      label,
      'Seu nome será enviado à liderança, sem expor telefone no mural. Continuar?',
      'Enviar',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    setBusyId(post.id);
    try {
      const result = await expressGenerosityInterest(post.id);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Mural de Generosidade',
        text2: result.message,
      });
      if (result.success) {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (post: GenerosityPost) => {
    const confirmed = await confirmDialog(
      'Marcar como resolvido',
      `Encerrar o anúncio "${post.titulo}"?`,
      'Encerrar',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    setBusyId(post.id);
    try {
      const result = await completeGenerosityPost(post.id);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Mural de Generosidade',
        text2: result.message,
      });
      if (result.success) {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const mineQueue = mine.filter((post) => post.status !== 'ativo');

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Mural de Generosidade</Text>

      <TouchableOpacity
        style={styles.newButton}
        onPress={() => setShowForm((current) => !current)}
        activeOpacity={0.85}
      >
        <FontAwesome name={showForm ? 'times' : 'plus'} size={14} color={MINIMAL_UI.blueDark} />
        <Text style={styles.newButtonText}>
          {showForm ? 'Cancelar' : 'Nova publicação'}
        </Text>
      </TouchableOpacity>

      {showForm ? (
        <View style={styles.form}>
          <SegmentChipRow
            variant="vigilance"
            compact
            options={[
              { value: 'doacao', label: 'Doar um item' },
              { value: 'pedido', label: 'Pedir empréstimo' },
            ]}
            selectedValue={tipo}
            onSelect={(value) => setTipo(value)}
          />
          <DropdownSelect
            options={GENEROSITY_CATEGORIAS.map((value) => ({
              value,
              label: GENEROSITY_CATEGORIA_LABEL[value],
            }))}
            selectedValue={categoria}
            onValueChange={(value) => setCategoria(value as GenerosityCategoria)}
            modalTitle="Categoria"
            variant="minimal"
          />
          <TextInput
            style={styles.input}
            placeholder="Título"
            placeholderTextColor={MINIMAL_UI.textMuted}
            value={titulo}
            onChangeText={setTitulo}
          />
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Descrição"
            placeholderTextColor={MINIMAL_UI.textMuted}
            value={descricao}
            onChangeText={setDescricao}
            multiline
          />
          <TouchableOpacity style={styles.photoButton} onPress={() => void handlePickImage()}>
            <FontAwesome name="camera" size={14} color={MINIMAL_UI.icon} />
            <Text style={styles.photoButtonText}>
              {imagePreview ? 'Trocar foto' : 'Foto opcional'}
            </Text>
          </TouchableOpacity>
          {imagePreview ? (
            <Image source={{ uri: imagePreview }} style={styles.preview} />
          ) : null}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => void handleSubmit()}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={MINIMAL_UI.onDark} />
            ) : (
              <Text style={styles.submitButtonText}>Enviar para moderação</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <SegmentChipRow
        variant="vigilance"
        compact
        options={[
          { value: 'doacao', label: 'Doações disponíveis' },
          { value: 'pedido', label: 'Pedidos de apoio' },
        ]}
        selectedValue={filter}
        onSelect={(value) => setFilter(value)}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <CardLoadingState lines={4} compact minimal />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {mineQueue.length ? (
            <Text style={styles.sectionLabel}>Meus anúncios</Text>
          ) : null}
          {mineQueue.map((post) => (
            <View key={`mine-${post.id}`} style={styles.card}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {post.titulo}
              </Text>
              <Text style={styles.cardMeta}>
                {GENEROSITY_TIPO_LABEL[post.tipo]} · {GENEROSITY_CATEGORIA_LABEL[post.categoria]} ·{' '}
                {GENEROSITY_STATUS_LABEL[post.status]}
              </Text>
              {post.status === 'ativo' || post.status === 'pendente' ? (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => void handleComplete(post)}
                  disabled={busyId === post.id}
                >
                  <Text style={styles.secondaryButtonText}>Marcar resolvido</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}

          <Text style={styles.sectionLabel}>
            {filter === 'doacao' ? 'Doações disponíveis' : 'Pedidos de apoio'}
          </Text>
          {!posts.length ? (
            <Text style={styles.empty}>Nenhum anúncio publicado nesta aba.</Text>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.card}>
                {post.fotoSignedUrl ? (
                  <Image source={{ uri: post.fotoSignedUrl }} style={styles.photo} />
                ) : null}
                <Text style={styles.cardTitle}>{post.titulo}</Text>
                <Text style={styles.cardMeta}>
                  {GENEROSITY_CATEGORIA_LABEL[post.categoria]}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={4}>
                  {post.descricao}
                </Text>
                {post.isMine ? (
                  <>
                    <Text style={styles.ownHint}>Seu anúncio</Text>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => void handleComplete(post)}
                      disabled={busyId === post.id}
                    >
                      <Text style={styles.secondaryButtonText}>Marcar resolvido</Text>
                    </TouchableOpacity>
                  </>
                ) : post.myInterest ? (
                  <Text style={styles.ownHint}>Interesse enviado à liderança</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.interestButton}
                    onPress={() => void handleInterest(post)}
                    disabled={busyId === post.id}
                    activeOpacity={0.85}
                  >
                    {busyId === post.id ? (
                      <ActivityIndicator size="small" color={MINIMAL_UI.blueDark} />
                    ) : (
                      <Text style={styles.interestButtonText}>
                        {post.tipo === 'doacao' ? 'Tenho interesse' : 'Posso ajudar'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
    gap: 10,
    backgroundColor: MINIMAL_UI.background,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
  },
  newButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  form: {
    gap: 8,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: MINIMAL_UI.text,
    fontSize: 14,
  },
  textarea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  photoButtonText: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '600',
  },
  preview: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  submitButton: {
    backgroundColor: MINIMAL_UI.accent,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    color: '#DC2626',
    fontSize: 12,
    textAlign: 'center',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 10,
    paddingBottom: 16,
  },
  sectionLabel: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    backgroundColor: MINIMAL_UI.background,
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  cardTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '800',
  },
  cardMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  cardDesc: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    lineHeight: 18,
  },
  ownHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  interestButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 120,
    alignItems: 'center',
  },
  interestButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  secondaryButtonText: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});
