import { loadDigitalIdCardData, type DigitalIdCardData } from '@/lib/digitalIdCard';
import { subscribeGhostMode } from '@/lib/ghostMode';
import { boxShadowStyle } from '@/lib/boxShadow';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const ICON_COLOR = MINIMAL_UI.icon;
const PAGE_TITLES = ['Informações Pessoais', 'Informações Complementares'] as const;
/** Foto 30% maior que 112px, para ocupar o espaço liberado na página pessoal. */
const PHOTO_SIZE = 146;

type FieldRowProps = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: string;
  /** Valor na mesma linha do rótulo, à direita — campos curtos. */
  inline?: boolean;
};

function FieldRow({ icon, label, value, inline = false }: FieldRowProps) {
  return (
    <View style={[styles.fieldRow, inline && styles.fieldRowInline]}>
      <MaterialIcons name={icon} size={20} color={ICON_COLOR} />
      <View style={[styles.fieldText, inline && styles.fieldTextInline]}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text
          style={[styles.fieldValue, inline && styles.fieldValueInline]}
          numberOfLines={inline ? 1 : undefined}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function AddressDisclosure({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const hasAddress = Boolean(value.trim() && value.trim() !== '—');

  return (
    <View style={styles.addressCard}>
      <Pressable
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.addressHeader, pressed && styles.addressHeaderPressed]}
        accessibilityRole="button"
        accessibilityLabel="Endereço"
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Recolhe o endereço completo' : 'Mostra o endereço completo'}
      >
        <View style={styles.addressHeaderText}>
          <Text style={styles.addressTitle}>Endereço</Text>
          <Text style={styles.addressMeta}>
            {expanded ? 'Toque para recolher' : hasAddress ? 'Toque para visualizar' : 'Não informado'}
          </Text>
        </View>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={22}
          color={ICON_COLOR}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.addressBody}>
          <Text style={styles.fieldValue}>{hasAddress ? value : '—'}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Carteirinha digital de duas páginas — perfil efetivo + QR de check-in permanente. */
export function DigitalIDCard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DigitalIdCardData | null>(null);
  const [page, setPage] = useState(0);
  const [pagerWidth, setPagerWidth] = useState(0);
  const [pagerHeight, setPagerHeight] = useState(0);
  const pagerRef = useRef<ScrollView>(null);
  const pageRef = useRef(0);
  const loadGenerationRef = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);

    try {
      const next = await loadDigitalIdCardData();

      if (generation !== loadGenerationRef.current) {
        return;
      }

      setData(next);
    } catch (error) {
      console.error('Carteirinha Digital:', error);

      if (generation === loadGenerationRef.current) {
        setData(null);
      }
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  useEffect(() => subscribeGhostMode(() => void reload()), [reload]);

  pageRef.current = page;

  useEffect(() => {
    if (pagerWidth <= 0) {
      return;
    }

    pagerRef.current?.scrollTo({ x: pageRef.current * pagerWidth, animated: false });
  }, [pagerWidth]);

  const goToPage = useCallback(
    (nextPage: number) => {
      const clamped = nextPage < 0 ? 0 : nextPage > 1 ? 1 : nextPage;
      setPage(clamped);

      if (pagerWidth > 0) {
        pagerRef.current?.scrollTo({ x: clamped * pagerWidth, animated: true });
      }
    },
    [pagerWidth]
  );

  const onPagerScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pagerWidth <= 0) {
        return;
      }

      const nextPage = Math.round(event.nativeEvent.contentOffset.x / pagerWidth);

      if (nextPage === 0 || nextPage === 1) {
        setPage((current) => (current === nextPage ? current : nextPage));
      }
    },
    [pagerWidth]
  );

  const qrSize = useMemo(() => {
    if (pagerWidth <= 0) {
      return 168;
    }

    return Math.max(140, Math.min(180, Math.round(pagerWidth - 88)));
  }, [pagerWidth]);

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color={MINIMAL_UI.blueDark} size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.emptyText}>Não foi possível carregar a carteirinha digital.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.screenTitle}>Carteirinha Digital</Text>

      <View style={styles.card}>
        <View style={styles.cardAccent} />

        <View style={styles.cardHeader}>
          <Text style={styles.pageTitle}>{PAGE_TITLES[page]}</Text>
          <Text style={styles.pageCounter}>{page + 1}/2</Text>
        </View>

        <View
          style={styles.pagerFrame}
          onLayout={(event) => {
            const width = Math.round(event.nativeEvent.layout.width);
            const height = Math.round(event.nativeEvent.layout.height);

            if (width > 0 && width !== pagerWidth) {
              setPagerWidth(width);
            }

            if (height > 0 && height !== pagerHeight) {
              setPagerHeight(height);
            }
          }}
        >
          {pagerWidth > 0 && pagerHeight > 0 ? (
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              decelerationRate="fast"
              snapToInterval={pagerWidth}
              snapToAlignment="start"
              disableIntervalMomentum
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScroll={onPagerScroll}
              scrollEventThrottle={16}
              style={styles.pager}
            >
              <ScrollView
                style={[styles.page, { width: pagerWidth, height: pagerHeight }]}
                contentContainerStyle={styles.pageContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.photoWrap}>
                  {data.photoUrl ? (
                    <Image
                      source={{ uri: data.photoUrl }}
                      style={styles.photo}
                      contentFit="cover"
                      cachePolicy="none"
                      accessibilityLabel="Foto do perfil"
                    />
                  ) : (
                    <View style={styles.photoFallback} accessibilityLabel="Foto indisponível">
                      {data.initials !== '?' ? (
                        <Text style={styles.initials}>{data.initials}</Text>
                      ) : (
                        <MaterialIcons name="person" size={62} color={ICON_COLOR} />
                      )}
                    </View>
                  )}
                </View>

                <FieldRow icon="badge" label="Nome completo" value={data.fullName} />
                <View style={styles.compactPair}>
                  <FieldRow icon="cake" label="Nascimento" value={data.birthDate} inline />
                  <FieldRow icon="phone" label="Telefone" value={data.phone} inline />
                </View>
                <FieldRow icon="email" label="E-mail" value={data.email} />
                <AddressDisclosure value={data.address} />
              </ScrollView>

              <ScrollView
                style={[styles.page, { width: pagerWidth, height: pagerHeight }]}
                contentContainerStyle={styles.pageTwoContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.qrBlock}>
                  <Text style={styles.qrCaption}>QR Code de Check-in</Text>
                  {data.checkInQrValue ? (
                    <>
                      <View style={styles.qrSurface}>
                        <QRCode
                          value={data.checkInQrValue}
                          size={qrSize}
                          color={MINIMAL_UI.blueDark}
                          backgroundColor={MINIMAL_UI.background}
                          ecl="M"
                          quietZone={8}
                        />
                      </View>
                      <Text style={styles.qrFamilyCode}>{data.checkInQrValue}</Text>
                      <Text style={styles.qrHint}>
                        Apresente este QR no totem para confirmar a presença nos eventos da igreja.
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.qrHint}>
                      Vincule um código de família em Dados Cadastrais para gerar o QR Code de check-in.
                    </Text>
                  )}
                </View>

                <View style={styles.complementBlock}>
                  <View style={styles.statusBadge}>
                    <MaterialIcons name="verified-user" size={22} color={ICON_COLOR} />
                    <Text style={styles.statusValue}>{data.status}</Text>
                  </View>
                  <Text style={styles.statusLabel}>Status</Text>
                  <FieldRow
                    icon="event-available"
                    label="Entrada no app"
                    value={data.registeredAt}
                    inline
                  />
                </View>
              </ScrollView>
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.navBar}>
          <Pressable
            onPress={() => goToPage(page - 1)}
            disabled={page === 0}
            style={({ pressed }) => [
              styles.navButton,
              page === 0 && styles.navButtonDisabled,
              pressed && page !== 0 && styles.navButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Página anterior"
          >
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={page === 0 ? MINIMAL_UI.border : ICON_COLOR}
            />
          </Pressable>

          <View style={styles.dots}>
            {PAGE_TITLES.map((title, index) => (
              <Pressable
                key={title}
                onPress={() => goToPage(index)}
                style={[styles.dot, page === index && styles.dotActive]}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityState={{ selected: page === index }}
              />
            ))}
          </View>

          <Pressable
            onPress={() => goToPage(page + 1)}
            disabled={page === 1}
            style={({ pressed }) => [
              styles.navButton,
              page === 1 && styles.navButtonDisabled,
              pressed && page !== 1 && styles.navButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Próxima página"
          >
            <MaterialIcons
              name="chevron-right"
              size={28}
              color={page === 1 ? MINIMAL_UI.border : ICON_COLOR}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 10,
  },
  screenTitle: MINIMAL_SECTION_TITLE,
  loadingState: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    overflow: 'hidden',
    ...boxShadowStyle({
      color: MINIMAL_UI.blueDark,
      offsetY: 4,
      blurRadius: 12,
      opacity: 0.08,
      elevation: 3,
    }),
  },
  cardAccent: {
    height: 8,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  pageTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '700',
  },
  pageCounter: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  pagerFrame: {
    flex: 1,
    minHeight: 0,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    justifyContent: 'space-between',
    flexGrow: 1,
  },
  pageTwoContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'stretch',
  },
  photoWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    borderWidth: 2,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  photoFallback: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    borderWidth: 2,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  initials: {
    color: MINIMAL_UI.blueDark,
    fontSize: 47,
    fontWeight: '700',
    letterSpacing: 1,
  },
  compactPair: {
    gap: 10,
  },
  addressCard: {
    backgroundColor: MINIMAL_UI.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.divider,
    overflow: 'hidden',
    marginHorizontal: -16,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  addressHeaderPressed: {
    opacity: 0.75,
  },
  addressHeaderText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  addressTitle: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '800',
  },
  addressMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  addressBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  fieldRowInline: {
    alignItems: 'center',
  },
  fieldText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fieldTextInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldLabel: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flexShrink: 0,
  },
  fieldValue: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  fieldValueInline: {
    flexShrink: 1,
    textAlign: 'right',
  },
  qrBlock: {
    alignItems: 'center',
    paddingTop: 4,
  },
  qrCaption: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  qrSurface: {
    backgroundColor: MINIMAL_UI.background,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrFamilyCode: {
    marginTop: 8,
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  qrHint: {
    marginTop: 8,
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  complementBlock: {
    marginTop: 18,
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  statusValue: {
    color: MINIMAL_UI.blueDark,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statusLabel: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 4,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  navButtonDisabled: {
    opacity: 0.45,
  },
  navButtonPressed: {
    opacity: 0.7,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MINIMAL_UI.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: MINIMAL_UI.blueDark,
  },
});
