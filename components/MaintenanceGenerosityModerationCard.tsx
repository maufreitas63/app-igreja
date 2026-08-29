import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import { SegmentChipRow } from '@/components/ui/SegmentChipRow';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatShortName } from '@/lib/formatShortName';
import {
  acceptGenerosityInterest,
  GENEROSITY_CATEGORIA_LABEL,
  GENEROSITY_STATUS_LABEL,
  GENEROSITY_TIPO_LABEL,
  listGenerosityInterestsAdmin,
  listGenerosityModerationQueue,
  moderateGenerosityPost,
  type GenerosityInterestAdmin,
  type GenerosityPost,
  type GenerosityStatus,
} from '@/lib/generosityMuralApi';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { openWhatsAppLikeBirthdays } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

type QueueFilter = 'pendente' | 'ativo' | 'interesses';

export function MaintenanceGenerosityModerationCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [tab, setTab] = useState<QueueFilter>('pendente');
  const [posts, setPosts] = useState<GenerosityPost[]>([]);
  const [interests, setInterests] = useState<GenerosityInterestAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (tab === 'interesses') {
        setInterests(await listGenerosityInterestsAdmin());
        setPosts([]);
      } else {
        setPosts(await listGenerosityModerationQueue(tab as GenerosityStatus));
        setInterests([]);
      }
    } catch (loadError) {
      setPosts([]);
      setInterests([]);
      setError(
        loadError instanceof Error ? loadError.message : 'Não foi possível carregar a moderação.'
      );
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    setLoading(true);
    void load();
  }, [isActive, load]);

  const runModerate = async (post: GenerosityPost, action: 'aprovar' | 'rejeitar' | 'concluir') => {
    const labels = {
      aprovar: 'Aprovar e publicar este anúncio?',
      rejeitar: 'Rejeitar este anúncio? Ele não aparece no mural.',
      concluir: 'Marcar este anúncio como resolvido?',
    };
    const confirmed = await confirmDialog('Moderação do Mural', labels[action], 'Confirmar', 'Cancelar');

    if (!confirmed) {
      return;
    }

    setBusyId(post.id);
    try {
      const result = await moderateGenerosityPost(post.id, action);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Moderação do Mural',
        text2: result.message,
      });
      if (result.success) {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const runAccept = async (interest: GenerosityInterestAdmin) => {
    const confirmed = await confirmDialog(
      'Mediar contato',
      `Aceitar o interesse em "${interest.postTitulo}" e avisar o membro?`,
      'Aceitar',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    setBusyId(interest.id);
    try {
      const result = await acceptGenerosityInterest(interest.id);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Moderação do Mural',
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
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <MaintenanceHelpInfoTitle
        title="Moderação do Mural"
        helpText="Nada entra no Mural de Generosidade sem aprovação. Telefones só aparecem aqui para a liderança fazer a ponte — o feed do membro não expõe contatos."
        minimal={minimal}
        titleStyle={minimal ? styles.sectionTitle : maintenancePanelStyles.panelTitle}
      />

      <SegmentChipRow
        variant={minimal ? 'vigilance' : 'default'}
        compact
        options={[
          { value: 'pendente', label: 'Pendentes' },
          { value: 'ativo', label: 'Publicados' },
          { value: 'interesses', label: 'Interesses' },
        ]}
        selectedValue={tab}
        onSelect={(value) => setTab(value)}
      />

      {error ? (
        <Text style={[styles.error, minimal && styles.errorMinimal]}>{error}</Text>
      ) : null}

      {loading ? (
        <CardLoadingState lines={4} compact minimal={minimal} />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          {...MAINTENANCE_SCROLL_PROPS}
        >
          {tab === 'interesses' ? (
            !interests.length ? (
              <Text style={[styles.empty, minimal && styles.emptyMinimal]}>
                Nenhum interesse pendente.
              </Text>
            ) : (
              interests.map((interest) => (
                <View
                  key={interest.id}
                  style={[styles.card, minimal && styles.cardMinimal]}
                >
                  <Text style={[styles.cardTitle, minimal && styles.cardTitleMinimal]}>
                    {interest.postTitulo}
                  </Text>
                  <Text style={[styles.meta, minimal && styles.metaMinimal]}>
                    {GENEROSITY_TIPO_LABEL[interest.postTipo]} · Interessado:{' '}
                    {formatShortName(interest.interestedName)}
                  </Text>
                  <Text style={[styles.meta, minimal && styles.metaMinimal]}>
                    Autor: {formatShortName(interest.authorName)}
                  </Text>
                  <View style={styles.actions}>
                    {interest.interestedPhone ? (
                      <TouchableOpacity
                        onPress={() => openWhatsAppLikeBirthdays(interest.interestedPhone)}
                      >
                        <FontAwesome name="whatsapp" size={18} color={minimal ? '#16A34A' : '#4ADE80'} />
                      </TouchableOpacity>
                    ) : null}
                    {interest.authorPhone ? (
                      <TouchableOpacity
                        onPress={() => openWhatsAppLikeBirthdays(interest.authorPhone)}
                      >
                        <FontAwesome name="whatsapp" size={18} color={minimal ? '#15803D' : '#86EFAC'} />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.actionBtn, minimal && styles.actionBtnMinimal]}
                      onPress={() => void runAccept(interest)}
                      disabled={busyId === interest.id}
                    >
                      {busyId === interest.id ? (
                        <ActivityIndicator size="small" color={MINIMAL_UI.blueDark} />
                      ) : (
                        <Text style={[styles.actionText, minimal && styles.actionTextMinimal]}>
                          Mediar
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )
          ) : !posts.length ? (
            <Text style={[styles.empty, minimal && styles.emptyMinimal]}>
              Nenhum anúncio nesta fila.
            </Text>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={[styles.card, minimal && styles.cardMinimal]}>
                {post.fotoSignedUrl ? (
                  <Image source={{ uri: post.fotoSignedUrl }} style={styles.photo} />
                ) : null}
                <Text style={[styles.cardTitle, minimal && styles.cardTitleMinimal]}>
                  {post.titulo}
                </Text>
                <Text style={[styles.meta, minimal && styles.metaMinimal]}>
                  {GENEROSITY_TIPO_LABEL[post.tipo]} · {GENEROSITY_CATEGORIA_LABEL[post.categoria]} ·{' '}
                  {GENEROSITY_STATUS_LABEL[post.status]}
                </Text>
                {post.authorName ? (
                  <Text style={[styles.meta, minimal && styles.metaMinimal]}>
                    {formatShortName(post.authorName)}
                  </Text>
                ) : null}
                <Text style={[styles.desc, minimal && styles.descMinimal]}>{post.descricao}</Text>
                <View style={styles.actions}>
                  {tab === 'pendente' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, minimal && styles.actionBtnMinimal]}
                        onPress={() => void runModerate(post, 'aprovar')}
                        disabled={busyId === post.id}
                      >
                        <Text style={[styles.actionText, minimal && styles.actionTextMinimal]}>
                          Aprovar
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, minimal && styles.actionBtnMinimal]}
                        onPress={() => void runModerate(post, 'rejeitar')}
                        disabled={busyId === post.id}
                      >
                        <Text style={[styles.actionText, minimal && styles.actionTextMinimal]}>
                          Rejeitar
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, minimal && styles.actionBtnMinimal]}
                      onPress={() => void runModerate(post, 'concluir')}
                      disabled={busyId === post.id}
                    >
                      <Text style={[styles.actionText, minimal && styles.actionTextMinimal]}>
                        Resolvido
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  panelMinimal: {
    ...CONTAIN_WIDTH,
    backgroundColor: MINIMAL_UI.background,
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
  },
  error: {
    color: '#FCA5A5',
    fontSize: 12,
  },
  errorMinimal: {
    color: '#DC2626',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 10,
    paddingBottom: 16,
  },
  empty: {
    color: 'rgba(226, 232, 240, 0.8)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(58, 150, 221, 0.35)',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  cardMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 6,
  },
  cardTitle: {
    color: '#3A96DD',
    fontSize: 15,
    fontWeight: '800',
  },
  cardTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  meta: {
    color: 'rgba(226, 232, 240, 0.82)',
    fontSize: 12,
  },
  metaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  desc: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
  },
  descMinimal: {
    color: MINIMAL_UI.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#1D4ED8',
  },
  actionBtnMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
  },
  actionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
});
